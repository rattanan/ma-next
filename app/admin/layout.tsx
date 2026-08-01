import { ProtectedShell } from "@/components/shell/protected-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedShell permission="MANAGE_USERS">{children}</ProtectedShell>;
}
