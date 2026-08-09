import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import type { Permission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { AppShell } from "./app-shell";

export async function ProtectedShell({ children, permission }: { children: React.ReactNode; permission?: Permission }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.mustChangePassword) redirect("/change-password");
  if (permission && !session.user.permissions.includes(permission)) redirect("/profile?error=forbidden");
  const departmentIds = [...new Set((session.user.scopes ?? []).map((scope) => scope.departmentId).filter((id): id is string => Boolean(id)))];
  const departments = departmentIds.length ? await prisma.department.findMany({ where: { id: { in: departmentIds } }, select: { name: true }, orderBy: { name: "asc" } }) : [];
  return <AppShell user={{ fullName: session.user.fullName, username: session.user.username, role: session.user.role, departments: departments.map((item) => item.name), permissions: session.user.permissions }}>{children}</AppShell>;
}
