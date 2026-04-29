"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function BackToGraphLink() {
  return (
    <button
      onClick={() => window.close()}
      className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ChevronLeft className="w-4 h-4 mr-1" />
      返回世系图
    </button>
  );
}
