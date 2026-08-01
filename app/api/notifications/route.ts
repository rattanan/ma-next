import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { notificationSchema } from "@/lib/notifications/validation";
import { createNotification, listNotifications } from "@/lib/notifications/service";

export async function GET(request: NextRequest) { const meta = getRequestMeta(request); try { const session = await requirePermission(request, "VIEW_NOTIFICATIONS"); return Response.json({ notifications: await listNotifications(session.user.id) }); } catch (error) { return apiError(error, meta.requestId); } }
export async function POST(request: NextRequest) { const meta = getRequestMeta(request); try { if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED"); const session = await requirePermission(request, "MANAGE_NOTIFICATIONS"); const notification = await createNotification(notificationSchema.parse(await request.json()), session.user, meta); return Response.json({ notification }, { status: 201 }); } catch (error) { return apiError(error, meta.requestId); } }
