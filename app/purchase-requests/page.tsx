import { PurchaseRequestWorkspace } from "@/components/purchasing/purchasing-workspace";
import { ProtectedShell } from "@/components/shell/protected-shell";

export default function Page() { return <ProtectedShell permission="PURCHASE_REQUEST_VIEW"><PurchaseRequestWorkspace /></ProtectedShell>; }
