import PoReceiptWorkspace from "@/components/inventory/po-receipt-workspace";
import { getCurrentSession } from "@/lib/auth/session";

export default async function PurchaseOrderReceiptsPage() {
  const session = await getCurrentSession();
  return <PoReceiptWorkspace permissions={session?.user.permissions ?? []} />;
}
