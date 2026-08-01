import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { createNotification } from "@/lib/maintenance/service";
import { notificationSchema } from "@/lib/maintenance/validation";

export async function POST(request: NextRequest) { const meta = getRequestMeta(request); try { if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED"); const session = await requirePermission(request, "CREATE_MAINTENANCE_NOTIFICATION"); const notification = await createNotification(notificationSchema.parse(await request.json()), session.user, meta); return NextResponse.json({ notification }, { status: 201 }); } catch (error) { return apiError(error, meta.requestId); } }
