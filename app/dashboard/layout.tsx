import { ProtectedShell } from "@/components/shell/protected-shell";
export default function DashboardLayout({ children }: { children: React.ReactNode }) { return <ProtectedShell permission="VIEW_DASHBOARD">{children}</ProtectedShell>; }
