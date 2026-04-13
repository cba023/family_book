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
  is_married_in: boolean;
  remarks: string | null;
  birthday: string | null;
  death_date: string | null;
  residence_place: string | null;
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
      
      // 生成目录 HTML - 只显示有值的字段
      const tocHtml = members.map((member, index) => {
        const gender = member.gender === "男" ? "男" : member.gender === "女" ? "女" : null;
        const generation = member.generation ? `第${member.generation}世` : null;
        const infoParts = [generation, gender].filter(Boolean);
        const info = infoParts.length > 0 ? ` (${infoParts.join("  ")})` : "";
        return `<p style="margin: 8px 0; break-inside: avoid;">${index + 1}. ${member.name}${info}</p>`;
      }).join("");

      // 生成成员详情 HTML - 只显示有值的字段
      const detailHtml = members.map((member, index) => {
        // 构建信息项数组，只包含有值的
        const infoItems: string[] = [];
        
        if (member.generation) {
          infoItems.push(`<p style="margin: 6px 0; break-inside: avoid;"><strong>世　　代：</strong>第 ${member.generation} 世</p>`);
        }
        if (member.sibling_order) {
          infoItems.push(`<p style="margin: 6px 0; break-inside: avoid;"><strong>排　　行：</strong>第 ${member.sibling_order} 位</p>`);
        }
        if (member.gender) {
          infoItems.push(`<p style="margin: 6px 0; break-inside: avoid;"><strong>性　　别：</strong>${member.gender}</p>`);
        }
        if (member.birthday || member.death_date) {
          const birthDeath = `${member.birthday || "不详"} - ${member.death_date || "不详"}`;
          infoItems.push(`<p style="margin: 6px 0; break-inside: avoid;"><strong>生　　卒：</strong>${birthDeath}</p>`);
        }
        if (member.residence_place) {
          infoItems.push(`<p style="margin: 6px 0; break-inside: avoid;"><strong>居住地：</strong>${member.residence_place}</p>`);
        }
        if (member.official_position) {
          infoItems.push(`<p style="margin: 6px 0; break-inside: avoid;"><strong>职　　业：</strong>${member.official_position}</p>`);
        }
        if (member.father_name) {
          infoItems.push(`<p style="margin: 6px 0; break-inside: avoid;"><strong>父　　亲：</strong>${member.father_name}</p>`);
        }
        if (member.spouse_name) {
          infoItems.push(`<p style="margin: 6px 0; break-inside: avoid;"><strong>配　　偶：</strong>${member.spouse_name}</p>`);
        }
        
        // 生平事迹
        const remarksSection = member.remarks 
          ? `<div style="margin-top: 20px; break-inside: avoid;">
              <h3 style="font-size: 14px; color: #333; margin-bottom: 10px;">生平事迹</h3>
              <p style="font-size: 11px; line-height: 1.6; color: #666; text-align: justify;">
                ${member.remarks}
              </p>
            </div>`
          : "";
        
        return `
          <div style="page-break-before: always; padding: 40px 0; break-inside: avoid-page;">
            <h2 style="font-size: 22px; color: #8B4513; margin-bottom: 20px; font-weight: bold; border-bottom: 2px solid #8B4513; padding-bottom: 10px;">
              ${member.name}
            </h2>
            <div style="font-size: 12px; line-height: 1.6; color: #555;">
              ${infoItems.join("")}
            </div>
            ${remarksSection}
          </div>
        `;
      }).join("");
      
      // 构建 PDF 内容 - 每页独立容器避免跨页问题
      const pages: string[] = [];
      
      // 封面页
      pages.push(`
        <div style="width: 595px; height: 842px; padding: 40px; box-sizing: border-box; background: white; font-family: 'Noto Sans SC', 'Microsoft YaHei', 'SimHei', sans-serif; position: relative; overflow: hidden;">
          <div style="text-align: center; padding-top: 150px;">
            <h1 style="font-size: 42px; color: #8B4513; margin-bottom: 30px; font-weight: bold; letter-spacing: 8px;">
              ${familyName}氏族谱
            </h1>
            <p style="font-size: 16px; color: #666; margin-bottom: 15px;">
              共收录 ${members.length} 位族人
            </p>
            <p style="font-size: 13px; color: #999;">
              导出时间：${exportTime}
            </p>
          </div>
          <div style="position: absolute; bottom: 60px; left: 0; right: 0; text-align: center;">
            <p style="font-size: 12px; color: #ccc; transform: rotate(-15deg); opacity: 0.3;">
              ${familyName}氏族谱 · ${timestamp}
            </p>
          </div>
        </div>
      `);
      
      // 目录页
      pages.push(`
        <div style="width: 595px; min-height: 842px; padding: 40px; box-sizing: border-box; background: white; font-family: 'Noto Sans SC', 'Microsoft YaHei', 'SimHei', sans-serif; position: relative; overflow: hidden;">
          <h2 style="font-size: 26px; text-align: center; margin-bottom: 30px; color: #333; font-weight: bold;">
            目  录
          </h2>
          <div style="font-size: 13px; line-height: 1.8; column-count: 2; column-gap: 30px;">
            ${tocHtml}
          </div>
          <div style="position: absolute; bottom: 30px; right: 40px; font-size: 10px; color: #ccc; transform: rotate(-15deg); opacity: 0.3;">
            ${familyName}氏族谱 · ${timestamp}
          </div>
        </div>
      `);
      
      // 成员详情页 - 每个成员一页
      members.forEach((member) => {
        // 构建信息项数组
        const infoItems: string[] = [];
        
        if (member.generation) {
          infoItems.push(`<p style="margin: 8px 0;"><strong>世　　代：</strong>第 ${member.generation} 世</p>`);
        }
        if (member.sibling_order) {
          infoItems.push(`<p style="margin: 8px 0;"><strong>排　　行：</strong>第 ${member.sibling_order} 位</p>`);
        }
        if (member.gender) {
          infoItems.push(`<p style="margin: 8px 0;"><strong>性　　别：</strong>${member.gender}</p>`);
        }
        if (member.birthday || member.death_date) {
          const birthDeath = `${member.birthday || "不详"} - ${member.death_date || "不详"}`;
          infoItems.push(`<p style="margin: 8px 0;"><strong>生　　卒：</strong>${birthDeath}</p>`);
        }
        if (member.residence_place) {
          infoItems.push(`<p style="margin: 8px 0;"><strong>居住地：</strong>${member.residence_place}</p>`);
        }
        if (member.official_position) {
          infoItems.push(`<p style="margin: 8px 0;"><strong>职　　业：</strong>${member.official_position}</p>`);
        }
        if (member.father_name) {
          infoItems.push(`<p style="margin: 8px 0;"><strong>父　　亲：</strong>${member.father_name}</p>`);
        }
        if (member.spouse_name) {
          infoItems.push(`<p style="margin: 8px 0;"><strong>配　　偶：</strong>${member.spouse_name}</p>`);
        }
        
        const remarksSection = member.remarks 
          ? `<div style="margin-top: 25px; padding-top: 15px; border-top: 1px dashed #ddd;">
              <h3 style="font-size: 14px; color: #8B4513; margin-bottom: 12px; font-weight: bold;">生平事迹</h3>
              <p style="font-size: 12px; line-height: 1.8; color: #555; text-align: justify;">
                ${member.remarks}
              </p>
            </div>`
          : "";
        
        pages.push(`
          <div style="width: 595px; min-height: 842px; padding: 50px 60px; box-sizing: border-box; background: white; font-family: 'Noto Sans SC', 'Microsoft YaHei', 'SimHei', sans-serif; position: relative; overflow: hidden;">
            <h2 style="font-size: 28px; color: #8B4513; margin-bottom: 25px; font-weight: bold; border-bottom: 3px solid #8B4513; padding-bottom: 15px;">
              ${member.name}
            </h2>
            <div style="font-size: 13px; line-height: 1.8; color: #444;">
              ${infoItems.join("")}
            </div>
            ${remarksSection}
            <div style="position: absolute; bottom: 30px; right: 40px; font-size: 10px; color: #ccc; transform: rotate(-15deg); opacity: 0.3;">
              ${familyName}氏族谱 · ${timestamp}
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
      
      // 添加 PDF 大纲/书签
      try {
        // @ts-ignore - jsPDF 的 outline 功能
        const outline = pdf.outline;
        if (outline) {
          outline.add("封面", 0);
          outline.add("目录", 1);
          members.forEach((member, index) => {
            outline.add(member.name, index + 2);
          });
        }
      } catch (e) {
        // 大纲功能可能不被所有 PDF 阅读器支持
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
