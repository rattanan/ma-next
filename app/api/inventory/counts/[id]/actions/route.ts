import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requireSession } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { submitStockCount } from "@/lib/inventory/service";
import { stockCountActionSchema } from "@/lib/inventory/validation";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const meta = getRequestMeta(request); try { if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED"); const session = await requireSession(request); const input = stockCountActionSchema.parse(await request.json()); if (input.action !== "SUBMIT") throw new HttpError(501, "Use Approval Center for stock count review actions", "APPROVAL_ACTION_ROUTE_REQUIRED"); return Response.json(await submitStockCount((await params).id, session.user, meta)); } catch (error) { return apiError(error, meta.requestId); } }
