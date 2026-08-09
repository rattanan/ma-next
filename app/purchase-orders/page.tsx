import { PurchaseOrderWorkspace } from "@/components/purchasing/purchasing-workspace";
import { ProtectedShell } from "@/components/shell/protected-shell";

export default function Page() { return <ProtectedShell permission="PURCHASE_ORDER_VIEW"><PurchaseOrderWorkspace /></ProtectedShell>; }
