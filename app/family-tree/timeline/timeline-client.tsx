"use client";

import * as React from "react";
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  Panel,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Search, RotateCcw, ChevronLeft, ChevronRight, Users, X, Lock, LogIn } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TimelineNode, type TimelineNodeData } from "./timeline-node";
import { YearNode, type YearNodeData } from "./year-node";
import { useRouter } from "next/navigation";
import { LoginDialog } from "@/components/login-dialog";
import { refreshSessionAfterLogin } from "@/lib/client/refresh-session-after-login";

interface TimelineMember {
  id: number;
  name: string;
  birthday: string | null;
  death_date: string | null;
  generation: number | null;
}

interface TimelineClientProps {
  initialData: TimelineMember[];
  requireAuth?: boolean;
}

const nodeTypes = {
  timelineMember: TimelineNode,
  yearMarker: YearNode,
} as unknown as NodeTypes;

// Configuration
const PIXELS_PER_YEAR = 60;
const ROW_HEIGHT = 50;
const TRACK_GAP = 2; // years gap between members on same track
const HEADER_HEIGHT = 40;

function TimelineFlow({ initialData, requireAuth }: TimelineClientProps) {
  const router = useRouter();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  // 新增：搜索结果列表和当前索引
  const [searchResults, setSearchResults] = React.useState<Node[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = React.useState(0);
  const [isSearchPopoverOpen, setIsSearchPopoverOpen] = React.useState(false);
  const [loginOpen, setLoginOpen] = React.useState(false);
  const reactFlowInstance = useReactFlow();

  // Process data and calculate layout
  React.useEffect(() => {
    if (!initialData.length) return;

    // 1. Process dates and validity
    const members = initialData
      .filter((m) => m.birthday)
      .map((m) => {
        const startYear = new Date(m.birthday!).getFullYear();
        let endYear = new Date().getFullYear();
        const isAlive = !m.death_date && new Date().getFullYear() - startYear < 100;

        if (m.death_date) {
          endYear = new Date(m.death_date).getFullYear();
        } else if (!isAlive) {
            // Cap reasonable lifespan for visualization if death date missing but assumed dead
            endYear = startYear + 80;
        }

        if (endYear < startYear) endYear = startYear + 1;

        return {
          ...m,
          startYear,
          endYear,
          isAlive,
        };
      })
      .sort((a, b) => a.startYear - b.startYear); // Sort by birth year

    if (members.length === 0) return;

    const minYear = Math.min(...members.map((m) => m.startYear)) - 10;
    const maxYear = Math.max(...members.map((m) => m.endYear)) + 10;

    // 2. Track layout algorithm (Greedy)
    const tracks: number[] = []; // Stores the endYear of the last item in each track
    const memberNodes: Node[] = members.map((member) => {
      let trackIndex = -1;

      // Find first available track
      for (let i = 0; i < tracks.length; i++) {
        if (tracks[i] + TRACK_GAP <= member.startYear) {
          trackIndex = i;
          tracks[i] = member.endYear;
          break;
        }
      }

      // If no track found, create new one
      if (trackIndex === -1) {
        trackIndex = tracks.length;
        tracks.push(member.endYear);
      }

      const width = (member.endYear - member.startYear) * PIXELS_PER_YEAR;
      const x = (member.startYear - minYear) * PIXELS_PER_YEAR;
      const y = trackIndex * ROW_HEIGHT + HEADER_HEIGHT;

      return {
        id: member.id.toString(),
        type: "timelineMember",
        position: { x, y },
        data: {
          name: member.name,
          startYear: member.startYear,
          endYear: member.endYear,
          isAlive: member.isAlive,
          width: Math.max(width, PIXELS_PER_YEAR / 2), // Min width 0.5 year
        } as TimelineNodeData,
      };
    });

    // 3. Generate Year Markers
    const yearNodes: Node[] = [];
    for (let year = Math.floor(minYear / 10) * 10; year <= maxYear; year += 10) {
      yearNodes.push({
        id: `year-${year}`,
        type: "yearMarker",
        position: {
          x: (year - minYear) * PIXELS_PER_YEAR,
          y: -20,
        },
        data: { year } as YearNodeData,
        selectable: false,
        draggable: false,
        zIndex: -1,
      });
    }

    setNodes([...yearNodes, ...memberNodes]);
    
    // Initial Fit View after a short delay to ensure nodes are rendered
    setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.1, duration: 800 });
    }, 100);

  }, [initialData, setNodes, reactFlowInstance]);


  // 搜索功能 - 支持多人搜索
  const onSearch = React.useCallback(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearchPopoverOpen(false);
      // 清除选中状态
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          selected: false,
        }))
      );
      return;
    }

    // 查找所有匹配的节点
    const foundNodes = nodes.filter(
      (n) =>
        n.type === "timelineMember" &&
        (n.data as TimelineNodeData).name.toLowerCase().includes(searchQuery.toLowerCase().trim())
    );

    setSearchResults(foundNodes);

    if (foundNodes.length > 0) {
      setCurrentResultIndex(0);
      const foundNode = foundNodes[0];
      
      reactFlowInstance.setCenter(
        foundNode.position.x + (foundNode.data.width as number) / 2,
        foundNode.position.y,
        { zoom: 1, duration: 800 }
      );
      // Select the node
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          selected: n.id === foundNode.id,
        }))
      );

      // 如果有多个人，打开选择弹窗
      if (foundNodes.length > 1) {
        setIsSearchPopoverOpen(true);
      }
    } else {
      setIsSearchPopoverOpen(false);
    }
  }, [nodes, searchQuery, reactFlowInstance, setNodes]);

  // 切换到指定索引的搜索结果
  const goToSearchResult = React.useCallback((index: number) => {
    if (index < 0 || index >= searchResults.length) return;
    
    setCurrentResultIndex(index);
    const foundNode = searchResults[index];
    
    reactFlowInstance.setCenter(
      foundNode.position.x + (foundNode.data.width as number) / 2,
      foundNode.position.y,
      { zoom: 1, duration: 800 }
    );
    // Select the node
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        selected: n.id === foundNode.id,
      }))
    );
  }, [searchResults, reactFlowInstance, setNodes]);

  // 上一个搜索结果
  const goToPrevResult = React.useCallback(() => {
    const newIndex = currentResultIndex > 0 ? currentResultIndex - 1 : searchResults.length - 1;
    goToSearchResult(newIndex);
  }, [currentResultIndex, searchResults.length, goToSearchResult]);

  // 下一个搜索结果
  const goToNextResult = React.useCallback(() => {
    const newIndex = currentResultIndex < searchResults.length - 1 ? currentResultIndex + 1 : 0;
    goToSearchResult(newIndex);
  }, [currentResultIndex, searchResults.length, goToSearchResult]);

  // 清除搜索
  const clearSearch = React.useCallback(() => {
    setSearchQuery("");
    setSearchResults([]);
    setCurrentResultIndex(0);
    setIsSearchPopoverOpen(false);
    // 清除选中状态
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        selected: false,
      }))
    );
  }, [setNodes]);

  const onReset = React.useCallback(() => {
      reactFlowInstance.fitView({ duration: 500 });
  }, [reactFlowInstance]);

  return (
    <div className="w-full h-[calc(100vh-140px)] bg-background border rounded-lg overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.5 }}
        nodesDraggable={false} // Disable dragging logic nodes
        nodesConnectable={false}
      >
        <Background variant={BackgroundVariant.Lines} gap={PIXELS_PER_YEAR * 10} size={1} className="opacity-20" />
        <Controls 
          showInteractive={false} 
          className="!bg-background !border !border-border !shadow-md [&>button]:!bg-background [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-muted [&>button>svg]:!fill-current"
        />
        <Panel position="top-left" className="flex gap-2">
          <div className="flex items-center gap-2 bg-background/90 p-2 rounded-md border shadow-sm">
            <Input
              placeholder="搜索成员..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
              className="w-48 h-8"
            />
            <Button size="sm" variant="ghost" onClick={onSearch} className="h-8 w-8 p-0">
              <Search className="h-4 w-4" />
            </Button>
            {searchQuery && (
              <Button size="sm" variant="ghost" onClick={clearSearch} className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            )}
            {/* 多人搜索结果导航 */}
            {searchResults.length > 1 && (
              <>
                <div className="h-4 w-px bg-border" />
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
                      {searchResults.map((node, index) => {
                        const data = node.data as TimelineNodeData;
                        return (
                          <button
                            key={node.id}
                            onClick={() => {
                              goToSearchResult(index);
                              setIsSearchPopoverOpen(false);
                            }}
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-center justify-between ${
                              index === currentResultIndex ? "bg-accent" : ""
                            }`}
                          >
                            <span className="font-medium">{data.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {data.startYear}-{data.isAlive ? "今" : data.endYear}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
                <Button size="sm" variant="ghost" onClick={goToPrevResult} className="h-8 w-8 p-0" title="上一个">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={goToNextResult} className="h-8 w-8 p-0" title="下一个">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
            {/* 单结果提示 */}
            {searchResults.length === 1 && (
              <>
                <div className="h-4 w-px bg-border" />
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  1/1
                </Badge>
              </>
            )}
            <div className="h-4 w-px bg-border" />
            <Button size="sm" variant="outline" onClick={onReset} className="h-8 text-xs">
                <RotateCcw className="h-3 w-3 mr-1"/> 重置
            </Button>
          </div>
          {requireAuth && (
            <div className="flex items-center gap-2 bg-background/90 p-2 rounded-md border shadow-sm ml-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">登录后可查看完整时间轴</span>
              <Button size="sm" variant="default" onClick={() => setLoginOpen(true)} className="h-8 text-xs gap-1">
                <LogIn className="h-3 w-3" />
                登录
              </Button>
            </div>
          )}
        </Panel>
      </ReactFlow>
      <LoginDialog
        open={loginOpen}
        onOpenChange={setLoginOpen}
        onSuccess={() => refreshSessionAfterLogin(router)}
      />
    </div>
  );
}

export function TimelineClient(props: TimelineClientProps) {
  return (
    <ReactFlowProvider>
      <TimelineFlow {...props} />
    </ReactFlowProvider>
  );
}