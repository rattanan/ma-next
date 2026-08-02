import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requirePermission, requireSession } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { createStockCount, listStockCounts } from "@/lib/inventory/service";
import { stockCountMutationSchema } from "@/lib/inventory/validation";

export async function GET(request: NextRequest) { const meta = getRequestMeta(request); try { const session = await requireSession(request); return Response.json(await listStockCounts(session.user)); } catch (error) { return apiError(error, meta.requestId); } }
export async function POST(request: NextRequest) { const meta = getRequestMeta(request); try { if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED"); const session = await requirePermission(request, "INVENTORY_COUNT_MANAGE"); return Response.json(await createStockCount(stockCountMutationSchema.parse(await request.json()), session.user, meta), { status: 201 }); } catch (error) { return apiError(error, meta.requestId); } }
