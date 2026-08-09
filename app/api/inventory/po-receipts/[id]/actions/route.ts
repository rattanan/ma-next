import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requireSession } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { cancelInventoryDocument, confirmPurchaseOrderReceipt } from "@/lib/inventory/service";
import { purchaseOrderReceiptActionSchema } from "@/lib/inventory/validation";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const meta = getRequestMeta(request);
  try {
    if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED");
    const session = await requireSession(request);
    const input = purchaseOrderReceiptActionSchema.parse(await request.json());
    const id = (await params).id;
    if (input.action === "CONFIRM") return Response.json(await confirmPurchaseOrderReceipt(id, session.user, meta));
    return Response.json(await cancelInventoryDocument(id, session.user, meta));
  } catch (error) {
    return apiError(error, meta.requestId);
  }
}
