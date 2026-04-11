"use client";

import React from "react";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import "highlight.js/styles/github.css";

// 动态导入 Markmap 组件，避免 SSR 问题
const MarkmapViewer = dynamic(() => import("./markmap-viewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-96 border rounded-lg bg-muted/20 animate-pulse flex items-center justify-center">
      <span className="text-muted-foreground">加载思维导图...</span>
    </div>
  ),
});

interface MarkdownContentProps {
  content: string;
}

export default function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="prose prose-slate max-w-none dark:prose-invert">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeHighlight]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-3xl font-bold mt-8 mb-4">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-2xl font-semibold mt-6 mb-3 border-b pb-2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xl font-semibold mt-4 mb-2">{children}</h3>
          ),
          p: ({ children }) => <p className="mb-4 leading-relaxed">{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-4 space-y-1">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="ml-4">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary pl-4 italic my-4 text-muted-foreground">
              {children}
            </blockquote>
          ),
          pre: ({ children, ...props }) => {
            // 检查子元素是否是 markmap 代码块
            const childArray = React.Children.toArray(children);
            const codeElement = childArray[0] as
              | React.ReactElement<{ className?: string; children?: React.ReactNode }>
              | undefined;

            const className =
              typeof codeElement?.props?.className === "string"
                ? codeElement.props.className
                : "";

            if (className.includes("markmap") && codeElement) {
              const content = String(codeElement.props.children).replace(/\n$/, "");
              return <MarkmapViewer content={content} />;
            }
            return <pre className="bg-muted rounded-lg p-4 overflow-x-auto my-4" {...props}>{children}</pre>;
          },
          code: ({ children, className }) => {
            const isInline = !className;
            return isInline ? (
              <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">
                {children}
              </code>
            ) : (
              <code className={className}>{children}</code>
            );
          },
          a: ({ children, href }) => (
            <a
              href={href}
              className="text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          img: ({ src, alt }) => {
            // 检查是否是视频文件
            const srcStr = typeof src === "string" ? src : "";
            if (srcStr.match(/\.(mp4|webm|mov|mkv)$/i)) {
              return (
                <video
                  src={srcStr}
                  controls
                  className="rounded-lg max-w-full h-auto my-4"
                  style={{ maxHeight: '500px' }}
                >
                  您的浏览器不支持视频播放
                </video>
              );
            }
            return (
              <img
                src={srcStr || undefined}
                alt={alt}
                className="rounded-lg max-w-full h-auto my-4"
              />
            );
          },
          // 支持 iframe 嵌入（YouTube/Bilibili 等）
          iframe: ({ src, width, height }) => (
            <div className="relative w-full my-4" style={{ paddingBottom: '56.25%' }}>
              <iframe
                src={src}
                width={width || '100%'}
                height={height || '100%'}
                className="absolute top-0 left-0 w-full h-full rounded-lg"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border-collapse border border-border">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border border-border px-4 py-2 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-4 py-2">{children}</td>
          ),
          hr: () => <hr className="my-8 border-border" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
