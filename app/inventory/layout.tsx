import { ProtectedShell } from "@/components/shell/protected-shell";

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedShell permission="VIEW_INVENTORY">{children}</ProtectedShell>;
}
