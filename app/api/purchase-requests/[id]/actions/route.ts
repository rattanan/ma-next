import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requireSession } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { cancelPurchaseRequest, submitPurchaseRequest } from "@/lib/purchasing/service";
import { purchaseRequestActionSchema } from "@/lib/purchasing/validation";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const meta = getRequestMeta(request);
  try {
    if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED");
    const session = await requireSession(request);
    const input = purchaseRequestActionSchema.parse(await request.json());
    const id = (await params).id;
    return Response.json(input.action === "SUBMIT" ? await submitPurchaseRequest(id, session.user, meta) : await cancelPurchaseRequest(id, session.user, meta));
  } catch (error) { return apiError(error, meta.requestId); }
}
