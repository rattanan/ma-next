import InventoryWorkspace from "@/components/inventory/inventory-workspace";
import { getCurrentSession } from "@/lib/auth/session";

export default async function StockCardPage() { const session = await getCurrentSession(); return <InventoryWorkspace section="stock-card" permissions={session?.user.permissions ?? []} />; }
