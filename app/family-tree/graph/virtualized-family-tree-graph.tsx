"use client";

import { useCallback, useMemo, useState, useRef, useEffect, memo } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Panel,
  type Node,
  type Edge,
  BackgroundVariant,
  type NodeTypes,
  getNodesBounds,
  getViewportForBounds,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  RotateCcw,
  Maximize,
  Minimize,
  Search,
  X,
  Download,
  ChevronsDown,
  Lock,
  Unlock,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  ChevronsUp,
  Users,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { toPng } from "html-to-image";
import { FamilyMemberNodeType, type FamilyNodeData } from "./family-node";
import { GenerationNodeType } from "./generation-node";
import { toChineseNum } from "./utils/chinese-num";
import { getBranchBaseColor, generateBranchColor, type HSLColor } from "./utils/colors";
import { FlowingEdge } from "./flowing-edge";
import type { FamilyMemberNode } from "./actions";
import dagre from "@dagrejs/dagre";
import { MemberDetailDialog } from "../member-detail-dialog";

// 防抖函数
function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return ((...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  }) as T;
}

const nodeTypes: NodeTypes = {
  familyMember: FamilyMemberNodeType,
  generationLabel: GenerationNodeType,
};

const edgeTypes = {
  flowing: FlowingEdge,
};

interface VirtualizedFamilyTreeGraphProps {
  initialData: FamilyMemberNode[];
  allData?: FamilyMemberNode[]; // 完整数据（用于搜索）
  totalGenerations?: number; // 总代数（用于加载更多）
  totalCount?: number; // 总成员数
  onMemberClick?: (member: FamilyMemberNode) => void;
  onSpouseClick?: (spouseId: number) => void;
}

// 布局常量
const NODE_WIDTH = 160;
const NODE_HEIGHT = 120;
const HORIZONTAL_GAP = 80;
const VERTICAL_GAP = 120;

// 可视区域缓冲区（额外渲染的代数）
const VISIBLE_GENERATION_BUFFER = 1;

// 默认展开的代数（超过此代数的节点默认折叠）
const DEFAULT_VISIBLE_GENERATIONS = 5;

interface CachedLayout {
  positions: Map<number, { x: number; y: number }>;
  generationYRange: Map<number, { minY: number; maxY: number; count: number; label: string }>;
  minX: number;
}

// 世代标尺常量
const RULER_WIDTH = 56;
const RULER_TICK_HEIGHT = 8;
const RULER_LABEL_WIDTH = 40;

/**
 * 增量布局计算 - 只重算变化的子树
 */
function getIncrementalLayout(
  allMembers: FamilyMemberNode[],
  childrenMap: Map<number, number[]>,
  collapsedIds: Set<number>,
  changedIds: Set<number>, // 折叠状态改变的节点ID
  layoutCache: CachedLayout | null,
  onToggleCollapse?: (id: number) => void
): { nodes: Node[]; edges: Edge[]; cache: CachedLayout } {
  const memberMap = new Map(allMembers.map((m) => [m.id, m]));
  const roots = allMembers.filter((m) => !m.father_id || !memberMap.has(m.father_id));
  const rootGeneration = roots.length > 0 ? (roots[0].generation || 1) : 1;

  // 计算支系颜色（与之前相同）
  const memberBaseColorMap = new Map<number, HSLColor>();
  const setDescendantColors = (memberId: number, color: HSLColor) => {
    memberBaseColorMap.set(memberId, color);
    const children = childrenMap.get(memberId) || [];
    children.forEach((childId) => {
      if (!memberBaseColorMap.has(childId)) {
        setDescendantColors(childId, color);
      }
    });
  };
  roots.forEach((root) => {
    const children = childrenMap.get(root.id) || [];
    children.forEach((childId, index) => {
      const baseColor = getBranchBaseColor(index);
      setDescendantColors(childId, baseColor);
    });
  });

  // 确定需要重新布局的节点集合
  const nodesToRelayout = new Set<number>();
  if (changedIds.size > 0) {
    // 只重算受影响的子树
    changedIds.forEach((changedId) => {
      nodesToRelayout.add(changedId);
      const queue = [changedId];
      while (queue.length > 0) {
        const id = queue.shift()!;
        const children = childrenMap.get(id) || [];
        children.forEach((childId) => {
          nodesToRelayout.add(childId);
          queue.push(childId);
        });
      }
    });
  }

  // BFS 遍历确定可见节点
  const visibleMembers: FamilyMemberNode[] = [];
  const queue = [...roots];
  const visited = new Set<number>();

  while (queue.length > 0) {
    const member = queue.shift()!;
    if (visited.has(member.id)) continue;
    visited.add(member.id);
    visibleMembers.push(member);

    if (!collapsedIds.has(member.id)) {
      const childIds = childrenMap.get(member.id) || [];
      childIds.forEach((childId) => {
        const child = memberMap.get(childId);
        if (child) queue.push(child);
      });
    }
  }

  // 准备 dagre 图
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: "TB",
    nodesep: HORIZONTAL_GAP,
    ranksep: VERTICAL_GAP,
  });

  // 构建节点和边
  const edges: Edge[] = [];
  const newPositions = new Map<number, { x: number; y: number }>();

  // 添加节点到 dagre
  visibleMembers.forEach((member) => {
    dagreGraph.setNode(String(member.id), {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });
  });

  // 添加边
  visibleMembers.forEach((member) => {
    if (member.father_id) {
      const fatherExists = visibleMembers.some((m) => m.id === member.father_id);
      if (fatherExists) {
        dagreGraph.setEdge(String(member.father_id), String(member.id));

        const baseColor = memberBaseColorMap.get(member.id);
        const edgeColor = baseColor
          ? generateBranchColor(baseColor, 0)
          : "hsl(var(--muted-foreground))";

        edges.push({
          id: `e${member.father_id}-${member.id}`,
          source: String(member.father_id),
          target: String(member.id),
          type: "flowing",
          animated: false,
          style: {
            stroke: edgeColor,
            strokeWidth: 2,
            opacity: 0.6,
          },
        });
      }
    }
  });

  // 计算布局
  dagre.layout(dagreGraph);

  // 转换为节点，同时记录每个世代的Y范围
  let minX = Infinity;
  const generationYRange = new Map<number, { minY: number; maxY: number; count: number; label: string }>();
  visibleMembers.forEach((member) => {
    const nodeWithPosition = dagreGraph.node(String(member.id));
    const x = nodeWithPosition.x - NODE_WIDTH / 2;
    const y = nodeWithPosition.y - NODE_HEIGHT / 2;

    if (x < minX) minX = x;
    newPositions.set(member.id, { x, y });

    if (member.generation) {
      const label = `第${toChineseNum(member.generation)}世`;
      const current = generationYRange.get(member.generation);
      if (current) {
        current.minY = Math.min(current.minY, nodeWithPosition.y);
        current.maxY = Math.max(current.maxY, nodeWithPosition.y);
        current.count++;
      } else {
        generationYRange.set(member.generation, {
          minY: nodeWithPosition.y,
          maxY: nodeWithPosition.y,
          count: 1,
          label,
        });
      }
    }
  });

  // 生成节点
  const memberNodes: Node[] = visibleMembers.map((member) => {
    const position = newPositions.get(member.id)!;
    const hasChildren = (childrenMap.get(member.id)?.length || 0) > 0;
    const baseColor = memberBaseColorMap.get(member.id);
    const genOffset = (member.generation || rootGeneration) - (rootGeneration + 1);
    const nodeColor = baseColor
      ? generateBranchColor(baseColor, Math.max(0, genOffset))
      : undefined;

    return {
      id: String(member.id),
      type: "familyMember",
      position: { x: position.x, y: position.y },
      data: {
        ...member,
        hasChildren,
        collapsed: collapsedIds.has(member.id),
        branchColor: nodeColor,
        onToggleCollapse: onToggleCollapse,
      } as FamilyNodeData,
    };
  });

  const cache: CachedLayout = {
    positions: newPositions,
    generationYRange,
    minX,
  };

  return { nodes: memberNodes, edges, cache };
}

/**
 * 虚拟化世系图组件 - 支持万人级数据
 */
const VirtualizedFamilyTreeGraphInner = memo(function VirtualizedFamilyTreeGraphInner({
  initialData,
  allData,
  totalCount,
  onMemberClick,
  onSpouseClick,
}: VirtualizedFamilyTreeGraphProps & { totalCount?: number }) {
  const reactFlowInstance = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const [userEmail] = useState<string>("本地用户");

  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const [highlightedPathIds, setHighlightedPathIds] = useState<Set<string>>(new Set());
  const [searchResults, setSearchResults] = useState<FamilyMemberNode[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [isSearchPopoverOpen, setIsSearchPopoverOpen] = useState(false);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDraggable, setIsDraggable] = useState(false);

  // ReactFlow viewport 状态
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  
  // 默认折叠超过5世的节点
  const initialCollapsedIds = useMemo(() => {
    const collapsed = new Set<number>();
    initialData.forEach((m) => {
      if (m.generation && m.generation > DEFAULT_VISIBLE_GENERATIONS) {
        collapsed.add(m.id);
      }
    });
    return collapsed;
  }, [initialData]);
  
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(initialCollapsedIds);

  // 布局缓存
  const layoutCacheRef = useRef<CachedLayout | null>(null);

  // 构建 childrenMap（轻量级，只存储 ID 关系）
  const childrenMap = useMemo(() => {
    const map = new Map<number, number[]>();
    initialData.forEach((m) => {
      if (m.father_id) {
        const children = map.get(m.father_id) || [];
        children.push(m.id);
        map.set(m.father_id, children);
      }
    });
    return map;
  }, [initialData]);

  // 构建完整成员映射（用于搜索和高亮）
  const allMembersMap = useMemo(() => {
    const map = new Map<number, FamilyMemberNode>();
    (allData || initialData).forEach((m) => map.set(m.id, m));
    return map;
  }, [allData, initialData]);

  // 计算高亮路径（保持不变）
  useEffect(() => {
    if (!highlightedId) {
      setHighlightedPathIds(new Set());
      return;
    }

    const pathSet = new Set<string>();
    const memberMap = allMembersMap;

    let currentId = highlightedId;
    pathSet.add(String(currentId));

    while (true) {
      const member = memberMap.get(currentId);
      if (!member || !member.father_id) break;
      pathSet.add(String(member.father_id));
      pathSet.add(`e${member.father_id}-${currentId}`);
      currentId = member.father_id;
    }

    const queue = [highlightedId];
    while (queue.length > 0) {
      const parentId = queue.shift()!;
      const children = childrenMap.get(parentId) || [];
      children.forEach((childId) => {
        pathSet.add(String(childId));
        pathSet.add(`e${parentId}-${childId}`);
        queue.push(childId);
      });
    }

    setHighlightedPathIds(pathSet);
  }, [highlightedId, allMembersMap, childrenMap]);

  // 折叠切换（触发增量布局）
  const onToggleCollapse = useCallback((id: number) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // 增量布局计算
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const changedIds = new Set<number>();

    const { nodes, edges, cache } = getIncrementalLayout(
      initialData,
      childrenMap,
      collapsedIds,
      changedIds,
      layoutCacheRef.current,
      onToggleCollapse
    );
    layoutCacheRef.current = cache;

    return { nodes, edges };
  }, [initialData, childrenMap, collapsedIds]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // 计算 generationYRange
  const generationYRange = useMemo(() => {
    if (nodes.length === 0) return new Map();
    const rangeMap = new Map<number, { minY: number; maxY: number; count: number; label: string }>();
    nodes.forEach((node) => {
      const data = node.data as FamilyNodeData;
      if (data?.generation) {
        const label = `第${toChineseNum(data.generation)}世`;
        const y = node.position.y;
        const current = rangeMap.get(data.generation);
        if (current) {
          current.minY = Math.min(current.minY, y);
          current.maxY = Math.max(current.maxY, y);
          current.count++;
        } else {
          rangeMap.set(data.generation, {
            minY: y,
            maxY: y,
            count: 1,
            label,
          });
        }
      }
    });
    return rangeMap;
  }, [nodes]);

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // 高亮效果更新（保持不变）
  useEffect(() => {
    const hasHighlight = highlightedId !== null;

    setNodes((nds) =>
      nds.map((node) => {
        if (node.type === "generationLabel") {
          return {
            ...node,
            style: {
              ...node.style,
              opacity: hasHighlight ? 0.2 : 1,
              transition: "opacity 0.3s ease",
            },
          };
        }

        const isPathNode = highlightedPathIds.has(node.id);
        return {
          ...node,
          data: {
            ...node.data,
            isHighlighted: node.id === String(highlightedId),
            isPathHighlighted: isPathNode,
            isDimmed: hasHighlight && !isPathNode,
          },
        };
      })
    );

    setEdges((eds) =>
      eds.map((edge) => {
        const isPathEdge = highlightedPathIds.has(edge.id);
        let strokeColor = edge.style?.stroke || "hsl(var(--muted-foreground))";
        let strokeWidth = 2;
        let opacity = 0.6;
        let zIndex = 0;

        if (hasHighlight) {
          if (isPathEdge) {
            strokeColor = "#f59e0b";
            strokeWidth = 3;
            opacity = 1;
            zIndex = 10;
          } else {
            opacity = 0.1;
          }
        }

        return {
          ...edge,
          animated: isPathEdge,
          style: {
            ...edge.style,
            stroke: strokeColor,
            strokeWidth,
            opacity,
          },
          zIndex,
        };
      })
    );
  }, [highlightedId, highlightedPathIds, setNodes, setEdges]);

  // 展开所有
  const onExpandAll = useCallback(() => {
    setCollapsedIds(new Set());
  }, []);

  // 搜索（添加防抖）
  const debouncedSearch = useMemo(
    () =>
      debounce((query: string) => {
        if (!query.trim()) {
          setHighlightedId(null);
          setSearchResults([]);
          setIsSearchPopoverOpen(false);
          return;
        }

        const foundMembers = (allData || initialData).filter((member) =>
          member.name.toLowerCase().includes(query.toLowerCase())
        );

        setSearchResults(foundMembers);

        if (foundMembers.length > 0) {
          setCurrentResultIndex(0);
          const found = foundMembers[0];

          let current = found;
          const idsToExpand = new Set<number>();
          while (current.father_id) {
            if (collapsedIds.has(current.father_id)) {
              idsToExpand.add(current.father_id);
            }
            const father = initialData.find((m) => m.id === current.father_id);
            if (!father) break;
            current = father;
          }

          if (idsToExpand.size > 0) {
            setCollapsedIds((prev) => {
              const next = new Set(prev);
              idsToExpand.forEach((id) => next.delete(id));
              return next;
            });
            setTimeout(() => {
              setHighlightedId(found.id);
            }, 100);
          } else {
            setHighlightedId(found.id);
          }

          if (foundMembers.length > 1) {
            setIsSearchPopoverOpen(true);
          }
        } else {
          setHighlightedId(null);
          setIsSearchPopoverOpen(false);
        }
      }, 300),
    [initialData, collapsedIds, allData]
  );

  // 监听 searchQuery 变化自动搜索
  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  // 手动触发搜索（用于按钮点击和 Enter 键）
  const onSearch = useCallback(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  // 清除搜索
  const onClearSearch = useCallback(() => {
    setSearchQuery("");
    setHighlightedId(null);
    setSearchResults([]);
    setCurrentResultIndex(0);
    setIsSearchPopoverOpen(false);
  }, []);
  const goToSearchResult = useCallback((index: number) => {
    if (index < 0 || index >= searchResults.length) return;

    setCurrentResultIndex(index);
    const found = searchResults[index];

    let current = found;
    const idsToExpand = new Set<number>();
    while (current.father_id) {
      if (collapsedIds.has(current.father_id)) {
        idsToExpand.add(current.father_id);
      }
      const father = initialData.find((m) => m.id === current.father_id);
      if (!father) break;
      current = father;
    }

    if (idsToExpand.size > 0) {
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        idsToExpand.forEach((id) => next.delete(id));
        return next;
      });
      setTimeout(() => {
        setHighlightedId(found.id);
      }, 100);
    } else {
      setHighlightedId(found.id);
    }
  }, [searchResults, collapsedIds, initialData]);

  const goToPrevResult = useCallback(() => {
    const newIndex = currentResultIndex > 0 ? currentResultIndex - 1 : searchResults.length - 1;
    goToSearchResult(newIndex);
  }, [currentResultIndex, searchResults.length, goToSearchResult]);

  const goToNextResult = useCallback(() => {
    const newIndex = currentResultIndex < searchResults.length - 1 ? currentResultIndex + 1 : 0;
    goToSearchResult(newIndex);
  }, [currentResultIndex, searchResults.length, goToSearchResult]);

  useEffect(() => {
    if (highlightedId) {
      const node = reactFlowInstance.getNode(String(highlightedId));
      if (node) {
        reactFlowInstance.setCenter(
          node.position.x + NODE_WIDTH / 2,
          node.position.y + NODE_HEIGHT / 2,
          { zoom: 1.5, duration: 500 }
        );
      }
    }
  }, [highlightedId, reactFlowInstance]);

  // 双击节点时切换折叠状态
  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const memberId = Number(node.id);
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        if (next.has(memberId)) {
          next.delete(memberId);
        } else {
          next.add(memberId);
        }
        return next;
      });
    },
    []
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const member = initialData.find((m) => m.id === Number(node.id));
      if (member && onMemberClick) {
        onMemberClick(member);
      }
    },
    [initialData, onMemberClick]
  );

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const onDownload = useCallback(async () => {
    const viewportElem = document.querySelector(".react-flow__viewport") as HTMLElement;
    if (!viewportElem) return;

    const bounds = getNodesBounds(nodes);
    const imageWidth = bounds.width + 300;
    const imageHeight = bounds.height + 300;

    const transform = getViewportForBounds(
      bounds,
      imageWidth,
      imageHeight,
      0.1,
      2,
      0.15
    );

    let bgDataUrl = "";
    try {
      const response = await fetch("/images/login-bg.jpg");
      if (response.ok) {
        const blob = await response.blob();
        bgDataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }
    } catch (error) {
      console.warn("Failed to load background image:", error);
    }

    const canvas = document.createElement("canvas");
    canvas.width = imageWidth * 2.0;
    canvas.height = imageHeight * 2.0;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(2.0, 2.0);

    if (bgDataUrl) {
      const bgImg = new Image();
      bgImg.src = bgDataUrl;
      await new Promise((resolve) => {
        bgImg.onload = resolve;
      });

      const bgRatio = bgImg.width / bgImg.height;
      const canvasRatio = imageWidth / imageHeight;
      let drawW = imageWidth;
      let drawH = imageHeight;
      let offsetX = 0;
      let offsetY = 0;

      if (bgRatio > canvasRatio) {
        drawH = imageHeight;
        drawW = imageHeight * bgRatio;
        offsetX = (imageWidth - drawW) / 2;
      } else {
        drawW = imageWidth;
        drawH = imageWidth / bgRatio;
        offsetY = (imageHeight - drawH) / 2;
      }

      ctx.drawImage(bgImg, offsetX, offsetY, drawW, drawH);
    } else {
      ctx.fillStyle = "#f9f5f0";
      ctx.fillRect(0, 0, imageWidth, imageHeight);
    }

    const watermarkText = userEmail || "Liu Family";
    ctx.save();
    ctx.rotate(-30 * Math.PI / 180);
    ctx.font = "16px sans-serif";
    ctx.fillStyle = "rgba(0, 0, 0, 0.03)";
    ctx.textAlign = "center";

    const stepX = 200;
    const stepY = 100;
    for (let x = -imageWidth; x < imageWidth * 2; x += stepX) {
      for (let y = -imageHeight; y < imageHeight * 2; y += stepY) {
        ctx.fillText(watermarkText, x, y);
      }
    }
    ctx.restore();

    const treeDataUrl = await toPng(viewportElem, {
      width: imageWidth,
      height: imageHeight,
      backgroundColor: null as any,
      style: {
        width: imageWidth.toString(),
        height: imageHeight.toString(),
        transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
        fontFamily: "system-ui, -apple-system, sans-serif",
        backgroundColor: "transparent",
      },
      pixelRatio: 2.0,
      cacheBust: true,
    });

    const treeImg = new Image();
    treeImg.src = treeDataUrl;
    await new Promise((resolve) => {
      treeImg.onload = resolve;
    });

    ctx.drawImage(treeImg, 0, 0, imageWidth, imageHeight);

    const finalDataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const a = document.createElement("a");
    a.setAttribute("download", `family-tree-${new Date().toISOString().split("T")[0]}.jpg`);
    a.setAttribute("href", finalDataUrl);
    a.click();
  }, [nodes, userEmail]);

  const toggleDraggable = useCallback(() => {
    setIsDraggable((prev) => !prev);
  }, []);

  // 重置视图
  const onResetView = useCallback(() => {
    // 清除缓存，强制重新计算布局
    layoutCacheRef.current = null;
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.2, duration: 300 });
    }, 100);
  }, [reactFlowInstance]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[calc(100vh-200px)] min-h-[500px] border rounded-lg bg-background relative"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onMove={(_, viewport) => {
          setViewport(viewport);
        }}
        onInit={(instance) => {
          setViewport(instance.getViewport());
          instance.fitView({ padding: 0.2 });
        }}
        minZoom={0.1}
        maxZoom={2}
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
        nodesDraggable={isDraggable}
        nodesConnectable={false}
        edgesFocusable={false}
      >
        <Controls
          showInteractive={false}
          className="!bg-background !border !border-border !shadow-md [&>button]:!bg-background [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-muted [&>button>svg]:!fill-current"
        />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />

        {/* 工具栏 */}
        <Panel
          position="top-left"
          className="!absolute !top-0 !left-0 !w-full !m-0 p-2 sm:p-4 flex justify-between items-start pointer-events-none z-10"
        >
          {/* 搜索栏 */}
          <div className="pointer-events-auto flex items-center gap-1 bg-background/95 backdrop-blur-sm border rounded-md p-1 shadow-sm">
            <Input
              placeholder="搜索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
              className="h-8 w-28 sm:w-40 md:w-56 border-0 focus-visible:ring-0 placeholder:text-muted-foreground/70"
            />
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onSearch} title="搜索成员">
              <Search className="h-4 w-4" />
            </Button>
            {searchQuery && (
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClearSearch} title="清除">
                <X className="h-4 w-4" />
              </Button>
            )}
            {/* 搜索结果导航 */}
            {searchResults.length > 1 && (
              <>
                <div className="h-4 w-px bg-border mx-1" />
                <Popover open={isSearchPopoverOpen} onOpenChange={setIsSearchPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-8 px-2 gap-1">
                      <Users className="h-3.5 w-3.5" />
                      <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                        {currentResultIndex + 1}/{searchResults.length}
                      </Badge>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-0" align="start">
                    <div className="p-2 border-b bg-muted/50">
                      <span className="text-xs font-medium text-muted-foreground">
                        找到 {searchResults.length} 位同名成员
                      </span>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {searchResults.map((member, index) => (
                        <button
                          key={member.id}
                          onClick={() => {
                            goToSearchResult(index);
                            setIsSearchPopoverOpen(false);
                          }}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center justify-between ${
                            index === currentResultIndex ? "bg-accent" : ""
                          }`}
                        >
                          <span className="font-medium">{member.name}</span>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            {member.generation && <span>第{member.generation}世</span>}
                            {member.father_id && (
                              <span className="truncate max-w-[80px]">
                                (父: {initialData.find((m) => m.id === member.father_id)?.name || "未知"})
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={goToPrevResult} title="上一个">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={goToNextResult} title="下一个">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
            {searchResults.length === 1 && (
              <div className="h-4 w-px bg-border mx-1" />
            )}
            {searchResults.length === 1 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                1/1
              </Badge>
            )}
          </div>

          {/* 右侧按钮 */}
          <div className="pointer-events-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onResetView}
              title="重置视图"
              className="bg-background/95 backdrop-blur-sm shadow-sm h-9 w-9 px-0 sm:w-auto sm:px-4"
            >
              <RotateCcw className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">重置</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={toggleFullscreen}
              title={isFullscreen ? "退出全屏" : "全屏"}
              className="bg-background/95 backdrop-blur-sm shadow-sm h-9 w-9 px-0 sm:w-auto sm:px-4"
            >
              {isFullscreen ? (
                <>
                  <Minimize className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">退出</span>
                </>
              ) : (
                <>
                  <Maximize className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">全屏</span>
                </>
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-background/95 backdrop-blur-sm shadow-sm h-9 w-9 px-0"
                  title="更多"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onExpandAll}>
                  <ChevronsDown className="h-4 w-4 mr-2" />
                  全部展开
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setCollapsedIds(initialCollapsedIds);
                  }}
                >
                  <ChevronsUp className="h-4 w-4 mr-2" />
                  收起前5世
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleDraggable}>
                  {isDraggable ? (
                    <>
                      <Unlock className="h-4 w-4 mr-2" />
                      解锁位置
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      锁定位置
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  保存图片
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Panel>

        {/* 统计 */}
        <Panel position="bottom-right" className="bg-background/95 backdrop-blur-sm border rounded-md px-3 py-2">
          <span className="text-sm text-muted-foreground">
            共 {totalCount ?? initialData.length} 位成员（显示 {nodes.length} 个节点）
          </span>
        </Panel>
      </ReactFlow>

      {/* 世代标尺 - 在 ReactFlow 外部 */}
      <GenerationRuler generationYRange={generationYRange} viewport={viewport} />
    </div>
  );
});

/**
 * 虚拟化世系图容器 - 负责数据加载和状态管理
 */
export function VirtualizedFamilyTreeGraph({ initialData, totalCount, onMemberClick, onSpouseClick }: VirtualizedFamilyTreeGraphProps) {
  const [selectedMember, setSelectedMember] = useState<FamilyMemberNode | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const getFatherName = useCallback(
    (fatherId: number | null) => {
      if (!fatherId) return null;
      const father = initialData.find((m) => m.id === fatherId);
      return father?.name || null;
    },
    [initialData]
  );

  const handleMemberClick = useCallback((member: FamilyMemberNode) => {
    setSelectedMember(member);
    setIsDetailOpen(true);
  }, []);

  const handleSpouseClick = useCallback(async (spouseId: number) => {
    let spouse = initialData.find((m) => m.id === spouseId);
    if (!spouse) {
      try {
        const { fetchMemberById } = await import("./actions");
        spouse = (await fetchMemberById(spouseId)) ?? undefined;
      } catch (error) {
        console.error("Error fetching spouse:", error);
      }
    }

    if (spouse) {
      setSelectedMember(spouse);
      setIsDetailOpen(true);
    }
  }, [initialData]);

  return (
    <>
      <ReactFlowProvider>
        <VirtualizedFamilyTreeGraphInner
          initialData={initialData}
          allData={initialData}
          totalCount={totalCount}
          onMemberClick={handleMemberClick}
          onSpouseClick={handleSpouseClick}
        />
      </ReactFlowProvider>

      <MemberDetailDialog
        isOpen={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        member={selectedMember}
        fatherName={getFatherName(selectedMember?.father_id || null)}
      />
    </>
  );
}

/**
 * 世代标尺组件 - CAD 风格侧边标尺，始终与世代位置对应
 */
interface GenerationRulerProps {
  generationYRange: Map<number, { minY: number; maxY: number; count: number; label: string }>;
  viewport: { x: number; y: number; zoom: number };
}

const GenerationRuler = memo(function GenerationRuler({
  generationYRange,
  viewport,
}: GenerationRulerProps) {
  if (!generationYRange || generationYRange.size === 0) {
    return null;
  }

  const sortedGenerations = Array.from(generationYRange.entries()).sort((a, b) => a[0] - b[0]);

  return (
    <div
      className="absolute left-0 top-0 h-full pointer-events-none z-20 overflow-hidden"
      style={{ width: RULER_WIDTH }}
    >
      {/* 标尺背景 */}
      <div
        className="absolute left-0 top-0 h-full bg-background/95"
        style={{ width: RULER_LABEL_WIDTH }}
      />

      {/* 垂直分隔线 */}
      <div
        className="absolute top-0 right-0 h-full border-r border-border"
        style={{ width: 1 }}
      />

      {/* 世代标记 */}
      {sortedGenerations.map(([generation, { minY, maxY, label }]) => {
        const centerY = minY + (maxY - minY) / 2;
        const topY = minY;
        const bottomY = maxY + NODE_HEIGHT;

        return (
          <div
            key={generation}
            className="absolute left-0"
            style={{
              top: centerY * viewport.zoom + viewport.y,
              transform: 'translateY(-50%)',
              width: RULER_WIDTH,
            }}
          >
            {/* 世代区域背景 */}
            <div
              className="absolute left-0 bg-accent/10 rounded-sm"
              style={{
                top: '50%',
                transform: 'translateY(-50%)',
                width: RULER_LABEL_WIDTH,
                height: (bottomY - topY) * viewport.zoom,
              }}
            />

            {/* 刻度线和标签组 */}
            <div className="relative" style={{ width: RULER_WIDTH, height: 0 }}>
              {/* 刻度线 */}
              <div
                className="absolute bg-border"
                style={{
                  right: 0,
                  top: -RULER_TICK_HEIGHT / 2,
                  width: RULER_TICK_HEIGHT,
                  height: 1,
                }}
              />

              {/* 世代标签 */}
              <div
                className="absolute right-0 flex items-center justify-end pr-2"
                style={{
                  top: 0,
                  height: 24,
                  transform: 'translateY(-50%)',
                }}
              >
                <span className="text-sm font-semibold text-foreground/80 whitespace-nowrap">
                  {label}
                </span>
              </div>
            </div>

            {/* 水平参考线 */}
            <div
              className="absolute left-0 border-t border-border/40"
              style={{
                top: '50%',
                right: -1000,
                borderStyle: 'dashed',
              }}
            />
          </div>
        );
      })}
    </div>
  );
});
