import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requireSession } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { activateApprovalWorkflow } from "@/lib/purchasing/service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const meta = getRequestMeta(request);
  try {
    if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED");
    const session = await requireSession(request);
    const body = await request.json().catch(() => ({}));
    return Response.json(await activateApprovalWorkflow((await params).id, body.active !== false, session.user, meta));
  } catch (error) { return apiError(error, meta.requestId); }
}
