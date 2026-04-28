"use client";

import { useCallback, useMemo, useState, useRef, useEffect, memo, useTransition, useDeferredValue } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
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
import { hierarchy, tree, type HierarchyPointNode } from "d3-hierarchy";
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
  ChevronsUp,
  Lock,
  Unlock,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Users,
  Home,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Image,
  FileCode,
  FileJson,
  FileText,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { toPng, toSvg } from "html-to-image";
import { FamilyMemberNodeType, type FamilyNodeData } from "./family-node";
import { GenerationNodeType } from "./generation-node";
import { toChineseNum } from "./utils/chinese-num";
import { getBranchBaseColor, generateBranchColor, type HSLColor } from "./utils/colors";
import { FlowingEdge } from "./flowing-edge";
import type { FamilyMemberNode } from "./actions";
import { MemberDetailDialog } from "../member-detail-dialog";
import { FAMILY_SURNAME } from "@/lib/utils";

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
  visibleGenerations?: number; // 默认展开的代数
  onMemberClick?: (member: FamilyMemberNode) => void;
  onSpouseClick?: (spouseId: number) => void;
}

// 布局常量
const NODE_WIDTH = 44;
const NODE_WIDTH_TINY = 28; // 没有后代的节点使用更小的宽度
const NODE_HEIGHT = 50;
const HORIZONTAL_GAP = 12; // 亲兄弟姐妹间距
const VERTICAL_GAP = 120; // 代际间距

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
 * 增量布局计算 - 使用 d3-hierarchy 树布局
 */
function getIncrementalLayout(
  allMembers: FamilyMemberNode[],
  childrenMap: Map<number, number[]>,
  collapsedIds: Set<number>,
  changedIds: Set<number>,
  layoutCache: CachedLayout | null,
  visibleGenerations: number,
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

  // 构建树形结构
  interface TreeNode {
    id: number;
    data: FamilyMemberNode;
    children?: TreeNode[];
  }

  // 收集每个节点的所有可见子女（存储成员对象）
  const nodeChildren = new Map<number, FamilyMemberNode[]>();

  visibleMembers.forEach(member => {
    const allChildren = childrenMap.get(member.id) || [];
    const visibleChildren = allChildren
      .map(cid => visibleMembers.find(m => m.id === cid))
      .filter((m): m is FamilyMemberNode => m !== undefined)
      .filter(() => !collapsedIds.has(member.id));
    nodeChildren.set(member.id, visibleChildren);
  });

  // 递归构建树
  function buildTree(member: FamilyMemberNode): TreeNode {
    const children = nodeChildren.get(member.id) || [];
    return {
      id: member.id,
      data: member,
      children: children.length > 0 ? children.map(c => buildTree(c)) : undefined,
    };
  }

  // 创建布局
  // tree() 的 x 是水平方向（兄弟从左到右），y 是垂直方向（代际从上到下）
  // nodeSize([y间距, x间距]) - 垂直间距大一些
  const treeLayout = tree<TreeNode>()
    .nodeSize([NODE_WIDTH, VERTICAL_GAP])  // [x间距(兄弟), y间距(代际)]
    .separation((a, b) => a.parent === b.parent ? 1 : 1.2);

  // 构建根节点（处理多个根）
  let rootNode: TreeNode;
  if (roots.length === 1) {
    rootNode = buildTree(roots[0]);
  } else {
    // 多个根用虚拟根包裹
    rootNode = {
      id: -1,
      data: null as any,
      children: roots.map(r => buildTree(r)),
    };
  }

  // 计算布局
  const d3Root = hierarchy(rootNode);
  treeLayout(d3Root);

  // 提取位置
  const newPositions = new Map<number, { x: number; y: number }>();

  d3Root.each((node) => {
    if (node.data.id === -1) return; // 跳过虚拟根
    const pointNode = node as HierarchyPointNode<TreeNode>;
    // d3.tree: node.x 是水平方向（兄弟从左到右），node.y 是垂直方向（代际从上到下）
    newPositions.set(pointNode.data.id, { x: pointNode.x, y: pointNode.y });
  });

  // 构建边（只在父子都在可见列表中时）
  const edges: Edge[] = [];
  visibleMembers.forEach((member) => {
    if (member.father_id) {
      const fatherExists = visibleMembers.some((m) => m.id === member.father_id);
      if (fatherExists) {
        const edgeColor = "hsl(0, 0%, 75%)";

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

  // 转换为节点，同时记录每个世代的Y范围
  let minX = Infinity;
  const generationYRange = new Map<number, { minY: number; maxY: number; count: number; label: string }>();
  visibleMembers.forEach((member) => {
    const pos = newPositions.get(member.id)!;
    const hasChildren = (childrenMap.get(member.id)?.length || 0) > 0;
    const isCollapsed = collapsedIds.has(member.id);
    const nodeWidth = hasChildren && !isCollapsed ? NODE_WIDTH : NODE_WIDTH_TINY;
    const nodeHeight = NODE_HEIGHT;

    if (pos.x < minX) minX = pos.x;

    if (member.generation) {
      const label = toChineseNum(member.generation);
      const current = generationYRange.get(member.generation);
      const centerY = pos.y + nodeHeight / 2;
      if (current) {
        current.minY = Math.min(current.minY, centerY);
        current.maxY = Math.max(current.maxY, centerY);
        current.count++;
      } else {
        generationYRange.set(member.generation, {
          minY: centerY,
          maxY: centerY,
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
  visibleGenerations,
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
  const deferredViewport = useDeferredValue(viewport);

  // 默认折叠超过配置代数的节点
  const effectiveVisibleGenerations = visibleGenerations ?? DEFAULT_VISIBLE_GENERATIONS;
  const initialCollapsedIds = useMemo(() => {
    const collapsed = new Set<number>();
    initialData.forEach((m) => {
      if (m.generation && m.generation > effectiveVisibleGenerations) {
        collapsed.add(m.id);
      }
    });
    return collapsed;
  }, [initialData, effectiveVisibleGenerations]);
  
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(initialCollapsedIds);
  const [isPending, startTransition] = useTransition();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });

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

  // 折叠切换（展开只显示下一级，收起隐藏自己和所有子孙）
  const onToggleCollapse = useCallback((id: number) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        // 展开：显示自己，显示直接子女，收起孙辈及更深的
        next.delete(id);

        const children = childrenMap.get(id) || [];
        children.forEach(childId => {
          // 收起每个直接子女的子孙
          const collapseChildren = (parentId: number) => {
            const grandchildren = childrenMap.get(parentId) || [];
            grandchildren.forEach(gcId => {
              next.add(gcId);
              collapseChildren(gcId);
            });
          };
          collapseChildren(childId);
        });
      } else {
        // 收起：隐藏自己和所有子孙
        const collapseSubtree = (parentId: number) => {
          const children = childrenMap.get(parentId) || [];
          children.forEach(childId => {
            next.add(childId);
            collapseSubtree(childId);
          });
        };
        next.add(id);
        collapseSubtree(id);
      }

      return next;
    });
  }, [childrenMap]);

  // 计算根节点
  const roots = useMemo(() => {
    return (allData || initialData).filter((m) => !m.father_id || !allMembersMap.has(m.father_id));
  }, [allData, initialData, allMembersMap]);

  // 增量布局计算
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const changedIds = new Set<number>();

    const { nodes, edges, cache } = getIncrementalLayout(
      initialData,
      childrenMap,
      collapsedIds,
      changedIds,
      layoutCacheRef.current,
      effectiveVisibleGenerations,
      onToggleCollapse
    );
    layoutCacheRef.current = cache;

    return { nodes, edges };
  }, [initialData, childrenMap, collapsedIds, effectiveVisibleGenerations]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // 计算 generationYRange
  const generationYRange = useMemo(() => {
    if (nodes.length === 0) return new Map();
    const rangeMap = new Map<number, { minY: number; maxY: number; count: number; label: string }>();
    nodes.forEach((node) => {
      const data = node.data as FamilyNodeData;
      if (data?.generation) {
        const label = toChineseNum(data.generation);
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

  // 检测移动设备
  const isMobile = useMediaQuery("(max-width: 768px)");

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

  // 展开所有（使用 startTransition 保持 UI 响应）
  const onExpandAll = useCallback(() => {
    startTransition(() => {
      setCollapsedIds(new Set());
    });
  }, []);

  // 收起所有
  const onCollapseAll = useCallback(() => {
    setCollapsedIds(new Set([...initialData.map(m => m.id)]));
  }, [initialData]);

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

  // 导出 JSON 数据
  const onExportJson = useCallback(() => {
    const exportData = {
      exportDate: new Date().toISOString(),
      totalCount: nodes.length,
      members: nodes.map(n => (n.data as FamilyNodeData).originalData || n.data),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("download", `family-tree-data-${new Date().toISOString().split("T")[0]}.json`);
    a.setAttribute("href", url);
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes]);

  // 导出 SVG (保持原样)
  const onExportSvg = useCallback(() => {
    startDownload(async () => {
      const viewportElem = document.querySelector(".react-flow__viewport") as HTMLElement;
      if (!viewportElem) return;

      const bounds = getNodesBounds(nodes);
      const padding = 50;
      const width = bounds.width + padding * 2;
      const height = bounds.height + padding * 2;

      const svgDataUrl = await toSvg(viewportElem, {
        width,
        height,
        backgroundColor: "transparent",
        style: {
          width: width.toString(),
          height: height.toString(),
          transform: `translate(${-bounds.x + padding}px, ${-bounds.y + padding}px) scale(1)`,
          fontFamily: "system-ui, -apple-system, sans-serif",
        },
        cacheBust: true,
      });

      const blob = await fetch(svgDataUrl).then(r => r.blob());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.setAttribute("download", `family-tree-${new Date().toISOString().split("T")[0]}.svg`);
      a.setAttribute("href", url);
      a.click();
      URL.revokeObjectURL(url);
    });
  }, [nodes]);

  // 导出 Markdown (树形结构)
  const onExportMarkdown = useCallback(() => {
    const nodesData = nodes.map(n => n.data as FamilyNodeData);
    
    // 构建 id -> node 映射
    const nodeMap = new Map<number, FamilyNodeData>();
    nodesData.forEach(node => {
      if (node.id) nodeMap.set(node.id, node);
    });

    // 查找根节点（没有父节点或父节点不在列表中的）
    const rootNodes = nodesData.filter(node => 
      !node.father_id || !nodeMap.has(node.father_id)
    );

    // 按世代排序（祖先在前）
    const sortedRoots = rootNodes.sort((a, b) => (a.generation ?? 0) - (b.generation ?? 0));

    // 获取子女并按长房顺序排序
    const getChildren = (parentId: number): FamilyNodeData[] => {
      return nodesData
        .filter(node => node.father_id === parentId)
        .sort((a, b) => (a.sibling_order ?? 0) - (b.sibling_order ?? 0));
    };

    // 递归构建树形 Markdown
    const buildTree = (members: FamilyNodeData[], indent: number): string => {
      let md = "";
      for (const member of members) {
        const prefix = "  ".repeat(indent);
        const spouse = member.spouse ? ` & ${member.spouse}` : "";
        const birthDeath = [member.birthYear, member.deathYear].filter(Boolean).join(" - ");
        const lifeInfo = birthDeath ? ` (${birthDeath})` : "";
        
        md += `${prefix}- ${member.name}${spouse}${lifeInfo}\n`;
        
        const children = getChildren(member.id);
        if (children.length > 0) {
          md += buildTree(children, indent + 1);
        }
      }
      return md;
    };

    // 生成 Markdown
    let md = `# ${FAMILY_SURNAME}氏世系图\n\n`;
    md += `> 共 ${nodes.length} 位成员 | 导出日期: ${new Date().toLocaleDateString("zh-CN")}\n\n`;
    md += "---\n\n";

    md += buildTree(sortedRoots, 0);

    md += "\n---\n\n";
    md += `*由${FAMILY_SURNAME}氏族谱管理系统生成*\n`;

    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("download", `family-tree-${new Date().toISOString().split("T")[0]}.md`);
    a.setAttribute("href", url);
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes]);


  // 下载图片的异步处理
  const startDownload = useCallback(async (fn: (setProgress: (current: number, total: number) => void) => Promise<void>) => {
    setIsDownloading(true);
    setDownloadProgress({ current: 0, total: 0 });
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await fn((current, total) => setDownloadProgress({ current, total }));
    } catch (error) {
      console.error("下载图片失败:", error);
    } finally {
      setIsDownloading(false);
      setDownloadProgress({ current: 0, total: 0 });
    }
  }, []);

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
      className="w-full h-[calc(100vh-200px)] min-h-[500px] border rounded-lg bg-background relative flex"
    >
      {/* 世代标尺 - 画布左侧外部 */}
      <div className="w-6 flex-shrink-0 border-r border-border bg-muted/30">
        <GenerationRuler generationYRange={generationYRange} viewport={deferredViewport} />
      </div>

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
          className="!bg-background !border !border-border !shadow-md [&>button]:!bg-background [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-muted [&>button>svg]:!fill-current max-md:!hidden"
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
                <DropdownMenuItem
                  onClick={() => {
                    const rootNode = nodes.find(n => n.id === String(roots[0]?.id));
                    if (rootNode && reactFlowInstance) {
                      reactFlowInstance.setCenter(rootNode.position.x + 50, rootNode.position.y + 30, {
                        zoom: 1,
                        duration: 300,
                      });
                    }
                  }}
                >
                  <Home className="h-4 w-4 mr-2" />
                  定位始祖
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    if (collapsedIds.size === 0) {
                      // 当前是全部展开状态，收起
                      setCollapsedIds(initialCollapsedIds);
                    } else {
                      // 当前是收起状态，展开
                      if (collapsedIds.size <= 100 || confirm("展开全部可能会导致页面卡顿，你确定要展开全部吗？")) {
                        onExpandAll();
                      }
                    }
                  }}
                >
                  {collapsedIds.size === 0 ? (
                    <>
                      <ChevronsUp className="h-4 w-4 mr-2" />
                      展示前{effectiveVisibleGenerations}世
                    </>
                  ) : (
                    <>
                      <ChevronsDown className="h-4 w-4 mr-2" />
                      展开全部
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onExportJson}>
                  <FileJson className="h-4 w-4 mr-2" />
                  导出JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onExportMarkdown}>
                  <FileText className="h-4 w-4 mr-2" />
                  导出 Markdown
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onExportSvg} disabled={isDownloading}>
                  <FileCode className="h-4 w-4 mr-2" />
                  导出 SVG
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

        {/* 加载遮罩（展开全部或下载图片时） */}
        {isPending && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm pointer-events-auto">
            <div className="flex flex-col items-center gap-2 max-w-xs text-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">加载中</span>
              <span className="text-xs text-muted-foreground/70">可能数据量比较大，请耐心等待...</span>
            </div>
          </div>
        )}

        {/* 下载图片时的加载遮罩 */}
        {isDownloading && !isPending && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm pointer-events-none">
            <div className="flex flex-col items-center gap-3 max-w-xs text-center bg-background/80 rounded-lg px-6 py-4 shadow-lg">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">正在生成图片...</span>
              {downloadProgress.total > 1 ? (
                <>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all duration-300"
                      style={{ width: `${(downloadProgress.current / downloadProgress.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground/70">
                    第 {downloadProgress.current} / {downloadProgress.total} 块
                  </span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground/70">请稍候...</span>
              )}
              <span className="text-xs text-muted-foreground/50">节点数: {nodes.length}</span>
            </div>
          </div>
        )}
      </ReactFlow>
    </div>
  );
});

/**
 * 虚拟化世系图容器 - 负责数据加载和状态管理
 */
export function VirtualizedFamilyTreeGraph({ initialData, totalCount, visibleGenerations, onMemberClick, onSpouseClick }: VirtualizedFamilyTreeGraphProps) {
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
          visibleGenerations={visibleGenerations}
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
    <div className="relative h-full w-full overflow-hidden">
      {sortedGenerations.map(([generation, { minY, maxY, label }]) => {
        const centerY = minY + (maxY - minY) / 2;
        const topY = minY;
        const bottomY = maxY + NODE_HEIGHT;

        return (
          <div
            key={generation}
            className="absolute left-0 right-0 flex justify-center"
            style={{
              top: centerY * viewport.zoom + viewport.y,
              transform: 'translateY(-50%)',
              height: (bottomY - topY) * viewport.zoom,
            }}
          >
            <span className="font-medium text-foreground/70 text-[10px]">{label}</span>
          </div>
        );
      })}
    </div>
  );
});

