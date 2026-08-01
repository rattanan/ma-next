import { ProtectedShell } from "@/components/shell/protected-shell";
export default function ProfileLayout({ children }: { children: React.ReactNode }) { return <ProtectedShell>{children}</ProtectedShell>; }
