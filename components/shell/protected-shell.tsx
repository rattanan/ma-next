import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import type { Permission } from "@/lib/auth/permissions";
import { AppShell } from "./app-shell";

export async function ProtectedShell({ children, permission }: { children: React.ReactNode; permission?: Permission }) { const session = await getCurrentSession(); if (!session) redirect("/login"); if (session.user.mustChangePassword) redirect("/change-password"); if (permission && !session.user.permissions.includes(permission)) redirect("/profile?error=forbidden"); return <AppShell user={{ fullName: session.user.fullName, role: session.user.role, permissions: session.user.permissions }}>{children}</AppShell>; }
