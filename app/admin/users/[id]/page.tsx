import { notFound } from "next/navigation";
import { UserRoundCog } from "lucide-react";
import UserDetailForm from "@/components/admin/user-detail-form";
import { PageContainer, PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { getUser } from "@/lib/users/service";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getUser((await params).id);
  if (!user) notFound();
  return <PageContainer><PageHeader eyebrow="Administration / Users" title={user.fullName} description={`@${user.username} · ${user.email}`} icon={<UserRoundCog className="size-5" />} actions={<Badge className={user.status === "ACTIVE" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : user.status === "LOCKED" ? "border-red-200 bg-red-50 text-red-900" : "border-slate-200 bg-slate-100 text-slate-700"}>{user.status}</Badge>} metadata={`Created ${user.createdAt.toLocaleString()} · Last login ${user.lastLoginAt?.toLocaleString() ?? "Never"}`} /><UserDetailForm user={{ ...user, createdAt: user.createdAt.toISOString(), lastLoginAt: user.lastLoginAt?.toISOString() ?? null }} /></PageContainer>;
}
