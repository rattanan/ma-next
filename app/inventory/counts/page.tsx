import InventoryWorkspace from "@/components/inventory/inventory-workspace";
import { getCurrentSession } from "@/lib/auth/session";

export default async function CountsPage() { const session = await getCurrentSession(); return <InventoryWorkspace section="counts" permissions={session?.user.permissions ?? []} />; }
