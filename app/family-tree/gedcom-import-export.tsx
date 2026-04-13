"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Download, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { exportFamilyMembersToGedcom, importFamilyMembersFromGedcom } from "./actions";
import { FAMILY_SURNAME } from "@/lib/utils";

interface GedcomImportExportProps {
  onSuccess?: () => void;
}

export function GedcomImportExport({ onSuccess }: GedcomImportExportProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [familyName, setFamilyName] = React.useState(FAMILY_SURNAME);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const resetState = () => {
    setError(null);
    setSuccess(null);
    setIsLoading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      resetState();
    }
  };

  // 导出 GEDCOM
  const handleExport = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await exportFamilyMembersToGedcom(familyName);
      if (result.error) {
        setError(result.error);
      } else {
        // 创建下载链接
        const blob = new Blob([result.content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${familyName}_family.ged`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setSuccess(`GEDCOM 文件已导出`);
      }
    } catch (err) {
      setError("导出失败，请重试");
    } finally {
      setIsLoading(false);
    }
  };

  // 处理 GEDCOM 文件上传
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const content = evt.target?.result as string;
          const result = await importFamilyMembersFromGedcom(content);
          if (result.error) {
            setError(result.error);
          } else {
            setSuccess(`成功导入 ${result.count} 个成员`);
            if (onSuccess) {
              onSuccess();
            }
          }
        } catch (err) {
          setError("导入失败，请检查文件格式");
        } finally {
          setIsLoading(false);
        }
      };
      reader.onerror = () => {
        setError("文件读取失败");
        setIsLoading(false);
      };
      reader.readAsText(file, "UTF-8");
    } catch (err) {
      setError("导入失败，请重试");
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          GEDCOM 导入/导出
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>GEDCOM 导入/导出</DialogTitle>
          <DialogDescription>
            GEDCOM 是家谱数据交换的标准格式，可与其他家谱软件兼容
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>错误</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert variant="default" className="mb-4">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {/* 导出部分 */}
          <div className="space-y-2">
            <h3 className="font-medium">导出 GEDCOM</h3>
            <div className="space-y-2">
              <div className="space-y-1">
                <Label htmlFor="family-name">家族名称</Label>
                <Input
                  id="family-name"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  placeholder="例如：陈"
                />
              </div>
              <Button
                onClick={handleExport}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? "导出中..." : "导出 GEDCOM 文件"}
              </Button>
            </div>
          </div>

          {/* 导入部分 */}
          <div className="border-t pt-4 space-y-2">
            <h3 className="font-medium">导入 GEDCOM</h3>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                选择 .ged 文件进行导入
              </p>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".ged,.GED"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="gedcom-file"
                />
                <Label
                  htmlFor="gedcom-file"
                  className="flex-1 cursor-pointer border border-dashed rounded-md p-4 text-center hover:bg-muted transition-colors"
                >
                  <Upload className="h-6 w-6 mx-auto mb-2" />
                  <span>点击或拖拽文件到此处</span>
                </Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
