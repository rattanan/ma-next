import { ProtectedShell } from "@/components/shell/protected-shell";
export default function WorkOrdersLayout({ children }: { children: React.ReactNode }) { return <ProtectedShell permission="VIEW_MAINTENANCE">{children}</ProtectedShell>; }
