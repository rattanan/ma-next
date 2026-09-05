import { ProtectedShell } from "@/components/shell/protected-shell";

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedShell>{children}</ProtectedShell>;
}
