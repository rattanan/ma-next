import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requireSession } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { cancelPurchaseOrder, issuePurchaseOrder, submitPurchaseOrder } from "@/lib/purchasing/service";
import { purchaseOrderActionSchema } from "@/lib/purchasing/validation";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const meta = getRequestMeta(request);
  try {
    if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED");
    const session = await requireSession(request);
    const input = purchaseOrderActionSchema.parse(await request.json());
    const id = (await params).id;
    return Response.json(input.action === "SUBMIT" ? await submitPurchaseOrder(id, session.user, meta) : input.action === "ISSUE" ? await issuePurchaseOrder(id, session.user, meta) : await cancelPurchaseOrder(id, session.user, meta));
  } catch (error) { return apiError(error, meta.requestId); }
}
