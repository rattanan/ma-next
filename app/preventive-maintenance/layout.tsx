import { ProtectedShell } from "@/components/shell/protected-shell";
export default function Layout({ children }: { children: React.ReactNode }) { return <ProtectedShell permission="PM_VIEW">{children}</ProtectedShell>; }
