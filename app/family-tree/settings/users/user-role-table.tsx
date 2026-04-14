"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import { setManagedUserRole, deleteManagedUser, type ManagedUserRow } from "./actions";
import { roleDisplayLabel, type AppRole } from "@/lib/auth/roles";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Button } from "@/components/ui/button";
import { Search, Trash2, Loader2, ChevronDownIcon } from "lucide-react";

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
  const [openRoleDialog, setOpenRoleDialog] = useState<string | null>(null);

  // 当 initialUsers 变化时更新本地状态（创建用户后刷新列表）
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

  const onRoleChange = (userId: string, value: string, onSuccess?: () => void) => {
    if (value !== "admin" && value !== "user") return;
    setMessage(null);
    startTransition(async () => {
      const res = await setManagedUserRole(userId, value);
      if (!res.success) {
        setMessage(res.error ?? "保存失败");
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: value } : u)),
      );
      onSuccess?.();
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
      {/* 搜索框 */}
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
        <p className={`text-sm ${message.includes("已删除") || message.includes("成功") ? "text-green-600 dark:text-green-500" : "text-destructive"}`} role="alert">
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
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredUsers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={isCurrentSuperAdmin ? 5 : 4} className="text-center text-muted-foreground py-8">
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
                  <TableCell className="align-middle">
                    <Dialog open={openRoleDialog === u.id} onOpenChange={(open) => setOpenRoleDialog(open ? u.id : null)}>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isSuper || isSelf || isPending}
                        >
                          {roleDisplayLabel(u.role)}
                          {isSelf ? "（当前账号）" : ""}
                          {!isSelf && !isSuper && <ChevronDownIcon className="ml-1 h-3 w-3" />}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-sm">
                        <DialogHeader>
                          <DialogTitle>修改用户角色</DialogTitle>
                          <DialogDescription>
                            将「{u.username}」的角色修改为：
                          </DialogDescription>
                        </DialogHeader>
                        <Select
                          value={u.role === "admin" ? "admin" : "user"}
                          onValueChange={(v) => onRoleChange(u.id, v, () => setOpenRoleDialog(null))}
                          disabled={isPending}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">普通用户</SelectItem>
                            <SelectItem value="admin">管理员</SelectItem>
                          </SelectContent>
                        </Select>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setOpenRoleDialog(null)}>
                            取消
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                  <TableCell className="text-center">
                    {!isSelf && !isSuper && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isPending}
                            title="删除用户"
                          >
                            {isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-destructive" />
                            )}
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
          {isCurrentSuperAdmin ? "超级管理员可修改用户角色或删除账号。" : "管理员可删除普通用户账号。"}
        </p>
      )}
    </div>
  );
}
