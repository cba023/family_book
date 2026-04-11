"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Search, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { FamilyMember } from "./actions";
import {
  createFamilyMember,
  updateFamilyMember,
  deleteFamilyMembers,
  fetchAllMembersForSelect,
  fetchMemberById,
} from "./actions";
import { ImportMembersDialog } from "./import-members-dialog";
import { FatherCombobox } from "./father-combobox";
import { RichTextEditor } from "@/components/rich-text/editor";
import { RichTextViewer } from "@/components/rich-text/viewer";
import { cn } from "@/lib/utils";

interface FamilyMembersTableProps {
  initialData: FamilyMember[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  searchQuery: string;
  canEdit?: boolean;
}

export function FamilyMembersTable({
  initialData,
  totalCount,
  currentPage,
  pageSize,
  searchQuery,
  canEdit = false,
}: FamilyMembersTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [searchInput, setSearchInput] = React.useState(searchQuery);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoadingParents, setIsLoadingParents] = React.useState(false);
  const [loadingFatherId, setLoadingFatherId] = React.useState<number | null>(null);

  const [editingMember, setEditingMember] = React.useState<FamilyMember | null>(null);
  const [biographyMember, setBiographyMember] = React.useState<FamilyMember | null>(null);
  const [parentOptions, setParentOptions] = React.useState<
    { id: number; name: string; generation: number | null; gender: string | null; is_married_in: boolean; father_id: number | null; spouse_id: number | null }[]
  >([]);

  // 新增表单状态
  const [formData, setFormData] = React.useState({
    name: "",
    generation: "",
    sibling_order: "",
    father_id: "",
    gender: "",
    official_position: "",
    is_alive: true,
    spouse_id: "",
    is_married_in: false,
    remarks: "",
    birthday: "",
    death_date: "",
    residence_place: "",
  });

  // 根据性别判断是选择丈夫还是妻子
  const isFemale = formData.gender === "女";
  const spouseLabel = "配偶";

  // 获取可选的配偶列表
  // 从所有人员中选择，而不是从parentOptions（父亲选项）
  const allMembers = parentOptions; // parentOptions实际上包含所有成员

  const spouseOptions = React.useMemo(() => {
    if (!formData.gender) return [];
    if (isFemale) {
      // 女性选择配偶：必须是家族内的男性（非嫁入的男性）
      return allMembers.filter(p => p.gender === "男" && !p.is_married_in);
    }
    // 男性选择配偶：必须是嫁入的女性
    return allMembers.filter(p => p.gender === "女" && p.is_married_in);
  }, [allMembers, formData.gender, isFemale]);

  // 配偶选择弹窗状态
  const [isSpouseDialogOpen, setIsSpouseDialogOpen] = React.useState(false);
  const [spouseSearchQuery, setSpouseSearchQuery] = React.useState("");

  // 过滤后的配偶选项
  const filteredSpouseOptions = React.useMemo(() => {
    if (!spouseSearchQuery.trim()) return spouseOptions;
    return spouseOptions.filter(p =>
      p.name.toLowerCase().includes(spouseSearchQuery.toLowerCase())
    );
  }, [spouseOptions, spouseSearchQuery]);

  // 获取已选配偶的名称
  const selectedSpouseName = React.useMemo(() => {
    if (!formData.spouse_id) return null;
    const spouse = spouseOptions.find(p => p.id.toString() === formData.spouse_id);
    return spouse?.name || null;
  }, [formData.spouse_id, spouseOptions]);

  const totalPages = Math.ceil(totalCount / pageSize);

  // 判断是否为编辑模式
  const isEditMode = editingMember !== null;

  // 加载父亲选择列表
  React.useEffect(() => {
    if (isDialogOpen) {
      setIsLoadingParents(true);
      fetchAllMembersForSelect()
        .then(setParentOptions)
        .finally(() => setIsLoadingParents(false));
    }
  }, [isDialogOpen]);

  const updateUrlParams = (params: Record<string, string>) => {
    startTransition(() => {
      const newParams = new URLSearchParams(searchParams.toString());
      Object.entries(params).forEach(([key, value]) => {
        if (value) {
          newParams.set(key, value);
        } else {
          newParams.delete(key);
        }
      });
      router.push(`/family-tree?${newParams.toString()}`);
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrlParams({ search: searchInput, page: "1" });
  };

  const handlePageChange = (newPage: number) => {
    updateUrlParams({ page: newPage.toString() });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(initialData.map((m) => m.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;

    const confirmed = window.confirm(
      `确定要删除选中的 ${selectedIds.size} 条记录吗？`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    const result = await deleteFamilyMembers(Array.from(selectedIds));
    setIsDeleting(false);

    if (result.success) {
      setSelectedIds(new Set());
      router.refresh();
    } else {
      alert(`删除失败: ${result.error}`);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      generation: "",
      sibling_order: "",
      father_id: "",
      gender: "",
      official_position: "",
      is_alive: true,
      spouse_id: "",
      is_married_in: false,
      remarks: "",
      birthday: "",
      death_date: "",
      residence_place: "",
    });
    setEditingMember(null);
  };

  // 打开新增弹窗
  const handleOpenAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  // 打开编辑弹窗
  const handleOpenEditDialog = (member: FamilyMember) => {
    setEditingMember(member);
    setFormData({
      name: member.name,
      generation: member.generation?.toString() ?? "",
      sibling_order: member.sibling_order?.toString() ?? "",
      father_id: member.father_id?.toString() ?? "null",
      gender: member.gender ?? "",
      official_position: member.official_position ?? "",
      is_alive: member.is_alive,
      spouse_id: member.spouse_id?.toString() ?? "",
      is_married_in: (member as any).is_married_in ?? false,
      remarks: member.remarks ?? "",
      birthday: member.birthday ?? "",
      death_date: member.death_date ?? "",
      residence_place: member.residence_place ?? "",
    });
    setIsDialogOpen(true);
  };

  // 关闭弹窗
  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const handleSubmitMember = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert("请输入姓名");
      return;
    }

    setIsSubmitting(true);

    // 如果是女性且有丈夫，自动同步丈夫的信息
    let finalGeneration = formData.generation ? parseInt(formData.generation) : null;
    let finalFatherId = (formData.father_id && formData.father_id !== "null")
      ? parseInt(formData.father_id)
      : null;
    let finalSiblingOrder = formData.sibling_order
      ? parseInt(formData.sibling_order)
      : null;

    if (isFemale && formData.spouse_id) {
      const husband = parentOptions.find(p => p.id.toString() === formData.spouse_id);
      if (husband) {
        finalGeneration = husband.generation;
        finalFatherId = null; // 女性通过丈夫关联，不需要父亲
        finalSiblingOrder = null; // 女性不需要排行
      }
    }

    const memberData = {
      name: formData.name.trim(),
      generation: finalGeneration,
      sibling_order: finalSiblingOrder,
      father_id: finalFatherId,
      gender: (formData.gender as "男" | "女") || null,
      official_position: formData.official_position || null,
      is_alive: formData.is_alive,
      spouse_id: formData.spouse_id ? parseInt(formData.spouse_id) : null,
      is_married_in: formData.is_married_in,
      remarks: formData.remarks || null,
      birthday: formData.birthday || null,
      death_date: (!formData.is_alive && formData.death_date) ? formData.death_date : null,
      residence_place: formData.residence_place || null,
    };

    const result = isEditMode && editingMember
      ? await updateFamilyMember({ ...memberData, id: editingMember.id })
      : await createFamilyMember(memberData);

    setIsSubmitting(false);

    if (result.success) {
      handleCloseDialog();
      router.refresh();
    } else {
      alert(`${isEditMode ? "更新" : "添加"}失败: ${result.error}`);
    }
  };

  const allSelected =
    initialData.length > 0 && selectedIds.size === initialData.length;

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
        {/* 搜索 */}
        <form onSubmit={handleSearch} className="flex gap-2 w-full lg:w-auto">
          <Input
            placeholder="搜索姓名..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full sm:w-64"
          />
          <Button type="submit" variant="outline" size="icon" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </form>

        {/* 操作按钮 - 只有管理员可以编辑 */}
        {canEdit && (
          <div className="flex gap-2 flex-wrap w-full lg:w-auto">
            <ImportMembersDialog onSuccess={() => router.refresh()} />
            
            <Button onClick={handleOpenAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              新增
            </Button>

            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={selectedIds.size === 0 || isDeleting}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              删除 {selectedIds.size > 0 && `(${selectedIds.size})`}
            </Button>
          </div>
        )}
      </div>

      {/* 新增/编辑弹窗 */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent 
          className="sm:max-w-[600px] max-h-[90vh] flex flex-col p-0 gap-0"
          onInteractOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle>{isEditMode ? "编辑成员" : "新增成员"}</DialogTitle>
            <DialogDescription>
              填写成员信息后点击保存
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmitMember} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="grid gap-4">
                {/* 姓名 */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    姓名 *
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="col-span-3"
                    required
                  />
                </div>

                {/* 性别 - 移到姓名之后 */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="gender" className="text-right">
                    性别
                  </Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) =>
                      setFormData({ ...formData, gender: value, spouse_id: "" })
                    }
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="选择性别" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="男">男</SelectItem>
                      <SelectItem value="女">女</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 嫁入 - 仅女性显示 */}
                {isFemale && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="is_married_in" className="text-right">
                      嫁入
                    </Label>
                    <div className="col-span-3 flex items-center space-x-2">
                      <Checkbox
                        id="is_married_in"
                        checked={formData.is_married_in}
                        onCheckedChange={(checked) =>
                          setFormData({
                            ...formData,
                            is_married_in: checked as boolean,
                            father_id: checked ? "" : formData.father_id,
                            sibling_order: checked ? "" : formData.sibling_order,
                            residence_place: checked ? "" : formData.residence_place,
                          })
                        }
                      />
                      <Label htmlFor="is_married_in" className="font-normal text-sm text-muted-foreground">
                        勾选表示嫁入本家族（将隐藏父亲、排行、居住地字段）
                      </Label>
                    </div>
                  </div>
                )}

                {/* 配偶 - 男性或非嫁入女性显示 */}
                {(!isFemale || formData.is_married_in) && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">
                      {spouseLabel}
                    </Label>
                    <div className="col-span-3 flex gap-2">
                      <div className="flex-1 flex items-center gap-2 border rounded-md px-3 py-2 bg-muted/50">
                        {selectedSpouseName ? (
                          <span className="text-sm">{selectedSpouseName}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">未选择</span>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsSpouseDialogOpen(true)}
                      >
                        选择
                      </Button>
                      {formData.spouse_id && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setFormData({ ...formData, spouse_id: "" })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* 父亲 - 仅男性或非嫁入女性显示 */}
                {(!isFemale || !formData.is_married_in) && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="father_id" className="text-right">
                      父亲
                    </Label>
                    <div className="col-span-3">
                      <FatherCombobox
                        value={formData.father_id}
                        options={parentOptions}
                        isLoading={isLoadingParents}
                        onChange={(value) => {
                          const father = parentOptions.find(p => p.id.toString() === value);
                          const newGeneration = father && father.generation !== null 
                            ? (father.generation + 1).toString() 
                            : (value === "null" ? "" : formData.generation);
                          setFormData({ 
                            ...formData, 
                            father_id: value, 
                            generation: newGeneration 
                          });
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* 世代 - 仅男性或非嫁入女性显示 */}
                {(!isFemale || !formData.is_married_in) && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="generation" className="text-right">
                      世代
                    </Label>
                    <Input
                      id="generation"
                      type="number"
                      value={formData.generation}
                      onChange={(e) =>
                        setFormData({ ...formData, generation: e.target.value })
                      }
                      className="col-span-3"
                      disabled={!!formData.father_id && formData.father_id !== "null"}
                    />
                  </div>
                )}

                {/* 排行 - 仅男性或非嫁入女性显示 */}
                {(!isFemale || !formData.is_married_in) && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="sibling_order" className="text-right">
                      排行
                    </Label>
                    <Input
                      id="sibling_order"
                      type="number"
                      value={formData.sibling_order}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          sibling_order: e.target.value,
                        })
                      }
                      className="col-span-3"
                    />
                  </div>
                )}

                {/* 生日 */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="birthday" className="text-right">
                    生日
                  </Label>
                  <Input
                    id="birthday"
                    type="date"
                    value={formData.birthday}
                    onChange={(e) =>
                      setFormData({ ...formData, birthday: e.target.value })
                    }
                    className="col-span-3"
                  />
                </div>

                {/* 居住地 - 仅男性或非嫁入女性显示 */}
                {(!isFemale || !formData.is_married_in) && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="residence_place" className="text-right">
                      居住地
                    </Label>
                    <Input
                      id="residence_place"
                      value={formData.residence_place}
                      onChange={(e) =>
                        setFormData({ ...formData, residence_place: e.target.value })
                      }
                      className="col-span-3"
                    />
                  </div>
                )}

                {/* 职业 */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="official_position" className="text-right">
                    职业
                  </Label>
                  <Input
                    id="official_position"
                    value={formData.official_position}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        official_position: e.target.value,
                      })
                    }
                    className="col-span-3"
                  />
                </div>

                {/* 是否在世 */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="is_alive" className="text-right">
                    是否在世
                  </Label>
                  <div className="col-span-3 flex items-center space-x-2">
                    <Checkbox
                      id="is_alive"
                      checked={formData.is_alive}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          is_alive: checked as boolean,
                        })
                      }
                    />
                    <Label htmlFor="is_alive" className="font-normal">
                      在世
                    </Label>
                  </div>
                </div>

                {/* 卒年 (仅去世可选) */}
                {!formData.is_alive && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="death_date" className="text-right">
                      卒年
                    </Label>
                    <Input
                      id="death_date"
                      type="date"
                      value={formData.death_date}
                      onChange={(e) =>
                        setFormData({ ...formData, death_date: e.target.value })
                      }
                      className="col-span-3"
                    />
                  </div>
                )}

                {/* 备注 / 生平事迹 */}
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="remarks" className="text-right pt-2">
                    生平事迹
                  </Label>
                  <div className="col-span-3">
                    <RichTextEditor
                      value={formData.remarks}
                      onChange={(value) =>
                        setFormData({ ...formData, remarks: value })
                      }
                      maxLength={500}
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <DialogFooter className="px-6 py-4 border-t mt-auto">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
              >
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? "保存中..." : "保存"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 配偶选择弹窗 */}
      <Dialog open={isSpouseDialogOpen} onOpenChange={setIsSpouseDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>选择{spouseLabel}</DialogTitle>
            <DialogDescription>
              {isFemale ? "选择家族内的男性成员作为丈夫" : "选择女性成员作为妻子"}
            </DialogDescription>
          </DialogHeader>

          {/* 搜索框 */}
          <div className="py-4">
            <Input
              placeholder="搜索姓名..."
              value={spouseSearchQuery}
              onChange={(e) => setSpouseSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>

          {/* 配偶列表 */}
          <div className="flex-1 overflow-y-auto border rounded-md">
            {filteredSpouseOptions.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                暂无符合条件的人员
              </div>
            ) : (
              <div className="divide-y">
                {filteredSpouseOptions.map((option) => (
                  <div
                    key={option.id}
                    className={cn(
                      "p-3 flex items-center justify-between cursor-pointer hover:bg-muted transition-colors",
                      formData.spouse_id === option.id.toString() && "bg-primary/10"
                    )}
                    onClick={() => {
                      const newSpouseId = option.id.toString();
                      setFormData(prev => {
                        const newData = { ...prev, spouse_id: newSpouseId };
                        // 如果是女性选择了丈夫，自动同步丈夫的世代
                        if (isFemale && option.generation !== null) {
                          newData.generation = option.generation.toString();
                        }
                        return newData;
                      });
                      setIsSpouseDialogOpen(false);
                      setSpouseSearchQuery("");
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                        option.gender === "男" ? "bg-blue-100 text-blue-700" : "bg-pink-100 text-pink-700"
                      )}>
                        {option.gender === "男" ? "男" : "女"}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{option.name}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <span>{option.generation ? `第${option.generation}世` : "未知世代"}</span>
                          {option.is_married_in && (
                            <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">嫁入</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {formData.spouse_id === option.id.toString() && (
                      <div className="text-primary text-sm font-medium">已选择</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsSpouseDialogOpen(false);
                setSpouseSearchQuery("");
              }}
            >
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 表格 */}
      <div className={cn("border rounded-lg transition-opacity duration-200", isPending && "opacity-60 pointer-events-none")}>
        <Table>
          <TableHeader>
            <TableRow>
              {canEdit && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="全选"
                  />
                </TableHead>
              )}
              <TableHead className="w-16">ID</TableHead>
              <TableHead>姓名</TableHead>
              <TableHead className="w-20">世代</TableHead>
              <TableHead className="w-20">排行</TableHead>
              <TableHead className="w-24">父亲</TableHead>
              <TableHead className="w-16">性别</TableHead>
              <TableHead className="w-20">嫁入</TableHead>
              <TableHead>生日</TableHead>
              <TableHead>卒年</TableHead>
              <TableHead>居住地</TableHead>
              <TableHead>职业</TableHead>
              <TableHead className="w-20">在世</TableHead>
              <TableHead>配偶</TableHead>
              <TableHead>生平事迹</TableHead>
              <TableHead className="w-44">更新时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 16 : 15} className="h-24 text-center">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              initialData.map((member) => (
                <TableRow
                  key={member.id}
                  data-state={canEdit && selectedIds.has(member.id) ? "selected" : undefined}
                >
                  {canEdit && (
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(member.id)}
                        onCheckedChange={(checked) =>
                          handleSelectOne(member.id, checked as boolean)
                        }
                        aria-label={`选择 ${member.name}`}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-mono">{member.id}</TableCell>
                  <TableCell className="font-medium">
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => handleOpenEditDialog(member)}
                        className="text-primary hover:underline cursor-pointer text-left"
                      >
                        {member.name}
                      </button>
                    ) : (
                      <span>{member.name}</span>
                    )}
                  </TableCell>
                  <TableCell>{member.generation ?? "-"}</TableCell>
                  <TableCell>{member.sibling_order ?? "-"}</TableCell>
                  <TableCell>
                    {member.father_id && member.father_name ? (
                      <div className="flex items-center gap-1">
                        {canEdit ? (
                          <button
                            type="button"
                            disabled={loadingFatherId === member.father_id}
                            onClick={async () => {
                              if (!member.father_id) return;
                              setLoadingFatherId(member.father_id);
                              try {
                                const fatherData = await fetchMemberById(member.father_id);
                                if (fatherData) {
                                  handleOpenEditDialog(fatherData);
                                }
                              } finally {
                                setLoadingFatherId(null);
                              }
                            }}
                            className={cn(
                              "text-primary hover:underline cursor-pointer text-left",
                              loadingFatherId === member.father_id && "opacity-70 cursor-wait"
                            )}
                          >
                            {member.father_name}
                          </button>
                        ) : (
                          <span>{member.father_name}</span>
                        )}
                        {loadingFatherId === member.father_id && (
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>{member.gender ?? "-"}</TableCell>
                  <TableCell>
                    {(member as any).is_married_in ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                        嫁入
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {member.birthday
                      ? (() => {
                          const [y, m, d] = member.birthday.split("-");
                          return `${y}年${m}月${d}日`;
                        })()
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {member.death_date
                      ? (() => {
                          const [y, m, d] = member.death_date.split("-");
                          return `${y}年${m}月${d}日`;
                        })()
                      : "-"}
                  </TableCell>
                  <TableCell>{member.residence_place ?? "-"}</TableCell>
                  <TableCell>{member.official_position ?? "-"}</TableCell>
                  <TableCell>{member.is_alive ? "是" : "否"}</TableCell>
                  <TableCell>{member.spouse_name ?? "-"}</TableCell>
                  <TableCell>
                    {member.remarks ? (
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="h-auto p-0" 
                        onClick={() => setBiographyMember(member)}
                      >
                        查看
                      </Button>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(member.updated_at).toLocaleString("zh-CN")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 分页 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0">
        <p className="text-sm text-muted-foreground">
          共 {totalCount} 条记录，第 {currentPage} / {totalPages || 1} 页
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1 || isPending}
          >
            <ChevronLeft className="h-4 w-4" />
            上一页
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || isPending}
          >
            下一页
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 生平事迹查看弹窗 */}
      <Dialog open={!!biographyMember} onOpenChange={(open) => !open && setBiographyMember(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{biographyMember?.name} 的生平事迹</DialogTitle>
          </DialogHeader>
          <div className="py-4">
             <RichTextViewer value={biographyMember?.remarks ?? null} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}