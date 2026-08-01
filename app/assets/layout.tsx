import { ProtectedShell } from "@/components/shell/protected-shell";

export default function AssetsLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedShell>{children}</ProtectedShell>;
}
