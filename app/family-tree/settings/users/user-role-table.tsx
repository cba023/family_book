"use client";

import { useState, useTransition } from "react";
import { setManagedUserRole, type ManagedUserRow } from "./actions";
import { roleDisplayLabel } from "@/lib/auth/roles";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = {
  initialUsers: ManagedUserRow[];
  currentUserId: string;
};

export function UserRoleTable({ initialUsers, currentUserId }: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onRoleChange = (userId: string, value: string) => {
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
    });
  };

  return (
    <div className="space-y-4">
      {message && (
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>账户名</TableHead>
            <TableHead>姓名</TableHead>
            <TableHead>手机</TableHead>
            <TableHead>当前角色</TableHead>
            <TableHead className="w-[200px]">调整为</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => {
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
                <TableCell>{roleDisplayLabel(u.role)}</TableCell>
                <TableCell>
                  {isSuper || isSelf ? (
                    <span className="text-sm text-muted-foreground">
                      {isSelf ? "当前账号" : "不可更改"}
                    </span>
                  ) : (
                    <Select
                      value={u.role === "admin" ? "admin" : "user"}
                      onValueChange={(v) => onRoleChange(u.id, v)}
                      disabled={isPending}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">普通用户</SelectItem>
                        <SelectItem value="admin">管理员</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">
        首个自行注册的账号为超级管理员。上方可新建账号；本表可将非超管用户设为管理员或普通用户，不能变更超级管理员。
      </p>
    </div>
  );
}
