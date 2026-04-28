"use client";

import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { FamilyMemberNode } from "./actions";

export interface FamilyNodeData extends FamilyMemberNode {
  isHighlighted?: boolean;
  isPathHighlighted?: boolean;
  isDimmed?: boolean;
  hasChildren?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: (id: number) => void;
  onSpouseClick?: (spouseId: number) => void;
  branchColor?: string;
  [key: string]: unknown;
}

export interface FamilyNodeProps {
  data: FamilyNodeData;
}

function FamilyMemberNodeComponent({ data }: FamilyNodeProps) {
  const nodeData = data;

  // 男性用方形（圆角矩形），女性用椭圆形（方便黑白打印区分）
  const isMale = nodeData.gender === "男";
  const isFemale = nodeData.gender === "女";

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (nodeData.onToggleCollapse) {
      nodeData.onToggleCollapse(nodeData.id);
    }
  };

  return (
    <div
      className={cn(
        "px-1 py-2 text-card-foreground transition-all duration-300 relative group",
        // 变暗模式
        nodeData.isDimmed && "opacity-30 grayscale scale-95 blur-[0.5px]",

        // 背景色统一白色
        "bg-card",

        // 形状：男性圆角矩形，女性椭圆形
        isFemale ? "rounded-full" : "rounded-lg",

        // 边框颜色：男性实线，女性虚线
        nodeData.isHighlighted
          ? "ring-4 ring-amber-400/50 scale-110 z-50 border-2 border-amber-500"
          : nodeData.isPathHighlighted
            ? "shadow-[0_0_10px_rgba(251,191,36,0.4)] z-10 border-2 border-amber-400"
            : isMale
              ? "border-2 border-blue-400 dark:border-blue-500"
              : "border-2 border-pink-400 dark:border-pink-500",

        // 有后代时才有阴影
        nodeData.hasChildren && "shadow-md",

        // 折叠时的额外阴影
        nodeData.hasChildren && nodeData.collapsed && "shadow-lg",

        // 悬浮提升感（有后代时才需要）
        nodeData.hasChildren && "hover:shadow-xl hover:-translate-y-0.5 transition-transform duration-300",

        // 折叠时的堆叠效果
        nodeData.hasChildren && nodeData.collapsed && [
          isFemale
            ? "before:absolute before:inset-0 before:translate-x-1 before:translate-y-1 before:border-2 before:border-muted-foreground/20 before:rounded-full before:-z-10 before:bg-transparent"
            : "before:absolute before:inset-0 before:translate-x-1 before:translate-y-1 before:border-2 before:border-muted-foreground/20 before:rounded-lg before:-z-10",
          isFemale
            ? "after:absolute after:inset-0 after:translate-x-2 after:translate-y-2 after:border-2 after:border-muted-foreground/10 after:rounded-full after:-z-20 after:bg-transparent"
            : "after:absolute after:inset-0 after:translate-x-2 after:translate-y-2 after:border-2 after:border-muted-foreground/10 after:rounded-lg after:-z-20"
        ]
      )}
      style={{ width: 28, minWidth: 28 }}
    >
      {/* 顶部连接点 - 连接到父亲 */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-primary !border-2 !border-background"
      />

      {/* 节点内容 - 纵向排列 */}
      <div className="flex flex-col items-center justify-center">
        <div
          className="font-medium text-sm text-center leading-tight tracking-wide"
          style={{ writingMode: "vertical-rl", textOrientation: "upright" }}
          title={nodeData.name}
        >
          {nodeData.name}
        </div>
      </div>

      {/* 底部连接点 - 仅当有子女时显示 */}
      {nodeData.hasChildren && (
        <Handle
          type="source"
          position={Position.Bottom}
          isConnectable={false}
          className={cn(
            "!w-2 !h-2 !bg-primary !border-2 !border-background",
            nodeData.collapsed && "opacity-0"
          )}
        />
      )}

      {/* 折叠/展开按钮 */}
      {nodeData.hasChildren && (
        <button
          onClick={handleToggle}
          className={cn(
            "absolute -bottom-3 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full border shadow-sm flex items-center justify-center z-[60] transition-all duration-200 cursor-pointer",
            "hover:scale-125 active:scale-90",
            "bg-white/80 dark:bg-gray-800/80 border-gray-300/50 dark:border-gray-600/50 text-gray-500 hover:bg-white dark:hover:bg-gray-800"
          )}
        >
          {nodeData.collapsed ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronUp className="w-3 h-3" />
          )}
        </button>
      )}
    </div>
  );
}

export const FamilyMemberNodeType = memo(FamilyMemberNodeComponent);
