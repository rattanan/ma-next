import InventoryWorkspace from "@/components/inventory/inventory-workspace";
import { getCurrentSession } from "@/lib/auth/session";

export default async function MovementPage() { const session = await getCurrentSession(); return <InventoryWorkspace section="movement" permissions={session?.user.permissions ?? []} />; }
