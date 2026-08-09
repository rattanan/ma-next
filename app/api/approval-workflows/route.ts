import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requireSession } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { approvalWorkflowMutationSchema } from "@/lib/purchasing/validation";
import { createApprovalWorkflow, listApprovalWorkflows } from "@/lib/purchasing/service";

export async function GET(request: NextRequest) {
  const meta = getRequestMeta(request);
  try { const session = await requireSession(request); return Response.json(await listApprovalWorkflows(session.user)); }
  catch (error) { return apiError(error, meta.requestId); }
}

export async function POST(request: NextRequest) {
  const meta = getRequestMeta(request);
  try {
    if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED");
    const session = await requireSession(request);
    const result = await createApprovalWorkflow(approvalWorkflowMutationSchema.parse(await request.json()), session.user, meta);
    return Response.json(result, { status: 201 });
  } catch (error) { return apiError(error, meta.requestId); }
}
