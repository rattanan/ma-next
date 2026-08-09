import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { createPurchaseOrderReceipt, listInventoryDocuments } from "@/lib/inventory/service";
import { inventoryListQuerySchema, purchaseOrderReceiptMutationSchema } from "@/lib/inventory/validation";

export async function GET(request: NextRequest) {
  const meta = getRequestMeta(request);
  try {
    const session = await requirePermission(request, "INVENTORY_REQUEST_VIEW");
    const query = inventoryListQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return Response.json(await listInventoryDocuments({ ...query, type: "RECEIPT", purchaseOrderOnly: true }, session.user));
  } catch (error) {
    return apiError(error, meta.requestId);
  }
}

export async function POST(request: NextRequest) {
  const meta = getRequestMeta(request);
  try {
    if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED");
    const session = await requirePermission(request, "INVENTORY_REQUEST_CREATE");
    const input = purchaseOrderReceiptMutationSchema.parse(await request.json());
    return Response.json(await createPurchaseOrderReceipt(input, session.user, meta), { status: 201 });
  } catch (error) {
    return apiError(error, meta.requestId);
  }
}
