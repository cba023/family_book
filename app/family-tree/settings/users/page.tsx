import { redirect } from "next/navigation";
import { getUserRole } from "@/lib/auth/session";
import { queryOne } from "@/lib/pg";
import { ProfileForm } from "./profile-form";

export default async function SettingsProfilePage() {
  const gate = await getUserRole();
  if (!gate.user) {
    redirect("/blog");
  }
  if (gate.role === "super_admin") {
    redirect("/family-tree/settings/data-maintenance");
  }

  const profile = await queryOne<{
    full_name: string | null;
    phone: string | null;
  }>(
    `SELECT full_name, phone FROM profiles WHERE id = $1`,
    [gate.user.id],
  );

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">我的资料</h1>
      <p className="text-muted-foreground text-sm mb-8">
        修改您的个人资料和密码。
      </p>
      <ProfileForm
        currentUserId={gate.user.id}
        initialFullName={profile?.full_name ?? null}
        initialPhone={profile?.phone ?? null}
      />
    </div>
  );
}
