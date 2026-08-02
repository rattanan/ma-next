import InventoryWorkspace from "@/components/inventory/inventory-workspace";
import { getCurrentSession } from "@/lib/auth/session";

export default async function InventoryDashboardPage() { const session = await getCurrentSession(); return <InventoryWorkspace section="dashboard" permissions={session?.user.permissions ?? []} />; }
