import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";

export default async function MaintenanceLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  if (session.user.mustChangePassword) redirect("/change-password");
  if (!hasPermission(session.user.role, "VIEW_MAINTENANCE")) redirect("/profile?error=forbidden");
  return children;
}
