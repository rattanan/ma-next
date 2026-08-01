import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { notificationReadSchema } from "@/lib/notifications/validation";
import { updateNotificationStatus } from "@/lib/notifications/service";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) { const meta = getRequestMeta(request); try { if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED"); const session = await requirePermission(request, "VIEW_NOTIFICATIONS"); const { id } = await context.params; const notification = await updateNotificationStatus(id, notificationReadSchema.parse(await request.json()), session.user, meta); return Response.json({ notification }); } catch (error) { return apiError(error, meta.requestId); } }
