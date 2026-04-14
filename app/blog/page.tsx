import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { BlogPosts } from "./blog-posts";
import { BlogActionButton } from "./blog-action-button";

export default function BlogPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">家族故事</h1>
          <p className="text-muted-foreground mt-2">
            记录家族故事，传承家族文化
          </p>
        </div>
        <BlogActionButton />
      </div>

      <Suspense fallback={
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="h-full">
              <div className="aspect-video w-full bg-muted animate-pulse rounded-t-lg" />
              <div className="p-4 space-y-3">
                <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                <div className="h-6 w-full bg-muted animate-pulse rounded" />
                <div className="h-4 w-full bg-muted animate-pulse rounded" />
                <div className="h-4 w-2/3 bg-muted animate-pulse rounded" />
              </div>
            </Card>
          ))}
        </div>
      }>
        <BlogPosts />
      </Suspense>
    </div>
  );
}
