"use client";

import { useCallback, useMemo, useState, useRef, useEffect, memo, type MouseEvent } from "react";
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

const nodeTypes: NodeTypes = {
  familyMember: FamilyMemberNodeType,
  generationLabel: GenerationNodeType,
};

const edgeTypes = {
  flowing: FlowingEdge,
};

interface FamilyTreeGraphProps {
  initialData: FamilyMemberNode[];
}

interface FamilyTreeGraphInnerProps {
  initialData: FamilyMemberNode[];
  onMemberClick?: (member: FamilyMemberNode) => void;
  onSpouseClick?: (spouseId: number) => void;
}

// 布局常量
const NODE_WIDTH = 160;
const NODE_WIDTH_TINY = 28; // 没有后代的节点使用更小的宽度
const NODE_HEIGHT = 120; // 增加高度以容纳配偶信息
const VERTICAL_GAP = 150; // 代际间距
const SIBLING_GAP = 40; // 亲兄弟姐妹间距
const BRANCH_GAP = 80; // 不同父系分支间距（宽松）
const VERTICAL_GAP = 120; // 代际间距

// 手动布局：按父系分支分组，同父的紧密，不同父的有间距
function getLayoutedElements(
  members: FamilyMemberNode[],
  childrenMap: Map<number, number[]>,
  collapsedIds: Set<number>,
  highlightedId: number | null,
  onToggleCollapse?: (id: number) => void,
  onSpouseClick?: (spouseId: number) => void
): { nodes: Node[]; edges: Edge[] } {
  if (!members.length) {
    return { nodes: [], edges: [] };
  }

  const memberMap = new Map(members.map((m) => [m.id, m]));
  const roots = members.filter(
    (m) => !m.father_id || !memberMap.has(m.father_id)
  );
  const rootGeneration = roots.length > 0 ? (roots[0].generation || 1) : 1;

  // 计算支系颜色
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
  roots.forEach((root, index) => {
    const children = childrenMap.get(root.id) || [];
    children.forEach((childId) => {
      const baseColor = getBranchBaseColor(index);
      setDescendantColors(childId, baseColor);
    });
  });

  // BFS 生成可见列表
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

  // 位置映射
  const positions = new Map<number, { x: number; y: number }>();

  // 计算单个节点的宽度
  const getNodeWidth = (id: number): number => {
    const hasChildren = (childrenMap.get(id)?.length || 0) > 0;
    const isCollapsed = collapsedIds.has(id);
    return (hasChildren && !isCollapsed) ? NODE_WIDTH : NODE_WIDTH_TINY;
  };

  // 找到某个成员的"父系根源"——即他所属的房头（根节点的直接子节点）
  // 所有拥有相同房头的成员属于同一个"支系"
  const getBranchRoot = (member: FamilyMemberNode): number | null => {
    let current = member;
    const visited = new Set<number>();

    while (current.father_id) {
      if (visited.has(current.father_id)) break; // 防止循环
      visited.add(current.id);

      const father = memberMap.get(current.father_id);
      if (!father) break;

      // 如果父亲是根节点的直接子节点，那这就是房头
      if (roots.some(r => r.id === father.id)) {
        return father.id;
      }

      current = father;
    }

    // 如果没有找到房头，返回父亲ID（可能是独立的）
    return current.father_id;
  };

  // 按代布局：同代的按"支系"分组
  // 同一个支系（同房头）的成员紧密排列，不同支系之间有间距
  const generationGroups = new Map<number, { branchRoot: number | null; members: FamilyMemberNode[] }[]>();

  visibleMembers.forEach(member => {
    const gen = member.generation || 1;
    if (!generationGroups.has(gen)) {
      generationGroups.set(gen, []);
    }
    const groups = generationGroups.get(gen)!;

    // 找到成员的支系根源
    const branchRoot = getBranchRoot(member);

    // 找到这个成员属于哪个组
    let group = groups.find(g => g.branchRoot === branchRoot);
    if (!group) {
      group = { branchRoot, members: [] };
      groups.push(group);
    }
    group.members.push(member);
  });

  // 第三步：布局每一代
  const sortedGenerations = Array.from(generationGroups.keys()).sort((a, b) => a - b);

  sortedGenerations.forEach(gen => {
    const groups = generationGroups.get(gen)!;
    let currentX = 0;

    groups.forEach((group, groupIndex) => {
      // 布局这个组的所有成员
      group.members.forEach((member, memberIndex) => {
        const nodeWidth = getNodeWidth(member.id);
        positions.set(member.id, {
          x: currentX + nodeWidth / 2,
          y: (gen - rootGeneration) * VERTICAL_GAP,
        });
        currentX += nodeWidth;
        if (memberIndex < group.members.length - 1) {
          currentX += SIBLING_GAP; // 同支系紧密
        }
      });

      // 不同支系之间有间距
      if (groupIndex < groups.length - 1) {
        currentX += BRANCH_GAP;
      }
    });
  });

  // 转换为中心点到左上角
  visibleMembers.forEach(member => {
    const pos = positions.get(member.id);
    if (pos) {
      const nodeWidth = getNodeWidth(member.id);
      positions.set(member.id, {
        x: pos.x - nodeWidth / 2,
        y: pos.y - NODE_HEIGHT / 2,
      });
    }
  });

  // 生成边
  const edges: Edge[] = [];
  visibleMembers.forEach((member) => {
    if (member.father_id) {
      const fatherExists = visibleMembers.some((m) => m.id === member.father_id);
      if (fatherExists) {
        const baseColor = memberBaseColorMap.get(member.id);
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

  // 生成节点
  let minX = Infinity;
  const generationYMap = new Map<number, { totalY: number; count: number }>();

  const memberNodes: Node[] = visibleMembers.map((member) => {
    const pos = positions.get(member.id) || { x: 0, y: 0 };
    const hasChildren = (childrenMap.get(member.id)?.length || 0) > 0;
    const isCollapsed = collapsedIds.has(member.id);
    const nodeWidth = getNodeWidth(member.id);

    if (pos.x < minX) minX = pos.x;

    if (member.generation) {
      const current = generationYMap.get(member.generation) || { totalY: 0, count: 0 };
      generationYMap.set(member.generation, {
        totalY: current.totalY + pos.y + NODE_HEIGHT / 2,
        count: current.count + 1,
      });
    }

    const baseColor = memberBaseColorMap.get(member.id);
    const genOffset = (member.generation || rootGeneration) - (rootGeneration + 1);
    const nodeColor = baseColor
      ? generateBranchColor(baseColor, Math.max(0, genOffset))
      : undefined;

    const nodeData: FamilyNodeData = {
      ...member,
      isHighlighted: member.id === highlightedId,
      hasChildren,
      collapsed: isCollapsed,
      onToggleCollapse,
      onSpouseClick,
      branchColor: nodeColor,
    };

    return {
      id: String(member.id),
      type: "familyMember",
      position: { x: pos.x, y: pos.y },
      data: nodeData,
    };
  });

  // 生成世代标尺
  const generationNodes: Node[] = [];
  const labelX = minX - 140;

  generationYMap.forEach(({ totalY, count }, generation) => {
    const avgY = totalY / count;
    const labelY = avgY - 40;

    generationNodes.push({
      id: `gen-label-${generation}`,
      type: "generationLabel",
      position: { x: labelX, y: labelY },
      data: {
        generation,
        label: `第${toChineseNum(generation)}世`,
      },
      draggable: false,
      selectable: false,
      zIndex: -1,
    });
  });

  return { nodes: [...memberNodes, ...generationNodes], edges };
}

const FamilyTreeGraphInner = memo(function FamilyTreeGraphInner({ initialData, onMemberClick, onSpouseClick }: FamilyTreeGraphInnerProps) {
  const reactFlowInstance = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  // 本地模式：固定显示本地用户
  const [userEmail] = useState<string>("本地用户");

  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  // 新增：存储高亮路径上的所有元素 ID（节点 ID 和 连线 ID）
  const [highlightedPathIds, setHighlightedPathIds] = useState<Set<string>>(new Set());
  // 新增：搜索结果列表和当前索引
  const [searchResults, setSearchResults] = useState<FamilyMemberNode[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [isSearchPopoverOpen, setIsSearchPopoverOpen] = useState(false);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDraggable, setIsDraggable] = useState(false);

  // 折叠状态管理
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());

  // 构建 childrenMap
  const childrenMap = useMemo(() => {
    const map = new Map<number, number[]>();
    initialData.forEach(m => {
      if (m.father_id) {
        const children = map.get(m.father_id) || [];
        children.push(m.id);
        map.set(m.father_id, children);
      }
    });
    return map;
  }, [initialData]);

  // 计算高亮路径（溯源 + 繁衍）
  useEffect(() => {
    if (!highlightedId) {
      setHighlightedPathIds(new Set());
      return;
    }

    const pathSet = new Set<string>();
    const memberMap = new Map(initialData.map(m => [m.id, m]));

    // 1. 向上溯源 (Ancestors)
    let currentId = highlightedId;
    pathSet.add(String(currentId)); // 添加当前节点

    while (true) {
      const member = memberMap.get(currentId);
      if (!member || !member.father_id) break;

      // 添加父节点 ID
      pathSet.add(String(member.father_id));
      // 添加连接线 ID (注意 edge id 格式是 e{father}-{child})
      pathSet.add(`e${member.father_id}-${currentId}`);

      currentId = member.father_id;
    }

    // 2. 向下繁衍 (Descendants)
    const queue = [highlightedId];
    while (queue.length > 0) {
      const parentId = queue.shift()!;
      const children = childrenMap.get(parentId) || [];

      children.forEach(childId => {
        // 添加子节点 ID
        pathSet.add(String(childId));
        // 添加连接线 ID
        pathSet.add(`e${parentId}-${childId}`);
        // 继续向下遍历
        queue.push(childId);
      });
    }

    setHighlightedPathIds(pathSet);
  }, [highlightedId, initialData, childrenMap]);

  // 处理折叠切换
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

  // 展开所有
  const onExpandAll = useCallback(() => {
    setCollapsedIds(new Set());
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.2, duration: 300 });
    }, 100);
  }, [reactFlowInstance]);

  // 转换数据为节点和边（使用 dagre 自动布局）
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => getLayoutedElements(initialData, childrenMap, collapsedIds, highlightedId, onToggleCollapse, onSpouseClick),
    [initialData, childrenMap, collapsedIds, highlightedId, onToggleCollapse, onSpouseClick]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // 当 initialNodes 变化（例如折叠状态改变），同步更新 nodes
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  // 当 initialEdges 变化，同步更新 edges
  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // 监听高亮路径变化，更新节点和连线的视觉状态
  useEffect(() => {
    const hasHighlight = highlightedId !== null;

    setNodes((nds) =>
      nds.map((node) => {
        // 特殊处理世代标尺节点
        if (node.type === 'generationLabel') {
          return {
            ...node,
            style: {
              ...node.style,
              opacity: hasHighlight ? 0.2 : 1, // 高亮时淡化标尺
              transition: 'opacity 0.3s ease',
            }
          };
        }

        const isPathNode = highlightedPathIds.has(node.id);
        return {
          ...node,
          data: {
            ...node.data,
            isHighlighted: node.id === String(highlightedId), // 仅当前选中节点完全高亮
            isPathHighlighted: isPathNode, // 路径上的节点次级高亮
            isDimmed: hasHighlight && !isPathNode, // 非路径节点变暗
          },
        };
      })
    );

    setEdges((eds) =>
      eds.map((edge) => {
        const isPathEdge = highlightedPathIds.has(edge.id);

        // 动态计算连线样式
        let strokeColor = edge.style?.stroke || "hsl(var(--muted-foreground))";
        let strokeWidth = 2;
        let opacity = 0.6;
        let zIndex = 0;

        if (hasHighlight) {
          if (isPathEdge) {
            strokeColor = "#f59e0b"; // amber-500: 金黄色高亮路径
            strokeWidth = 3; // 加粗
            opacity = 1;
            zIndex = 10; // 浮在最上层
          } else {
            opacity = 0.1; // 极度淡化非相关连线
          }
        }

        return {
          ...edge,
          animated: isPathEdge, // 高亮路径带动画
          style: {
            ...edge.style,
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            opacity: opacity,
          },
          zIndex: zIndex,
        };
      })
    );
  }, [highlightedId, highlightedPathIds, setNodes, setEdges]);

  // 重置视图
  const onResetView = useCallback(() => {
    // 重置节点位置 (重新计算布局，保持折叠状态)
    const { nodes: resetNodes } = getLayoutedElements(initialData, childrenMap, collapsedIds, highlightedId, onToggleCollapse, onSpouseClick);
    setNodes(resetNodes);
    // 重置视图位置，加一点延迟确保节点渲染完成
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.2, duration: 300 });
    }, 10);
  }, [reactFlowInstance, initialData, childrenMap, collapsedIds, highlightedId, setNodes, onToggleCollapse, onSpouseClick]);

  // 搜索功能 - 支持多人搜索
  const onSearch = useCallback(() => {
    if (!searchQuery.trim()) {
      setHighlightedId(null);
      setSearchResults([]);
      setIsSearchPopoverOpen(false);
      return;
    }

    // 查找所有匹配的成员
    const foundMembers = initialData.filter((member) =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    setSearchResults(foundMembers);

    if (foundMembers.length > 0) {
      setCurrentResultIndex(0);
      const found = foundMembers[0];
      
      // 展开必要的节点
      let current = found;
      const idsToExpand = new Set<number>();
      while (current.father_id) {
        if (collapsedIds.has(current.father_id)) {
          idsToExpand.add(current.father_id);
        }
        const father = initialData.find(m => m.id === current.father_id);
        if (!father) break;
        current = father;
      }

      if (idsToExpand.size > 0) {
        setCollapsedIds(prev => {
          const next = new Set(prev);
          idsToExpand.forEach(id => next.delete(id));
          return next;
        });
        setTimeout(() => {
          setHighlightedId(found.id);
        }, 100);
      } else {
        setHighlightedId(found.id);
      }

      // 如果有多个人，打开选择弹窗
      if (foundMembers.length > 1) {
        setIsSearchPopoverOpen(true);
      }
    } else {
      setHighlightedId(null);
      setIsSearchPopoverOpen(false);
    }
  }, [searchQuery, initialData, collapsedIds]);

  // 切换到指定索引的搜索结果
  const goToSearchResult = useCallback((index: number) => {
    if (index < 0 || index >= searchResults.length) return;
    
    setCurrentResultIndex(index);
    const found = searchResults[index];
    
    // 展开必要的节点
    let current = found;
    const idsToExpand = new Set<number>();
    while (current.father_id) {
      if (collapsedIds.has(current.father_id)) {
        idsToExpand.add(current.father_id);
      }
      const father = initialData.find(m => m.id === current.father_id);
      if (!father) break;
      current = father;
    }

    if (idsToExpand.size > 0) {
      setCollapsedIds(prev => {
        const next = new Set(prev);
        idsToExpand.forEach(id => next.delete(id));
        return next;
      });
      setTimeout(() => {
        setHighlightedId(found.id);
      }, 100);
    } else {
      setHighlightedId(found.id);
    }
  }, [searchResults, collapsedIds, initialData]);

  // 上一个搜索结果
  const goToPrevResult = useCallback(() => {
    const newIndex = currentResultIndex > 0 ? currentResultIndex - 1 : searchResults.length - 1;
    goToSearchResult(newIndex);
  }, [currentResultIndex, searchResults.length, goToSearchResult]);

  // 下一个搜索结果
  const goToNextResult = useCallback(() => {
    const newIndex = currentResultIndex < searchResults.length - 1 ? currentResultIndex + 1 : 0;
    goToSearchResult(newIndex);
  }, [currentResultIndex, searchResults.length, goToSearchResult]);

  // 监听 highlight 变化后聚焦
  useEffect(() => {
    if (highlightedId) {
      const node = reactFlowInstance.getNode(String(highlightedId));
      if (node) {
        reactFlowInstance.setCenter(node.position.x + NODE_WIDTH / 2, node.position.y + NODE_HEIGHT / 2, {
          zoom: 1.5,
          duration: 500,
        });
      }
    }
  }, [highlightedId, reactFlowInstance]);

  // 清除搜索
  const onClearSearch = useCallback(() => {
    setSearchQuery("");
    setHighlightedId(null);
    setSearchResults([]);
    setCurrentResultIndex(0);
    setIsSearchPopoverOpen(false);
  }, []);

  // 节点点击事件
  const onNodeClick = useCallback(
    (_: MouseEvent, node: Node) => {
      const member = initialData.find((m) => m.id === Number(node.id));
      if (member && onMemberClick) {
        onMemberClick(member);
      }
    },
    [initialData, onMemberClick]
  );

  // 全屏切换
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

  // 监听全屏变化
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
    // 获取视口元素
    const viewportElem = document.querySelector(
      ".react-flow__viewport"
    ) as HTMLElement;

    if (!viewportElem) return;

    // 计算所有节点的边界
    const bounds = getNodesBounds(nodes);

    // 设置导出图片的尺寸（包含更多内边距，让画面更舒展）
    const imageWidth = bounds.width + 300;
    const imageHeight = bounds.height + 300;

    // 计算变换参数以适应所有节点
    const transform = getViewportForBounds(
      bounds,
      imageWidth,
      imageHeight,
      0.1, // min zoom
      2, // max zoom
      0.15 // padding (增加留白)
    );

    // 1. 预加载背景图片 (Base64)
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

    // 2. 准备 Canvas
    const canvas = document.createElement('canvas');
    canvas.width = imageWidth * 2.0; // Match pixelRatio
    canvas.height = imageHeight * 2.0;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(2.0, 2.0);

    // 白色背景
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, imageWidth, imageHeight);

    // 生成族谱树的透明 PNG 并绘制
    const treeDataUrl = await toPng(viewportElem, {
      width: imageWidth,
      height: imageHeight,
      backgroundColor: null as any,
      style: {
        width: imageWidth.toString(),
        height: imageHeight.toString(),
        transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        backgroundColor: 'transparent', // Explicitly set style bg to transparent
      },
      pixelRatio: 2.0, // 降低到 2.0 兼顾清晰度与体积
      cacheBust: true,
    });

    const treeImg = new Image();
    treeImg.src = treeDataUrl;
    await new Promise((resolve) => {
      treeImg.onload = resolve;
    });

    ctx.drawImage(treeImg, 0, 0, imageWidth, imageHeight);

    // 6. 导出为 JPEG 以大幅压缩体积
    const finalDataUrl = canvas.toDataURL("image/jpeg", 0.85); // 使用 0.85 质量均衡体积与清晰度
    const a = document.createElement("a");
    a.setAttribute("download", `family-tree-${new Date().toISOString().split('T')[0]}.jpg`);
    a.setAttribute("href", finalDataUrl);
    a.click();
  }, [nodes, userEmail]);

  const toggleDraggable = useCallback(() => {
    setIsDraggable((prev) => !prev);
  }, []);

  // 修复：路由切换回来时，强制重新适应视图
  // onInit 中的 fitView 可能因为容器尺寸未就绪而失效
  useEffect(() => {
    const timer = setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.2, duration: 300 });
    }, 100);
    return () => clearTimeout(timer);
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
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onInit={(instance) => {
          // 只在初始化时执行一次 fitView
          instance.fitView({ padding: 0.2 });
        }}
        minZoom={0.1}
        maxZoom={2}
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
        nodesDraggable={isDraggable}
        nodesConnectable={false} // 禁止从节点拖出连线
        edgesFocusable={false}   // 禁止选中连线
      >
        <Controls
          showInteractive={false}
          className="!bg-background !border !border-border !shadow-md [&>button]:!bg-background [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-muted [&>button>svg]:!fill-current"
        />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />

        {/* 顶部统一工具栏：左侧搜索，右侧按钮 */}
        <Panel
          position="top-left"
          className="!absolute !top-0 !left-0 !w-full !m-0 p-2 sm:p-4 flex justify-between items-start pointer-events-none z-10"
        >
          {/* 左侧：搜索框 */}
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
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClearSearch} title="清除搜索内容">
                <X className="h-4 w-4" />
              </Button>
            )}
            {/* 多人搜索结果导航 */}
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
                                (父: {initialData.find(m => m.id === member.father_id)?.name || "未知"})
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
            {/* 单结果提示 */}
            {searchResults.length === 1 && (
              <div className="h-4 w-px bg-border mx-1" />
            )}
            {searchResults.length === 1 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                1/1
              </Badge>
            )}
          </div>

          {/* 右侧：操作按钮组 */}
          <div className="pointer-events-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onResetView}
              title="将视图重置到中心位置并恢复缩放"
              className="bg-background/95 backdrop-blur-sm shadow-sm h-9 w-9 px-0 sm:w-auto sm:px-4"
            >
              <RotateCcw className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">重置</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={toggleFullscreen}
              title={isFullscreen ? "退出全屏模式" : "进入全屏模式"}
              className="bg-background/95 backdrop-blur-sm shadow-sm h-9 w-9 px-0 sm:w-auto sm:px-4"
            >
              {isFullscreen ? (
                <>
                  <Minimize className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">退出全屏</span>
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
                  title="更多操作"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onExpandAll}>
                  <ChevronsDown className="h-4 w-4 mr-2" />
                  展开全部
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

        {/* 统计信息 */}
        <Panel position="bottom-right" className="bg-background/95 backdrop-blur-sm border rounded-md px-3 py-2">
          <span className="text-sm text-muted-foreground">
            共 {initialData.length} 位成员
          </span>
        </Panel>
      </ReactFlow>
    </div>
  );
});

export function FamilyTreeGraph({ initialData }: FamilyTreeGraphProps) {
  const [selectedMember, setSelectedMember] = useState<FamilyMemberNode | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // 获取父亲姓名
  const getFatherName = useCallback(
    (fatherId: number | null) => {
      if (!fatherId) return null;
      const father = initialData.find((m) => m.id === fatherId);
      return father?.name || null;
    },
    [initialData]
  );

  // 处理成员点击
  const handleMemberClick = useCallback((member: FamilyMemberNode) => {
    setSelectedMember(member);
    setIsDetailOpen(true);
  }, []);

  // 处理配偶点击 - 需要查询所有成员（包括嫁入的）
  const handleSpouseClick = useCallback(async (spouseId: number) => {
    // 首先在当前数据中查找
    let spouse: FamilyMemberNode | null | undefined = initialData.find(
      (m) => m.id === spouseId,
    );

    // 如果找不到（嫁入的成员不在 initialData 中），需要额外查询
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
        <FamilyTreeGraphInner initialData={initialData} onMemberClick={handleMemberClick} onSpouseClick={handleSpouseClick} />
      </ReactFlowProvider>

      {/* 成员详情弹窗 */}
      <MemberDetailDialog
        isOpen={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        member={selectedMember}
        fatherName={getFatherName(selectedMember?.father_id || null)}
      />
    </>
  );
}