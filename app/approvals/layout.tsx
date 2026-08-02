import { ProtectedShell } from "@/components/shell/protected-shell";

export default function ApprovalsLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedShell permission="VIEW_APPROVAL_CENTER">{children}</ProtectedShell>;
}
