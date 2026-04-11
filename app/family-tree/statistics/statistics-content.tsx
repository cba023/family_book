import React from "react";
import { fetchFamilyStatistics } from "./actions";
import { StatisticsCharts } from "./charts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { LoginPrompt } from "@/components/login-prompt";

export async function StatisticsContent() {
  const { data, error, requireAuth } = await fetchFamilyStatistics();

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          获取统计数据失败: {error}
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return (
      <div className="text-center text-muted-foreground py-8">暂无数据</div>
    );
  }

  return (
    <>
      <StatisticsCharts data={data} />
      {requireAuth && (
        <div className="mt-6">
          <LoginPrompt message="登录后可查看更多详细统计数据" />
        </div>
      )}
    </>
  );
}
