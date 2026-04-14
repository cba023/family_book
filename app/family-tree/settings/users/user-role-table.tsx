"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import { deleteManagedUser, updateManagedUser, updateManagedUserProfile, type ManagedUserRow } from "./actions";
import { roleDisplayLabel, type AppRole } from "@/lib/auth/roles";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, Trash2, Loader2, Pencil } from "lucide-react";

type Props = {
  initialUsers: ManagedUserRow[];
  currentUserId: string;
  currentUserRole: AppRole | null;
  isSuperAdmin: boolean;
};

export function UserRoleTable({ initialUsers, currentUserId, currentUserRole, isSuperAdmin }: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [editingUser, setEditingUser] = useState<ManagedUserRow | null>(null);
  const [editForm, setEditForm] = useState({ fullName: "", phone: "", role: "" });

  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  const isCurrentSuperAdmin = currentUserRole === "super_admin";

  const filteredUsers = searchQuery.trim()
    ? users.filter(u =>
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
        (u.phone?.includes(searchQuery) ?? false)
      )
    : users;

  const openEditDialog = (user: ManagedUserRow) => {
    setEditingUser(user);
    setEditForm({
      fullName: user.fullName ?? "",
      phone: user.phone ?? "",
      role: user.role,
    });
  };

  const closeEditDialog = () => {
    setEditingUser(null);
  };

  const saveEdit = () => {
    if (!editingUser) return;
    setMessage(null);
    startTransition(async () => {
      let res;
      if (isCurrentSuperAdmin) {
        res = await updateManagedUser(editingUser.id, {
          fullName: editForm.fullName || undefined,
          phone: editForm.phone || undefined,
          role: editForm.role,
        });
      } else {
        res = await updateManagedUserProfile(editingUser.id, {
          fullName: editForm.fullName || undefined,
          phone: editForm.phone || undefined,
        });
      }
      if (!res.success) {
        setMessage(res.error ?? "保存失败");
        return;
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? { ...u, fullName: editForm.fullName || null, phone: editForm.phone || null }
            : u
        ),
      );
      setEditingUser(null);
      setMessage("用户信息已更新");
    });
  };

  const onDeleteUser = useCallback((userId: string, username: string) => {
    if (!confirm(`确定要删除用户「${username || userId}」吗？此操作不可撤销。`)) {
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const res = await deleteManagedUser(userId);
      if (!res.success) {
        setMessage(res.error ?? "删除失败");
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setMessage("用户已删除");
    });
  }, []);

  return (
    <div className="space-y-4">
      <div className="relative max-w-xs">
        <div className="absolute inset-0 flex items-center pl-3 pointer-events-none">
          <Search className="h-4 w-4 text-muted-foreground" />
        </div>
        <Input
          placeholder="搜索用户名、姓名或手机号..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {message && (
        <p className={`text-sm ${message.includes("已删除") || message.includes("已更新") ? "text-green-600 dark:text-green-500" : "text-destructive"}`} role="alert">
          {message}
        </p>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>账户名</TableHead>
            <TableHead>姓名</TableHead>
            <TableHead>手机</TableHead>
            <TableHead>角色</TableHead>
            <TableHead className="w-[100px] text-center">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredUsers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                {searchQuery ? "未找到匹配的用户" : "暂无用户数据"}
              </TableCell>
            </TableRow>
          ) : (
            filteredUsers.map((u) => {
              const isSelf = u.id === currentUserId;
              const isSuper = u.role === "super_admin";

              return (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    {u.username || u.id.slice(0, 8) + "…"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {u.fullName ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {u.phone ?? "—"}
                  </TableCell>
                  <TableCell className={isSuper ? "text-primary font-medium" : "text-muted-foreground"}>
                    {roleDisplayLabel(u.role)}
                    {isSelf && "（当前账号）"}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      {!isSuper && !isSelf && (
                        <Dialog open={editingUser?.id === u.id} onOpenChange={(open) => !open && closeEditDialog()}>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={isPending}
                              title="编辑用户"
                              onClick={() => openEditDialog(u)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-sm">
                            <DialogHeader>
                              <DialogTitle>编辑用户信息</DialogTitle>
                              <DialogDescription>
                                修改「{editingUser?.username}」的信息
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="edit-fullName">姓名</Label>
                                <Input
                                  id="edit-fullName"
                                  value={editForm.fullName}
                                  onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="edit-phone">手机号</Label>
                                <Input
                                  id="edit-phone"
                                  value={editForm.phone}
                                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                                />
                              </div>
                              {isCurrentSuperAdmin && (
                                <div className="space-y-2">
                                  <Label>角色</Label>
                                  <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="radio"
                                        name="edit-role"
                                        value="user"
                                        checked={editForm.role === "user"}
                                        onChange={() => setEditForm((f) => ({ ...f, role: "user" }))}
                                        className="accent-primary"
                                      />
                                      <span className="text-sm">普通用户</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="radio"
                                        name="edit-role"
                                        value="admin"
                                        checked={editForm.role === "admin"}
                                        onChange={() => setEditForm((f) => ({ ...f, role: "admin" }))}
                                        className="accent-primary"
                                      />
                                      <span className="text-sm">管理员</span>
                                    </label>
                                  </div>
                                </div>
                              )}
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={closeEditDialog}>
                                取消
                              </Button>
                              <Button onClick={saveEdit} disabled={isPending}>
                                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                保存
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                      {!isSelf && !isSuper && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={isPending}
                              title="删除用户"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-sm">
                            <DialogHeader>
                              <DialogTitle>确认删除用户</DialogTitle>
                              <DialogDescription>
                                确定要删除用户「{u.username}」吗？此操作无法撤销。
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => {}}>
                                取消
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => onDeleteUser(u.id, u.username)}
                                disabled={isPending}
                              >
                                删除
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      {filteredUsers.length > 0 && (
        <p className="text-xs text-muted-foreground">
          共 {filteredUsers.length} 个用户{searchQuery && `（筛选自 ${users.length} 个）`}。
          {isCurrentSuperAdmin ? "超级管理员可编辑用户信息或删除账号。" : "管理员可删除普通用户账号。"}
        </p>
      )}
    </div>
  );
}
