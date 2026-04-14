"use client";

import { useState, useTransition } from "react";
import { updateOwnProfile, changeOwnPassword } from "./actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  currentUserId: string;
  initialFullName: string | null;
  initialPhone: string | null;
};

export function ProfileForm({ currentUserId, initialFullName, initialPhone }: Props) {
  const [fullName, setFullName] = useState(initialFullName ?? "");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const res = await updateOwnProfile({
        fullName: fullName || undefined,
        phone: phone || undefined,
      });
      if (!res.success) {
        setMessage(res.error ?? "保存失败");
        return;
      }
      setMessage("资料已更新");
    });
  };

  const openPasswordDialog = () => {
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError(null);
    setPasswordDialogOpen(true);
  };

  const onConfirmChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 6) {
      setPasswordError("密码至少 6 位");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("两次输入的密码不一致");
      return;
    }

    startTransition(async () => {
      const res = await changeOwnPassword(newPassword);
      if (!res.success) {
        setPasswordError(res.error ?? "修改失败");
        return;
      }
      setPasswordDialogOpen(false);
      setMessage("密码已修改");
    });
  };

  return (
    <div className="space-y-8 max-w-md">
      <form onSubmit={onSaveProfile} className="space-y-4">
        <h2 className="text-lg font-semibold">个人资料</h2>
        <div className="space-y-2">
          <Label htmlFor="profile-fullName">姓名</Label>
          <Input
            id="profile-fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="选填"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-phone">手机号</Label>
          <Input
            id="profile-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="选填"
          />
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          保存资料
        </Button>
      </form>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">修改密码</h2>
        <Button onClick={openPasswordDialog} disabled={isPending}>
          修改密码
        </Button>
      </div>

      {message && (
        <p
          className={
            message === "资料已更新" || message === "密码已修改"
              ? "text-sm text-green-600 dark:text-green-500"
              : "text-sm text-destructive"
          }
          role="status"
        >
          {message}
        </p>
      )}

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>确认修改密码</DialogTitle>
            <DialogDescription>
              您确定要修改密码吗？修改后将使用新密码登录。
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onConfirmChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">新密码</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="至少 6 位"
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">确认密码</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入新密码"
                minLength={6}
              />
            </div>
            {passwordError && (
              <p className="text-sm text-destructive">{passwordError}</p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPasswordDialogOpen(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                确认修改
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}