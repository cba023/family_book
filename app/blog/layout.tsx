import { Suspense } from "react";
import { BlogHeader } from "./blog-header";

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <Suspense fallback={
        <header className="border-b">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6">
            <div className="h-6 w-24 bg-muted animate-pulse rounded" />
            <div className="hidden md:flex items-center gap-6">
              <div className="h-4 w-16 bg-muted animate-pulse rounded" />
              <div className="h-4 w-16 bg-muted animate-pulse rounded" />
              <div className="h-4 w-16 bg-muted animate-pulse rounded" />
            </div>
            <div className="flex items-center gap-4">
              <div className="h-8 w-8 bg-muted animate-pulse rounded" />
              <div className="h-9 w-32 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </header>
      }>
        <BlogHeader />
      </Suspense>

      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
