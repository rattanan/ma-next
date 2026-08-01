import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import type { Permission } from "@/lib/auth/permissions";
import { apiError, HttpError } from "@/lib/http";
import { addExecutionEntry, addWorkOrderTask, closeWorkOrder, startWorkOrder, submitCompletion, updateWorkOrderTask, verifyCompletion } from "@/lib/maintenance/service";
import { closeSchema, completionSchema, executionEntrySchema, taskSchema, taskStatusSchema, verificationSchema } from "@/lib/maintenance/validation";

const permissions: Record<string, Permission> = { start: "EXECUTE_WORK_ORDERS", tasks: "MANAGE_WORK_ORDERS", "task-status": "EXECUTE_WORK_ORDERS", execution: "EXECUTE_WORK_ORDERS", completion: "EXECUTE_WORK_ORDERS", verification: "VERIFY_WORK_ORDERS", close: "CLOSE_WORK_ORDERS" };

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  const meta = getRequestMeta(request);
  try {
    if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED");
    const { id, action } = await params; const permission = permissions[action];
    if (!permission) throw new HttpError(404, "Unknown work-order action", "ACTION_NOT_FOUND");
    const session = await requirePermission(request, permission); const body = await request.json().catch(() => ({}));
    const result = action === "start" ? await startWorkOrder(id, session.user, meta)
      : action === "tasks" ? await addWorkOrderTask(id, taskSchema.parse(body), session.user, meta)
      : action === "task-status" ? await updateWorkOrderTask(id, String(body.taskId ?? ""), taskStatusSchema.parse(body), session.user, meta)
      : action === "execution" ? await addExecutionEntry(id, executionEntrySchema.parse(body), session.user, meta)
      : action === "completion" ? await submitCompletion(id, completionSchema.parse(body), session.user, meta)
      : action === "verification" ? await verifyCompletion(id, verificationSchema.parse(body), session.user, meta)
      : await closeWorkOrder(id, closeSchema.parse(body), session.user, meta);
    return NextResponse.json(result, { status: action === "tasks" || action === "execution" || action === "completion" ? 201 : 200 });
  } catch (error) { return apiError(error, meta.requestId); }
}
