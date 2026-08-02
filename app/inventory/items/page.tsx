import InventoryWorkspace from "@/components/inventory/inventory-workspace";
import { getCurrentSession } from "@/lib/auth/session";

export default async function StockItemsPage() { const session = await getCurrentSession(); return <InventoryWorkspace section="items" permissions={session?.user.permissions ?? []} />; }
