"use client";

import { useMemo, useCallback, useState, useRef, useEffect, memo, useTransition, useDeferredValue } from "react";
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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { hierarchy, tree, type HierarchyPointNode } from "d3-hierarchy";
import { Button } from "@/components/ui/button";
import {
  Maximize,
  Minimize,
  Home,
  Loader2,
  MoreVertical,
  FileCode,
  FileJson,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toSvg } from "html-to-image";
import type { DescendantNode } from "./actions";
import { FamilyMemberNodeType, type FamilyNodeData } from "../graph/family-node";
import { GenerationNodeType } from "../graph/generation-node";
import { FlowingEdge } from "../graph/flowing-edge";
import { MemberDetailDialog } from "../member-detail-dialog";
import { toChineseNum } from "../graph/utils/chinese-num";

// 布局常量（与主世系图保持一致）
const NODE_WIDTH = 44;
const NODE_HEIGHT = 50;
const VERTICAL_GAP = 120;

const nodeTypes: NodeTypes = {
  familyMember: FamilyMemberNodeType,
  generationLabel: GenerationNodeType,
};

const edgeTypes = {
  flowing: FlowingEdge,
};

interface DescendantsTreeGraphProps {
  ancestor: DescendantNode;
  descendants: DescendantNode[];
  descendantCount: number;
  onMemberClick?: (member: DescendantNode) => void;
}

/**
 * 计算后代布局 - 使用 d3-hierarchy 树布局
 */
function computeDescendantsLayout(
  ancestor: DescendantNode,
  descendants: DescendantNode[],
  childrenMap: Map<number, number[]>
): { nodes: Node[]; edges: Edge[] } {
  const memberMap = new Map<number, DescendantNode>();
  memberMap.set(ancestor.id, ancestor);
  descendants.forEach((m) => memberMap.set(m.id, m));

  // 确定可见成员（全部展开）
  const visibleMembers: DescendantNode[] = [];
  const queue = [ancestor];
  const visited = new Set<number>();

  while (queue.length > 0) {
    const member = queue.shift()!;
    if (visited.has(member.id)) continue;

    visited.add(member.id);
    visibleMembers.push(member);

    // 全部展开，不检查折叠状态
    const childIds = childrenMap.get(member.id) || [];
    childIds.forEach((childId) => {
      const child = memberMap.get(childId);
      if (child) queue.push(child);
    });
  }

  // 构建树形结构
  interface TreeNode {
    id: number;
    data: DescendantNode;
    children?: TreeNode[];
  }

  const buildTree = (member: DescendantNode): TreeNode => {
    const childIds = childrenMap.get(member.id) || [];
    const visibleChildren = childIds
      .map((cid) => visibleMembers.find((m) => m.id === cid))
      .filter((m): m is DescendantNode => m !== undefined);

    return {
      id: member.id,
      data: member,
      children: visibleChildren.length > 0 ? visibleChildren.map(c => buildTree(c)) : undefined,
    };
  };

  const root = buildTree(ancestor);

  // 使用 d3-hierarchy
  const hierarchyData = hierarchy<TreeNode>(root, (d) => d.children);
  const treeLayout = tree<TreeNode>()
    .nodeSize([NODE_WIDTH, VERTICAL_GAP])
    .separation((a, b) => a.parent === b.parent ? 1 : 1.2);

  treeLayout(hierarchyData);

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  hierarchyData.each((node) => {
    const member = node.data.data;
    const hasChildren = (node.children?.length || 0) > 0;

      nodes.push({
        id: String(member.id),
        type: "familyMember",
        position: { x: node.x || 0, y: node.y || 0 },
        data: {
          ...member,
          hasChildren,
          collapsed: false,
          hideCollapseButton: true, // 后代页面隐藏折叠按钮
        } as FamilyNodeData,
      });

    if (node.parent) {
      edges.push({
        id: `e-${node.parent.data.id}-${member.id}`,
        source: String(node.parent.data.id),
        target: String(member.id),
        type: "flowing",
        animated: false,
        style: {
          stroke: "hsl(0, 0%, 75%)",
          strokeWidth: 2,
          opacity: 0.6,
        },
      });
    }
  });

  return { nodes, edges };
}

const DescendantsTreeGraphInner = memo(function DescendantsTreeGraphInner({
  ancestor,
  descendants,
  descendantCount,
}: DescendantsTreeGraphProps) {
  const reactFlowInstance = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedMember, setSelectedMember] = useState<DescendantNode | null>(null);
  const [isPending, startTransition] = useTransition();

  // ReactFlow viewport 状态
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const deferredViewport = useDeferredValue(viewport);

  // 构建 familyMap
  const allMembers = useMemo(() => [ancestor, ...descendants], [ancestor, descendants]);

  const familyMap = useMemo(() => {
    const map = new Map<number, DescendantNode>();
    allMembers.forEach((m) => map.set(m.id, m));
    return map;
  }, [allMembers]);

  // 构建 childrenMap
  const childrenMap = useMemo(() => {
    const map = new Map<number, number[]>();
    descendants.forEach((d) => {
      if (d.father_id) {
        if (!map.has(d.father_id)) {
          map.set(d.father_id, []);
        }
        map.get(d.father_id)!.push(d.id);
      }
    });
    return map;
  }, [descendants]);

  // 计算布局（全部展开，无折叠状态）
  const computedLayout = useMemo(() => {
    return computeDescendantsLayout(ancestor, descendants, childrenMap);
  }, [ancestor, descendants, childrenMap]);

  const initialNodes = computedLayout.nodes;
  const initialEdges = computedLayout.edges;

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges || []);

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

  // 同步节点更新
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  const handleFullscreen = useCallback(async () => {
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
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // 导出 JSON
  const onExportJson = useCallback(() => {
    const exportData = {
      exportDate: new Date().toISOString(),
      ancestor: ancestor,
      totalCount: nodes.length,
      members: nodes.map(n => n.data as FamilyNodeData),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("download", `${ancestor.name}的后代世系图-${new Date().toISOString().split("T")[0]}.json`);
    a.setAttribute("href", url);
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, ancestor]);

  // 导出 SVG
  const onExportSvg = useCallback(() => {
    startTransition(async () => {
      const viewportElem = document.querySelector(".react-flow__viewport") as HTMLElement;
      if (!viewportElem) return;

      setIsDownloading(true);
      try {
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
        a.setAttribute("download", `${ancestor.name}的后代世系图-${new Date().toISOString().split("T")[0]}.svg`);
        a.setAttribute("href", url);
        a.click();
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error("导出失败:", error);
      } finally {
        setIsDownloading(false);
      }
    });
  }, [nodes, ancestor]);

  // 初始适应视图
  useEffect(() => {
    setTimeout(() => reactFlowInstance.fitView({ padding: 0.2 }), 100);
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
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.1}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        onNodeClick={(_, node) => {
          const member = familyMap.get(parseInt(node.id));
          if (member) setSelectedMember(member);
        }}
        onMove={(_, viewport) => {
          setViewport(viewport);
        }}
        onInit={(instance) => {
          setViewport(instance.getViewport());
          instance.fitView({ padding: 0.2 });
        }}
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
          {/* 左侧信息 */}
          <div className="pointer-events-auto bg-background/95 backdrop-blur-sm border rounded-md px-3 py-2 shadow-sm">
            <div className="text-sm">
              <div className="font-medium">{ancestor.name} 的后代</div>
              <div className="text-muted-foreground">共 {descendantCount} 人</div>
            </div>
          </div>

          {/* 右侧按钮 */}
          <div className="pointer-events-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleFullscreen}
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
                    const rootNode = nodes.find(n => n.id === String(ancestor.id));
                    if (rootNode && reactFlowInstance) {
                      reactFlowInstance.setCenter(
                        rootNode.position.x + 50,
                        rootNode.position.y + 30,
                        { zoom: 1, duration: 300 }
                      );
                    }
                  }}
                >
                  <Home className="h-4 w-4 mr-2" />
                  定位祖先
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onExportJson}>
                  <FileJson className="h-4 w-4 mr-2" />
                  导出JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onExportSvg} disabled={isDownloading}>
                  <FileCode className="h-4 w-4 mr-2" />
                  导出 SVG
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Panel>

        {/* 右下角统计 */}
        <Panel position="bottom-right" className="bg-background/95 backdrop-blur-sm border rounded-md px-3 py-2 outline-none">
          <span className="text-sm text-muted-foreground select-none">
            共 {descendantCount} 位后代（显示 {nodes.length} 个节点）
          </span>
        </Panel>

        {/* 加载遮罩 */}
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
              <span className="text-xs text-muted-foreground/70">请稍候...</span>
            </div>
          </div>
        )}
      </ReactFlow>

      {selectedMember && (
        <MemberDetailDialog
          member={selectedMember as any}
          isOpen={!!selectedMember}
          onOpenChange={(open) => !open && setSelectedMember(null)}
          fatherName={selectedMember.father_id ? familyMap.get(selectedMember.father_id)?.name : undefined}
        />
      )}
    </div>
  );
});

export function DescendantsTreeGraph(props: DescendantsTreeGraphProps) {
  return (
    <ReactFlowProvider>
      <DescendantsTreeGraphInner {...props} />
    </ReactFlowProvider>
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
