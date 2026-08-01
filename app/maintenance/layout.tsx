import { ProtectedShell } from "@/components/shell/protected-shell";

export default async function MaintenanceLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedShell permission="VIEW_MAINTENANCE">{children}</ProtectedShell>;
}
