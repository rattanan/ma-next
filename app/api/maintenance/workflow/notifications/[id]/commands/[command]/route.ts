import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requireSession } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { closeGovernedNotification, createWorkOrderFromNotification, provideNotificationInformation, reviewGovernedNotification, submitGovernedNotification } from "@/lib/maintenance/governed-service";
import { governedAssignmentSchema, governedNotificationReviewSchema, notificationCloseSchema, notificationInformationResponseSchema, notificationSubmitSchema } from "@/lib/maintenance/validation";
import { sendWorkflowAlert } from "@/lib/maintenance/alerts";

const commands = new Set(["submit", "provide-information", "review", "create-work-order", "close"]);
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; command: string }> }) {
  const meta = getRequestMeta(request);
  try {
    if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED");
    const session = await requireSession(request); const { id, command } = await params; if (!commands.has(command)) throw new HttpError(404, "Unknown notification command", "ACTION_NOT_FOUND"); const body = await request.json().catch(() => ({}));
    const result = command === "submit" ? await submitGovernedNotification(id, notificationSubmitSchema.parse(body).comment, session.user, meta)
      : command === "provide-information" ? await provideNotificationInformation(id, notificationInformationResponseSchema.parse(body), session.user, meta)
      : command === "review" ? await reviewGovernedNotification(id, governedNotificationReviewSchema.parse(body), session.user, meta)
      : command === "create-work-order" ? await createWorkOrderFromNotification(id, governedAssignmentSchema.extend({ title: governedAssignmentSchema.shape.instructions.optional(), description: governedAssignmentSchema.shape.instructions.optional() }).parse(body), session.user, meta)
      : await closeGovernedNotification(id, notificationCloseSchema.parse(body), session.user, meta);
    await sendWorkflowAlert({ entity: "NOTIFICATION", id, command, body }, session.user, meta); return Response.json(result, { status: command === "create-work-order" ? 201 : 200 });
  } catch (error) { return apiError(error, meta.requestId); }
}
