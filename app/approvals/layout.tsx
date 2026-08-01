import { ProtectedShell } from "@/components/shell/protected-shell";

export default function ApprovalsLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedShell permission="NOTIFICATION_REVIEW">{children}</ProtectedShell>;
}
