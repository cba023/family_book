"use client";

import { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Loader2, GitBranch } from "lucide-react";

interface VisibleGenerationsSettingsProps {
  initialValue: number;
}

export function VisibleGenerationsSettings({ initialValue }: VisibleGenerationsSettingsProps) {
  const [value, setValue] = useState(String(initialValue));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setValue(String(initialValue));
  }, [initialValue]);

  const handleSave = () => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1 || num > 20) {
      setError("请输入 1-20 之间的数字");
      return;
    }

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        const { updateVisibleGenerationsSetting } = await import("@/app/family-tree/actions");
        const result = await updateVisibleGenerationsSetting(num);
        if (result.success) {
          setSuccess(`已保存！世系图将默认展示前 ${num} 世。刷新页面后生效。`);
        } else {
          setError(result.error || "保存失败");
        }
      } catch (e) {
        setError("保存时发生错误");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="h-5 w-5" />
          世系图默认展开代数
        </CardTitle>
        <CardDescription>
          设置世系图首次加载时默认展开的代数范围。超过此范围的节点将自动折叠。
          例如设置为 8，则第 9 世及以后的成员默认折叠。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-4">
          <div className="space-y-2 w-32">
            <Label htmlFor="visible-generations">默认展示代数</Label>
            <Input
              id="visible-generations"
              type="number"
              min={1}
              max={20}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={isPending}
            />
          </div>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              "保存"
            )}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-500 text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
