import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requireSession } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { assignGovernedWorkOrder, closeGovernedWorkOrder, decideCompletion, recordOperatorDecision, returnOperatorRejection, setWaitingStatus, submitCompletionRevision, technicianTransition } from "@/lib/maintenance/governed-service";
import { closeSchema, completionRevisionSchema, governedAssignmentSchema, managerCompletionDecisionSchema, operatorDecisionSchema, progressNoteSchema, waitingStatusSchema } from "@/lib/maintenance/validation";
import { sendWorkflowAlert } from "@/lib/maintenance/alerts";

const commands = new Set(["assign", "accept-assignment", "start", "wait", "resume", "submit-completion", "manager-decision", "operator-decision", "return-operator-rejection", "close"]);
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; command: string }> }) {
  const meta = getRequestMeta(request);
  try {
    if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED"); const session = await requireSession(request); const { id, command } = await params; if (!commands.has(command)) throw new HttpError(404, "Unknown work-order command", "ACTION_NOT_FOUND"); const body = await request.json().catch(() => ({}));
    const result = command === "assign" ? await assignGovernedWorkOrder(id, governedAssignmentSchema.parse(body), session.user, meta)
      : command === "accept-assignment" ? await technicianTransition(id, "ACCEPT_ASSIGNMENT", progressNoteSchema.parse(body), session.user, meta)
      : command === "start" ? await technicianTransition(id, "START", progressNoteSchema.parse(body), session.user, meta)
      : command === "wait" ? await setWaitingStatus(id, waitingStatusSchema.parse(body), session.user, meta)
      : command === "resume" ? await technicianTransition(id, "RESUME", progressNoteSchema.parse(body), session.user, meta)
      : command === "submit-completion" ? await submitCompletionRevision(id, completionRevisionSchema.parse(body), session.user, meta)
      : command === "manager-decision" ? await decideCompletion(id, managerCompletionDecisionSchema.parse(body), session.user, meta)
      : command === "operator-decision" ? await recordOperatorDecision(id, operatorDecisionSchema.parse(body), session.user, meta)
      : command === "return-operator-rejection" ? await returnOperatorRejection(id, managerCompletionDecisionSchema.parse(body), session.user, meta)
      : await closeGovernedWorkOrder(id, closeSchema.parse(body).note, session.user, meta);
    await sendWorkflowAlert({ entity: "WORK_ORDER", id, command, body }, session.user, meta); return Response.json(result, { status: command === "submit-completion" ? 201 : 200 });
  } catch (error) { return apiError(error, meta.requestId); }
}
