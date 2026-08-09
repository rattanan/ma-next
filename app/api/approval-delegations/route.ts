import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requireSession } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { createDelegation, listDelegations } from "@/lib/purchasing/approval-engine";
import { approvalDelegationSchema } from "@/lib/purchasing/validation";

export async function GET(request: NextRequest) {
  const meta = getRequestMeta(request);
  try { const session = await requireSession(request); return Response.json(await listDelegations(session.user)); }
  catch (error) { return apiError(error, meta.requestId); }
}

export async function POST(request: NextRequest) {
  const meta = getRequestMeta(request);
  try {
    if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED");
    const session = await requireSession(request);
    const input = approvalDelegationSchema.parse(await request.json());
    return Response.json(await createDelegation(input, session.user, meta), { status: 201 });
  } catch (error) { return apiError(error, meta.requestId); }
}
