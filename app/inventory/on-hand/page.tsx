import InventoryWorkspace from "@/components/inventory/inventory-workspace";
import { getCurrentSession } from "@/lib/auth/session";

export default async function OnHandPage() { const session = await getCurrentSession(); return <InventoryWorkspace section="on-hand" permissions={session?.user.permissions ?? []} />; }
