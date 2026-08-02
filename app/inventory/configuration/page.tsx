import InventoryWorkspace from "@/components/inventory/inventory-workspace";
import { getCurrentSession } from "@/lib/auth/session";

export default async function ConfigurationPage() { const session = await getCurrentSession(); return <InventoryWorkspace section="configuration" permissions={session?.user.permissions ?? []} />; }
