import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requireSession } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { getGovernedNotification, updateGovernedNotificationDraft } from "@/lib/maintenance/governed-service";
import { notificationDraftUpdateSchema } from "@/lib/maintenance/validation";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const meta = getRequestMeta(request);
  try { const session = await requireSession(request); return Response.json({ notification: await getGovernedNotification((await params).id, session.user) }); }
  catch (error) { return apiError(error, meta.requestId); }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const meta = getRequestMeta(request);
  try { if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED"); const session = await requireSession(request); return Response.json({ notification: await updateGovernedNotificationDraft((await params).id, notificationDraftUpdateSchema.parse(await request.json()), session.user, meta) }); }
  catch (error) { return apiError(error, meta.requestId); }
}
