import WorkOrderList from "@/components/work-orders/work-order-list";
import { getCurrentSession } from "@/lib/auth/session";
export default async function WorkOrdersPage() { const session = await getCurrentSession(); return <WorkOrderList permissions={session?.user.permissions ?? []} />; }
