import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { reviewMaintenanceNotification } from "@/lib/maintenance/service";
import { notificationReviewSchema } from "@/lib/maintenance/validation";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const meta = getRequestMeta(request); try { if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED"); const session = await requirePermission(request, "REVIEW_MAINTENANCE_NOTIFICATION"); const { id } = await params; return NextResponse.json(await reviewMaintenanceNotification(id, notificationReviewSchema.parse(await request.json()), session.user, meta)); } catch (error) { return apiError(error, meta.requestId); } }
