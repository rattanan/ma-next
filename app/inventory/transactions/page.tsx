import InventoryWorkspace from "@/components/inventory/inventory-workspace";
import { getCurrentSession } from "@/lib/auth/session";

export default async function TransactionsPage() { const session = await getCurrentSession(); return <InventoryWorkspace section="transactions" permissions={session?.user.permissions ?? []} />; }
