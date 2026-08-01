import type { NextRequest } from "next/server";
import { getApprovalTask } from "@/lib/approvals/service";
import { approvalDecisionSchema } from "@/lib/approvals/validation";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requireSession } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { reviewGovernedNotification } from "@/lib/maintenance/governed-service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const meta = getRequestMeta(request);
  try {
    if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED");
    const session = await requireSession(request);
    const task = await getApprovalTask((await params).id, session.user);
    if (task.approvalType !== "NOTIFICATION") throw new HttpError(501, "This approval type is not actionable yet", "APPROVAL_TYPE_NOT_IMPLEMENTED");
    const input = approvalDecisionSchema.parse(await request.json());
    const review = input.action === "OPEN" ? { action: "START_REVIEW" as const, comment: input.comment ?? "" }
      : input.action === "APPROVE" ? { action: "APPROVE" as const, comment: input.comment, responsibleGroup: input.responsibleGroup, priority: input.priority, type: input.maintenanceType }
      : input.action === "RETURN" ? { action: "REQUEST_INFORMATION" as const, comment: input.reason }
      : { action: "REJECT" as const, comment: input.reason };
    return Response.json(await reviewGovernedNotification(task.referenceId, review, session.user, meta));
  } catch (error) { return apiError(error, meta.requestId); }
}
