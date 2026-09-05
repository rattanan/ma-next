import { PurchaseRequestWorkspace } from "@/components/purchasing/purchasing-workspace";
import { ProtectedShell } from "@/components/shell/protected-shell";
import { getCurrentSession } from "@/lib/auth/session";
export default async function Page() { const session = await getCurrentSession(); const user = session?.user; return <ProtectedShell permission="PURCHASE_REQUEST_VIEW"><PurchaseRequestWorkspace permissions={user?.permissions ?? []} isAdmin={user?.role === "ADMIN" || user?.roleCodes?.includes("ADMIN") === true} /></ProtectedShell>; }
