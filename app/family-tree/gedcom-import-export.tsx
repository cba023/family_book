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
import { Upload, Download, AlertCircle, FileText } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { exportFamilyMembersToGedcom, importFamilyMembersFromGedcom, exportFamilyMembersToJson } from "./actions";
import { FAMILY_SURNAME } from "@/lib/utils";
import { optionalTrunc, remarksToPlainText } from "@/lib/remarks-plain-text";

interface GedcomImportExportProps {
  onSuccess?: () => void;
}

interface FamilyMember {
  id: number;
  name: string;
  generation: number | null;
  sibling_order: number | null;
  father_name: string | null;
  gender: "男" | "女" | null;
  official_position: string | null;
  is_alive: boolean;
  spouse_name: string | null;
  spouse_names?: string[];
  is_married_in: boolean;
  remarks: string | null;
  birthday: string | null;
  death_date: string | null;
  residence_place: string | null;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

  // 导出 PDF - 使用 html2canvas 和 jspdf 生成中文 PDF
  const handleExportPDF = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // 从数据库获取真实数据
      const result = await exportFamilyMembersToJson();
      if (result.error) {
        setError(result.error);
        setIsLoading(false);
        return;
      }

      const members = result.data;
      if (members.length === 0) {
        setError("暂无族谱数据可导出");
        setIsLoading(false);
        return;
      }

      // 动态导入库
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      
      const exportTime = new Date().toLocaleString("zh-CN");
      const timestamp = new Date().toISOString().split("T")[0];

      /** 名录每页约 35～40 人（与 html2canvas 固定高度匹配） */
      const ROSTER_PER_PAGE = 38;

      // 生成目录 HTML
      const tocHtml = members
        .map((member, index) => {
          const gender =
            member.gender === "男" ? "男" : member.gender === "女" ? "女" : null;
          const generation = member.generation ? `第${member.generation}世` : null;
          const infoParts = [generation, gender].filter(Boolean);
          const info = infoParts.length > 0 ? ` (${infoParts.join("  ")})` : "";
          return `<p style="margin: 6px 0; break-inside: avoid;">${index + 1}. ${escHtml(member.name)}${escHtml(info)}</p>`;
        })
        .join("");

      const pages: string[] = [];
      
      // 封面
      pages.push(`
        <div style="width: 595px; height: 842px; padding: 40px; box-sizing: border-box; background: white; font-family: 'Noto Sans SC', 'Microsoft YaHei', 'SimHei', sans-serif; position: relative; overflow: hidden;">
          <div style="text-align: center; padding-top: 150px;">
            <h1 style="font-size: 42px; color: #8B4513; margin-bottom: 30px; font-weight: bold; letter-spacing: 8px;">
              ${escHtml(familyName)}氏族谱
            </h1>
            <p style="font-size: 16px; color: #666; margin-bottom: 15px;">
              共收录 ${members.length} 位族人
            </p>
            <p style="font-size: 13px; color: #999;">
              导出时间：${escHtml(exportTime)}
            </p>
            <p style="font-size: 11px; color: #888; margin-top: 16px;">
              正文为密排名录（多人一页）；生平并入各行；无信息项不显示。
            </p>
          </div>
          <div style="position: absolute; bottom: 60px; left: 0; right: 0; text-align: center;">
            <p style="font-size: 12px; color: #ccc; transform: rotate(-15deg); opacity: 0.3;">
              ${escHtml(familyName)}氏族谱 · ${escHtml(timestamp)}
            </p>
          </div>
        </div>
      `);

      // 目录
      pages.push(`
        <div style="width: 595px; min-height: 842px; padding: 40px; box-sizing: border-box; background: white; font-family: 'Noto Sans SC', 'Microsoft YaHei', 'SimHei', sans-serif; position: relative; overflow: hidden;">
          <h2 style="font-size: 26px; text-align: center; margin-bottom: 30px; color: #333; font-weight: bold;">
            目  录
          </h2>
          <div style="font-size: 12px; line-height: 1.55; column-count: 2; column-gap: 28px;">
            ${tocHtml}
          </div>
          <div style="position: absolute; bottom: 30px; right: 40px; font-size: 10px; color: #ccc; transform: rotate(-15deg); opacity: 0.3;">
            ${escHtml(familyName)}氏族谱 · ${escHtml(timestamp)}
          </div>
        </div>
      `);

      // 族人一览：多人一页（不再一人一页）
      const rosterChunks = chunkArray(members, ROSTER_PER_PAGE);
      rosterChunks.forEach((chunk, pi) => {
        const sub =
          rosterChunks.length > 1
            ? `（${pi + 1}/${rosterChunks.length}）`
            : "";
        const rows = chunk
          .map((member, i) => {
            const globalIdx = pi * ROSTER_PER_PAGE + i + 1;
            const spouses = (member.spouse_names || []).join("、");
            const nm =
              optionalTrunc(member.name, 18) ??
              (member.id != null ? `ID${member.id}` : "未命名");
            const parts: string[] = [`${globalIdx}.`, nm];
            const g = optionalTrunc(member.gender, 2);
            if (g) parts.push(g);
            if (member.generation != null && String(member.generation).trim() !== "") {
              parts.push(`第${member.generation}世`);
            }
            if (
              member.sibling_order != null &&
              String(member.sibling_order).trim() !== ""
            ) {
              parts.push(`行${member.sibling_order}`);
            }
            const father = optionalTrunc(member.father_name, 10);
            if (father) parts.push(`父:${father}`);
            const sp = optionalTrunc(spouses, 18);
            if (sp) parts.push(`配:${sp}`);
            const birth = optionalTrunc(member.birthday, 12);
            if (birth) parts.push(`生:${birth}`);
            if (!member.is_alive) {
              const d = optionalTrunc(member.death_date, 12);
              if (d) parts.push(`卒:${d}`);
            }
            const place = optionalTrunc(member.residence_place, 12);
            if (place) parts.push(`居:${place}`);
            const job = optionalTrunc(member.official_position, 10);
            if (job) parts.push(`职:${job}`);
            const life = remarksToPlainText(member.remarks);
            const lifeOne = optionalTrunc(life.replace(/\n/g, " "), 52);
            if (lifeOne) parts.push(`事:${lifeOne}`);
            const line = parts.join("　");
            return `<div style="font-size:8.5px;line-height:11px;color:#222;margin:0;padding:0;">${escHtml(line)}</div>`;
          })
          .join("");
        pages.push(`
          <div style="width: 595px; min-height: 842px; padding: 22px 26px; box-sizing: border-box; background: white; font-family: 'Noto Sans SC', 'Microsoft YaHei', 'SimHei', sans-serif; position: relative; overflow: hidden;">
            <h2 style="font-size: 17px; color: #333; margin: 0 0 6px 0; font-weight: bold;">族人一览${escHtml(sub)}</h2>
            <p style="font-size: 8px; color: #666; margin: 0 0 10px 0;">有则显示：性别、世、行、父母、配偶、生卒、居、职、生平摘要；缺则不列。</p>
            <div>${rows}</div>
            <div style="position: absolute; bottom: 22px; right: 26px; font-size: 9px; color: #ccc; transform: rotate(-15deg); opacity: 0.35;">
              ${escHtml(familyName)}氏族谱 · ${escHtml(timestamp)}
            </div>
          </div>
        `);
      });

      // 创建 PDF
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      
      // 处理每一页
      for (let i = 0; i < pages.length; i++) {
        if (i > 0) {
          pdf.addPage();
        }
        
        const pageContainer = document.createElement("div");
        pageContainer.innerHTML = pages[i];
        pageContainer.style.cssText = `
          position: fixed;
          left: -9999px;
          top: 0;
        `;
        document.body.appendChild(pageContainer);
        
        // 等待字体加载
        await document.fonts.ready;
        
        // 使用 html2canvas 生成图片
        const canvas = await html2canvas(pageContainer, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
          width: 595,
          height: 842,
        });
        
        const imgData = canvas.toDataURL("image/png");
        pdf.addImage(imgData, "PNG", 0, 0, 210, 297);
        
        document.body.removeChild(pageContainer);
      }
      
      try {
        const outline = pdf.outline;
        if (outline) {
          let p = 0;
          outline.add(null, "封面", { pageNumber: p++ });
          outline.add(null, "目录", { pageNumber: p++ });
          outline.add(null, "族人一览", { pageNumber: p });
        }
      } catch (e) {
        console.log("PDF outline not supported");
      }
      
      // 下载 PDF
      pdf.save(`${familyName}氏族谱_${timestamp}.pdf`);
      setSuccess(`PDF 族谱已导出，共 ${members.length} 位成员`);
    } catch (err) {
      console.error("PDF 导出失败:", err);
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
            <h3 className="font-medium">导出族谱</h3>
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
              <div className="flex gap-2">
                <Button
                  onClick={handleExport}
                  disabled={isLoading}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isLoading ? "导出中..." : "GEDCOM"}
                </Button>
                <Button
                  onClick={handleExportPDF}
                  disabled={isLoading}
                  className="flex-1"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  PDF 族谱
                </Button>
              </div>
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
