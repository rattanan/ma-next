import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { createGovernedNotification } from "@/lib/maintenance/governed-service";
import { notificationSchema } from "@/lib/maintenance/validation";

export async function POST(request: NextRequest) {
  const meta = getRequestMeta(request);
  try { if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED"); const session = await requirePermission(request, "NOTIFICATION_CREATE"); return Response.json({ notification: await createGovernedNotification(notificationSchema.parse(await request.json()), session.user, meta) }, { status: 201 }); }
  catch (error) { return apiError(error, meta.requestId); }
}
