import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import type { Permission } from "@/lib/auth/permissions";
import { apiError, HttpError } from "@/lib/http";
import { addExecutionEntry, addUsedSparePart, addWorkOrderTask, closeWorkOrder, startWorkOrder, submitCompletion, updateWorkOrderTask, verifyCompletion } from "@/lib/maintenance/service";
import { acceptanceSchema, assignmentSchema, backlogSchema, closeSchema, completionSchema, executionEntrySchema, resumeSchema, sparePartUsageSchema, taskBacklogSchema, taskResumeSchema, taskSchema, taskStatusSchema, toolLoanCommandSchema, toolLoanSchema, verificationSchema } from "@/lib/maintenance/validation";
import { addToolLoan, assignWorkOrder, backlogWorkOrder, backlogWorkOrderTask, commandToolLoan, recordAcceptance, resumeWorkOrder, resumeWorkOrderTask } from "@/lib/work-orders/service";

const permissions: Record<string, Permission> = {
  assign: "MANAGE_WORK_ORDERS", start: "EXECUTE_WORK_ORDERS", backlog: "EXECUTE_WORK_ORDERS", resume: "EXECUTE_WORK_ORDERS",
  "add-task": "MANAGE_WORK_ORDERS", "task-status": "EXECUTE_WORK_ORDERS", "task-backlog": "EXECUTE_WORK_ORDERS", "task-resume": "EXECUTE_WORK_ORDERS", "time-entry": "EXECUTE_WORK_ORDERS", material: "EXECUTE_WORK_ORDERS",
  "add-tool": "MANAGE_WORK_ORDERS", "tool-command": "EXECUTE_WORK_ORDERS", acceptance: "EXECUTE_WORK_ORDERS", completion: "EXECUTE_WORK_ORDERS",
  verification: "VERIFY_WORK_ORDERS", close: "CLOSE_WORK_ORDERS",
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; command: string }> }) {
  const meta = getRequestMeta(request);
  try {
    if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED");
    const { id, command } = await params; const permission = permissions[command];
    if (!permission) throw new HttpError(404, "Unknown work-order command", "ACTION_NOT_FOUND");
    const session = await requirePermission(request, permission); const body = await request.json().catch(() => ({}));
    const result = command === "assign" ? await assignWorkOrder(id, assignmentSchema.parse(body), session.user, meta)
      : command === "start" ? await startWorkOrder(id, session.user, meta)
      : command === "backlog" ? await backlogWorkOrder(id, backlogSchema.parse(body), session.user, meta)
      : command === "resume" ? await resumeWorkOrder(id, resumeSchema.parse(body), session.user, meta)
      : command === "add-task" ? await addWorkOrderTask(id, taskSchema.parse(body), session.user, meta)
      : command === "task-status" ? await updateWorkOrderTask(id, String(body.taskId ?? ""), taskStatusSchema.parse(body), session.user, meta)
      : command === "task-backlog" ? await backlogWorkOrderTask(id, taskBacklogSchema.parse(body), session.user, meta)
      : command === "task-resume" ? await resumeWorkOrderTask(id, taskResumeSchema.parse(body), session.user, meta)
      : command === "time-entry" ? await addExecutionEntry(id, executionEntrySchema.parse(body), session.user, meta)
      : command === "material" ? await addUsedSparePart(id, sparePartUsageSchema.parse(body), session.user, meta)
      : command === "add-tool" ? await addToolLoan(id, toolLoanSchema.parse(body), session.user, meta)
      : command === "tool-command" ? await commandToolLoan(id, toolLoanCommandSchema.parse(body), session.user, meta)
      : command === "acceptance" ? await recordAcceptance(id, acceptanceSchema.parse(body), session.user, meta)
      : command === "completion" ? await submitCompletion(id, completionSchema.parse(body), session.user, meta)
      : command === "verification" ? await verifyCompletion(id, verificationSchema.parse(body), session.user, meta)
      : await closeWorkOrder(id, closeSchema.parse(body), session.user, meta);
    return Response.json(result, { status: ["add-task", "time-entry", "material", "add-tool", "acceptance", "completion"].includes(command) ? 201 : 200 });
  } catch (error) { return apiError(error, meta.requestId); }
}
