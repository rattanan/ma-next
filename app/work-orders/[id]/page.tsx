import WorkOrderDetail from "@/components/work-orders/work-order-detail";
import { getCurrentSession } from "@/lib/auth/session";
export default async function WorkOrderPage({ params }: { params: Promise<{ id: string }> }) { const [{ id }, session] = await Promise.all([params, getCurrentSession()]); return <WorkOrderDetail id={id} permissions={session?.user.permissions ?? []} />; }
