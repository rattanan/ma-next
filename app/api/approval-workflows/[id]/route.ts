import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requireSession } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { approvalWorkflowMutationSchema } from "@/lib/purchasing/validation";
import { listApprovalWorkflows, updateApprovalWorkflow } from "@/lib/purchasing/service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const meta = getRequestMeta(request);
  try {
    const session = await requireSession(request);
    const result = await listApprovalWorkflows(session.user);
    const id = (await params).id;
    const workflow = result.workflows.find((item) => item.id === id);
    if (!workflow) throw new HttpError(404, "Approval workflow not found", "APPROVAL_WORKFLOW_NOT_FOUND");
    return Response.json({ workflow, departments: result.departments, users: result.users });
  } catch (error) { return apiError(error, meta.requestId); }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const meta = getRequestMeta(request);
  try {
    if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED");
    const session = await requireSession(request);
    const result = await updateApprovalWorkflow((await params).id, approvalWorkflowMutationSchema.parse(await request.json()), session.user, meta);
    return Response.json(result);
  } catch (error) { return apiError(error, meta.requestId); }
}
