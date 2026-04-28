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
import {
  Plus,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronUp,
  ChevronDown,
  Loader2,
} from "lucide-react";
import type { FamilyMember } from "./actions";
import {
  createFamilyMember,
  updateFamilyMember,
  deleteFamilyMembers,
  fetchAllMembersForSelect,
  fetchMemberById,
} from "./actions";
import { FatherCombobox } from "./father-combobox";
import { CsvExportButton } from "./csv-export-button";
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
  const [jumpPage, setJumpPage] = React.useState(currentPage.toString());
  const [parentOptions, setParentOptions] = React.useState<
    { id: number; name: string; generation: number | null; gender: string | null; is_married_in: boolean; father_id: number | null; spouse_ids: number[] }[]
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
    spouse_ids: [] as number[],
    is_married_in: false,
    remarks: "",
    birthday: "",
    death_date: "",
    birthdayUnknown: false,
    deathUnknown: false,
    residence_place: "",
  });

  // 根据性别判断是选择丈夫还是妻子
  const isFemale = formData.gender === "女";
  const spouseLabel = "配偶";

  // 配偶选项过滤：
  // - 女性：只能选一个配偶。编辑时如果已有配偶，则只显示该配偶（不可更换）；新增时显示未婚男性
  // - 男性：可以多个配偶。编辑时显示所有符合条件的女性，但排除已有配偶且配偶不包含当前成员的
  const spouseOptions = React.useMemo(() => {
    if (!formData.gender) return [];
    const currentMemberId = editingMember?.id;

    if (isFemale) {
      // 女性选择丈夫：男性，未嫁入
      let candidates = parentOptions.filter(p => p.gender === "男" && !p.is_married_in);

      // 编辑模式下，如果已有配偶，只显示该配偶
      if (currentMemberId && formData.spouse_ids.length > 0) {
        const currentSpouseId = formData.spouse_ids[0];
        return candidates.filter(p => p.id === currentSpouseId);
      }

      // 新增模式：过滤掉已有配偶的男性
      return candidates.filter(p => !p.spouse_ids || p.spouse_ids.length === 0);
    }

    // 男性选择妻子：女性，已嫁入
    let candidates = parentOptions.filter(p => p.gender === "女" && p.is_married_in);

    // 编辑模式下排除自己
    if (currentMemberId) {
      candidates = candidates.filter(p => p.id !== currentMemberId);
    }

    // 过滤掉已有配偶的女性（除非该配偶是当前成员自己）
    return candidates.filter(p => {
      if (!p.spouse_ids || p.spouse_ids.length === 0) return true;
      // 如果该女性的配偶包含当前成员，则允许（编辑时保留关系）
      return currentMemberId ? p.spouse_ids.includes(currentMemberId) : false;
    });
  }, [parentOptions, formData.gender, isFemale, editingMember, formData.spouse_ids]);

  /** 父亲只能选择男性成员 */
  const fatherSelectOptions = React.useMemo(
    () => parentOptions.filter((p) => p.gender === "男"),
    [parentOptions],
  );

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

  // 获取已选配偶列表（去重后的 id 和 name）
  const selectedSpouses = React.useMemo(() => {
    if (!formData.spouse_ids.length) return [];
    const seen = new Set<number>();
    const result: { id: number; name: string }[] = [];
    for (const id of formData.spouse_ids) {
      if (!seen.has(id)) {
        seen.add(id);
        const member = parentOptions.find(p => p.id === id);
        if (member) {
          result.push({ id, name: member.name });
        }
      }
    }
    return result;
  }, [formData.spouse_ids, parentOptions]);

  /** 男性多位妻子时调整「长房、次房」等显示顺序 */
  const moveSpouseOrder = React.useCallback(
    (index: number, direction: "up" | "down") => {
      setFormData((prev) => {
        if (prev.gender !== "男" || prev.spouse_ids.length < 2) return prev;
        const ids = [...prev.spouse_ids];
        const j = direction === "up" ? index - 1 : index + 1;
        if (j < 0 || j >= ids.length) return prev;
        [ids[index], ids[j]] = [ids[j], ids[index]];
        return { ...prev, spouse_ids: ids };
      });
    },
    [],
  );

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

  // 同步 jumpPage 与当前页码
  React.useEffect(() => {
    setJumpPage(currentPage.toString());
  }, [currentPage]);

  const handleJump = () => {
    const page = parseInt(jumpPage, 10);
    if (isNaN(page) || page < 1) {
      setJumpPage("1");
      handlePageChange(1);
    } else if (page > totalPages) {
      setJumpPage(totalPages.toString());
      handlePageChange(totalPages);
    } else {
      handlePageChange(page);
    }
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
      spouse_ids: [],
      is_married_in: false,
      remarks: "",
      birthday: "",
      death_date: "",
      birthdayUnknown: false,
      deathUnknown: false,
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
      spouse_ids: member.spouse_ids ?? [],
      is_married_in: (member as any).is_married_in ?? false,
      remarks: member.remarks ?? "",
      birthday: member.birthday ?? "",
      death_date: member.death_date ?? "",
      birthdayUnknown: !member.birthday,
      deathUnknown: !member.is_alive && !member.death_date,
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

    if (isFemale && formData.spouse_ids.length > 0) {
      const husbandId = formData.spouse_ids[0];
      const husband = parentOptions.find(p => p.id === husbandId);
      if (husband) {
        finalGeneration = husband.generation;
        finalFatherId = null;
        finalSiblingOrder = null;
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
      // 去重并过滤无效值；女性仅保留一位丈夫
      spouse_ids: (() => {
        const ids = [...new Set(formData.spouse_ids.filter(id => !isNaN(id) && id > 0))];
        return isFemale ? ids.slice(0, 1) : ids;
      })(),
      is_married_in: formData.is_married_in,
      remarks: formData.remarks || null,
      birthday: formData.birthdayUnknown ? null : formData.birthday || null,
      death_date: formData.is_alive
        ? null
        : formData.deathUnknown
          ? null
          : formData.death_date || null,
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
            <Button onClick={handleOpenAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              新增
            </Button>
            <CsvExportButton />

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
                      setFormData({ ...formData, gender: value, spouse_ids: [] })
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

                {/* 配偶 - 男性或非嫁入女性；男性可多选妻子，女性仅单选丈夫 */}
                {(!isFemale || formData.is_married_in) && (
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label className="text-right pt-2">
                      {spouseLabel}
                    </Label>
                    <div className="col-span-3 space-y-2">
                      {/* 已选配偶标签 */}
                      {selectedSpouses.length > 0 && (
                        <div className="flex flex-col gap-1">
                          {!isFemale && selectedSpouses.length > 1 && (
                            <p className="text-xs text-muted-foreground">
                              多位妻子时可用箭头调整顺序（如长房、次房），将同步到列表与家谱展示。
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1">
                            {selectedSpouses.map((spouse, i) => (
                              <span
                                key={spouse.id}
                                className="inline-flex items-center gap-1 bg-primary/10 text-primary text-sm px-2 py-0.5 rounded border border-primary/20"
                              >
                                {!isFemale && selectedSpouses.length > 1 && (
                                  <span className="inline-flex flex-col gap-0">
                                    <button
                                      type="button"
                                      className="p-0 h-3.5 leading-none rounded hover:bg-primary/20 disabled:opacity-30"
                                      disabled={i === 0}
                                      aria-label="上移"
                                      onClick={() => moveSpouseOrder(i, "up")}
                                    >
                                      <ChevronUp className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      className="p-0 h-3.5 leading-none rounded hover:bg-primary/20 disabled:opacity-30"
                                      disabled={i === selectedSpouses.length - 1}
                                      aria-label="下移"
                                      onClick={() => moveSpouseOrder(i, "down")}
                                    >
                                      <ChevronDown className="h-3 w-3" />
                                    </button>
                                  </span>
                                )}
                                {spouse.name}
                                <button
                                  type="button"
                                  className="hover:text-destructive"
                                  onClick={() => {
                                    setFormData(prev => {
                                      // 过滤掉该配偶（移除所有匹配的 id）
                                      const filtered = prev.spouse_ids.filter(id => id !== spouse.id);
                                      const newData = { ...prev, spouse_ids: filtered };
                                      // 如果是女性清空了配偶，重置世代
                                      if (isFemale) {
                                        newData.generation = "";
                                      }
                                      return newData;
                                    });
                                  }}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsSpouseDialogOpen(true)}
                      >
                        {selectedSpouses.length > 0
                          ? isFemale
                            ? "更换配偶"
                            : "添加更多配偶"
                          : "选择配偶"}
                      </Button>
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
                        options={fatherSelectOptions}
                        isLoading={isLoadingParents}
                        onChange={(value) => {
                          const father = fatherSelectOptions.find(p => p.id.toString() === value);
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
                <div className="grid grid-cols-4 items-start gap-4 sm:items-center">
                  <Label htmlFor="birthday" className="text-right pt-2 sm:pt-0">
                    生日
                  </Label>
                  <div className="col-span-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
                    <Input
                      id="birthday"
                      type="date"
                      value={formData.birthday}
                      disabled={formData.birthdayUnknown}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          birthday: e.target.value,
                          birthdayUnknown: false,
                        })
                      }
                      className="w-full sm:max-w-[200px] sm:flex-1 min-w-0"
                    />
                    <div className="flex items-center gap-2 shrink-0">
                      <Checkbox
                        id="birthday_unknown"
                        checked={formData.birthdayUnknown}
                        onCheckedChange={(checked) => {
                          const on = checked === true;
                          setFormData({
                            ...formData,
                            birthdayUnknown: on,
                            birthday: on ? "" : formData.birthday,
                          });
                        }}
                      />
                      <Label htmlFor="birthday_unknown" className="font-normal cursor-pointer">
                        不详
                      </Label>
                    </div>
                  </div>
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
                      onCheckedChange={(checked) => {
                        const alive = checked === true;
                        setFormData((prev) => {
                          if (alive) {
                            return {
                              ...prev,
                              is_alive: true,
                              death_date: "",
                              deathUnknown: false,
                            };
                          }
                          return {
                            ...prev,
                            is_alive: false,
                            deathUnknown: !prev.death_date,
                          };
                        });
                      }}
                    />
                    <Label htmlFor="is_alive" className="font-normal">
                      在世
                    </Label>
                  </div>
                </div>

                {/* 卒年 (仅去世可选) */}
                {!formData.is_alive && (
                  <div className="grid grid-cols-4 items-start gap-4 sm:items-center">
                    <Label htmlFor="death_date" className="text-right pt-2 sm:pt-0">
                      卒年
                    </Label>
                    <div className="col-span-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
                      <Input
                        id="death_date"
                        type="date"
                        value={formData.death_date}
                        disabled={formData.deathUnknown}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            death_date: e.target.value,
                            deathUnknown: false,
                          })
                        }
                        className="w-full sm:max-w-[200px] sm:flex-1 min-w-0"
                      />
                      <div className="flex items-center gap-2 shrink-0">
                        <Checkbox
                          id="death_unknown"
                          checked={formData.deathUnknown}
                          onCheckedChange={(checked) => {
                            const on = checked === true;
                            setFormData({
                              ...formData,
                              deathUnknown: on,
                              death_date: on ? "" : formData.death_date,
                            });
                          }}
                        />
                        <Label htmlFor="death_unknown" className="font-normal cursor-pointer">
                          不详
                        </Label>
                      </div>
                    </div>
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

      {/* 配偶选择弹窗（女性单选丈夫，男性多选妻子） */}
      <Dialog open={isSpouseDialogOpen} onOpenChange={setIsSpouseDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>选择{spouseLabel}</DialogTitle>
            <DialogDescription>
              {isFemale ? "选择家族内的一位男性成员作为丈夫" : "选择女性成员作为妻子（可多选）"}
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

          {/* 配偶列表（女性单选，男性多选） */}
          <div className="flex-1 overflow-y-auto border rounded-md">
            {filteredSpouseOptions.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                暂无符合条件的人员
              </div>
            ) : (
              <div className="divide-y">
                {filteredSpouseOptions.map((option) => {
                  const isChecked = formData.spouse_ids.includes(option.id);
                  return (
                    <div
                      key={option.id}
                      className={cn(
                        "p-3 flex items-center gap-3 cursor-pointer hover:bg-muted transition-colors",
                        isChecked && "bg-primary/10"
                      )}
                      onClick={() => {
                        setFormData(prev => {
                          const already = prev.spouse_ids.includes(option.id);
                          let newIds: number[];
                          if (already) {
                            // 女性点击已选中的项，清空；男性可以取消
                            if (isFemale) {
                              newIds = [];
                            } else {
                              newIds = prev.spouse_ids.filter(id => id !== option.id);
                            }
                          } else {
                            // 女性只能有一个配偶，替换；男性可以添加
                            if (isFemale) {
                              newIds = [option.id];
                            } else {
                              newIds = [...prev.spouse_ids, option.id];
                            }
                          }
                          const newData = { ...prev, spouse_ids: newIds };
                          // 如果是女性选择了丈夫，同步丈夫的世代；如果清空了配偶，重置世代
                          if (isFemale) {
                            if (!already && option.generation !== null) {
                              newData.generation = option.generation.toString();
                            } else if (already) {
                              newData.generation = "";
                            }
                          }
                          return newData;
                        });
                      }}
                    >
                      {/* 女性用单选样式（圆形），男性用Checkbox（方形多选） */}
                      {isFemale ? (
                        <div
                          className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                            isChecked
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/30"
                          )}
                        >
                          {isChecked && (
                            <div className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </div>
                      ) : (
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            setFormData(prev => {
                              const already = prev.spouse_ids.includes(option.id);
                              let newIds: number[];
                              if (checked && !already) {
                                newIds = [...prev.spouse_ids, option.id];
                              } else if (!checked && already) {
                                newIds = prev.spouse_ids.filter(id => id !== option.id);
                              } else {
                                newIds = prev.spouse_ids;
                              }
                              return { ...prev, spouse_ids: newIds };
                            });
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                      <div className="flex items-center gap-3 flex-1">
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
                      {isChecked && (
                        <div className="text-primary text-sm font-medium">
                          {isFemale ? "已选择" : "已选"}
                        </div>
                      )}
                    </div>
                  );
                })}
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
              完成
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
                      : "不详"}
                  </TableCell>
                  <TableCell>
                    {member.is_alive
                      ? "-"
                      : member.death_date
                        ? (() => {
                            const [y, m, d] = member.death_date.split("-");
                            return `${y}年${m}月${d}日`;
                          })()
                        : "不详"}
                  </TableCell>
                  <TableCell>{member.residence_place ?? "-"}</TableCell>
                  <TableCell>{member.official_position ?? "-"}</TableCell>
                  <TableCell>{member.is_alive ? "是" : "否"}</TableCell>
                  <TableCell>{member.spouse_names?.join("、") ?? "-"}</TableCell>
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 分页 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            共 {totalCount} 条记录，第 {currentPage} / {totalPages || 1} 页
          </p>
          <div className="flex items-center gap-1 ml-2">
            <span className="text-sm text-muted-foreground">跳至</span>
            <Input
              type="number"
              min={1}
              max={totalPages}
              value={jumpPage}
              onChange={(e) => setJumpPage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJump()}
              className="w-16 h-8 text-center"
            />
            <span className="text-sm text-muted-foreground">页</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleJump}
              disabled={isPending}
              className="h-8 px-2"
            >
              确定
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(1)}
            disabled={currentPage <= 1 || isPending}
            title="首页"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage >= totalPages || isPending}
            title="尾页"
          >
            <ChevronsRight className="h-4 w-4" />
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