"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Transformer } from "markmap-lib";
import { Markmap } from "markmap-view";
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  Download, 
  ChevronDown, 
  ChevronUp,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// markmap 样式已通过 CDN 在 layout 中加载

export interface MarkmapOptions {
  color?: string[];
  colorFreezeLevel?: number;
  duration?: number;
  maxWidth?: number;
  fitRatio?: number;
  showToolbar?: boolean;
  initialExpandLevel?: number;
}

interface MarkmapViewerProps {
  content: string;
  options?: MarkmapOptions;
}

// 解析 frontmatter
function parseFrontmatter(content: string): { options: MarkmapOptions; content: string } {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    return { options: {}, content };
  }
  
  const yamlContent = match[1];
  const markdownContent = match[2];
  
  const options: MarkmapOptions = {};
  
  // 解析 markmap 配置
  const markmapMatch = yamlContent.match(/markmap:\s*\n([\s\S]*?)(?=\n\w|$)/);
  if (markmapMatch) {
    const configText = markmapMatch[1];
    
    // 解析 color
    const colorMatch = configText.match(/color:\s*\n((?:\s+-\s+.*\n)+)/);
    if (colorMatch) {
      options.color = colorMatch[1]
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.replace(/^\s+-\s*/, '').trim());
    }
    
    // 解析 colorFreezeLevel
    const freezeMatch = configText.match(/colorFreezeLevel:\s*(\d+)/);
    if (freezeMatch) {
      options.colorFreezeLevel = parseInt(freezeMatch[1], 10);
    }
    
    // 解析 duration
    const durationMatch = configText.match(/duration:\s*(\d+)/);
    if (durationMatch) {
      options.duration = parseInt(durationMatch[1], 10);
    }
    
    // 解析 maxWidth
    const maxWidthMatch = configText.match(/maxWidth:\s*(\d+)/);
    if (maxWidthMatch) {
      options.maxWidth = parseInt(maxWidthMatch[1], 10);
    }
    
    // 解析 initialExpandLevel
    const expandMatch = configText.match(/initialExpandLevel:\s*(\d+)/);
    if (expandMatch) {
      options.initialExpandLevel = parseInt(expandMatch[1], 10);
    }
  }
  
  // 解析 showToolbar
  const toolbarMatch = yamlContent.match(/showToolbar:\s*(true|false)/);
  if (toolbarMatch) {
    options.showToolbar = toolbarMatch[1] === 'true';
  }
  
  return { options, content: markdownContent };
}

export default function MarkmapViewer({ content, options: propOptions }: MarkmapViewerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const markmapRef = useRef<Markmap | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // 解析 frontmatter 和选项
  const { options, content: markdownContent } = parseFrontmatter(content);
  const mergedOptions = { ...options, ...propOptions };
  const showToolbar = mergedOptions.showToolbar !== false;

  const handleZoomIn = useCallback(() => {
    if (markmapRef.current) {
      markmapRef.current.rescale(1.25);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (markmapRef.current) {
      markmapRef.current.rescale(0.8);
    }
  }, []);

  const handleFit = useCallback(() => {
    if (markmapRef.current) {
      markmapRef.current.fit();
    }
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    
    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.().then(() => {
        setIsFullscreen(true);
        setTimeout(() => handleFit(), 100);
      });
    } else {
      document.exitFullscreen?.().then(() => {
        setIsFullscreen(false);
        setTimeout(() => handleFit(), 100);
      });
    }
  }, [isFullscreen, handleFit]);

  const handleDownloadSVG = useCallback(() => {
    if (!svgRef.current) return;
    
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `markmap-${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const handleDownloadPNG = useCallback(() => {
    if (!svgRef.current) return;
    
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      
      const pngUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = pngUrl;
      link.download = `markmap-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;

    try {
      // 创建 markmap 实例
      if (!markmapRef.current) {
        markmapRef.current = Markmap.create(svgRef.current);
      }

      // 转换 Markdown 为 markmap 数据
      const transformer = new Transformer();
      const { root } = transformer.transform(markdownContent);

      // 构建选项
      const markmapOptions: any = {};
      if (mergedOptions.color) {
        markmapOptions.color = mergedOptions.color;
      }
      if (mergedOptions.colorFreezeLevel !== undefined) {
        markmapOptions.colorFreezeLevel = mergedOptions.colorFreezeLevel;
      }
      if (mergedOptions.duration !== undefined) {
        markmapOptions.duration = mergedOptions.duration;
      }
      if (mergedOptions.maxWidth !== undefined) {
        markmapOptions.maxWidth = mergedOptions.maxWidth;
      }

      // 设置数据并渲染
      markmapRef.current.setData(root);
      markmapRef.current.setOptions(markmapOptions);
      markmapRef.current.fit();
      
      setError(null);
    } catch (err) {
      console.error("Markmap render error:", err);
      setError("思维导图渲染失败");
    }
  }, [markdownContent, mergedOptions]);

  // 监听全屏变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      setTimeout(() => handleFit(), 100);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [handleFit]);

  if (error) {
    return (
      <div className="w-full border rounded-lg overflow-hidden bg-background my-4">
        <div className="px-4 py-2 bg-muted border-b text-sm text-muted-foreground">
          思维导图
        </div>
        <div className="p-8 text-center text-red-500">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`w-full border rounded-lg overflow-hidden bg-background my-4 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}
    >
      {/* 工具栏 */}
      {showToolbar && (
        <div className="px-4 py-2 bg-muted border-b text-sm text-muted-foreground flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="font-medium">思维导图</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-6 w-6 p-0"
            >
              {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
          
          {!isCollapsed && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomIn}
                title="放大"
                className="h-8 w-8 p-0"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomOut}
                title="缩小"
                className="h-8 w-8 p-0"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFit}
                title="适应屏幕"
                className="h-8 w-8 p-0"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleFullscreen}
                title="全屏"
                className="h-8 w-8 p-0"
              >
                <Maximize className="h-4 w-4" />
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    title="下载"
                    className="h-8 w-8 p-0"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleDownloadSVG}>
                    下载 SVG
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDownloadPNG}>
                    下载 PNG
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      )}
      
      {/* 思维导图内容 */}
      {!isCollapsed && (
        <div 
          className="w-full" 
          style={{ height: isFullscreen ? 'calc(100vh - 50px)' : "400px" }}
        >
          <svg 
            ref={svgRef} 
            className="w-full h-full" 
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      )}
    </div>
  );
}
