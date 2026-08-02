import InventoryWorkspace from "@/components/inventory/inventory-workspace";
import { getCurrentSession } from "@/lib/auth/session";

export default async function VendorsPage() { const session = await getCurrentSession(); return <InventoryWorkspace section="vendors" permissions={session?.user.permissions ?? []} />; }
