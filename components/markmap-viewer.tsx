"use client";

import { useEffect, useRef } from "react";
import { Transformer } from "markmap-lib";
import { Markmap } from "markmap-view";

interface MarkmapViewerProps {
  content: string;
}

export default function MarkmapViewer({ content }: MarkmapViewerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const markmapRef = useRef<Markmap | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    try {
      if (!markmapRef.current) {
        markmapRef.current = Markmap.create(svgRef.current);
      }

      const transformer = new Transformer();
      const { root } = transformer.transform(content);

      markmapRef.current.setData(root);
      markmapRef.current.fit();
    } catch (err) {
      console.error("Markmap render error:", err);
    }
  }, [content]);

  return (
    <div className="w-full border rounded-lg overflow-hidden bg-background my-4">
      <div className="px-4 py-2 bg-muted border-b text-sm text-muted-foreground">
        思维导图
      </div>
      <div className="w-full" style={{ height: "400px" }}>
        <svg 
          ref={svgRef} 
          className="w-full h-full" 
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </div>
  );
}
