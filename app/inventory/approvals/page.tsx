import InventoryWorkspace from "@/components/inventory/inventory-workspace";
import { getCurrentSession } from "@/lib/auth/session";

export default async function InventoryApprovalsPage() { const session = await getCurrentSession(); return <InventoryWorkspace section="approvals" permissions={session?.user.permissions ?? []} />; }
