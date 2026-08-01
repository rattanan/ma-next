import WorkOrderCreateForm from "@/components/work-orders/work-order-create-form";
import { getCurrentSession } from "@/lib/auth/session";
export default async function NewWorkOrderPage() { const session = await getCurrentSession(); return <WorkOrderCreateForm permitted={session?.user.permissions.includes("MANAGE_WORK_ORDERS") ?? false} />; }
