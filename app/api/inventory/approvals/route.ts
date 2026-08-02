import type { NextRequest } from "next/server";
import { getRequestMeta } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { listInventoryApprovals } from "@/lib/inventory/service";

export async function GET(request: NextRequest) { const meta = getRequestMeta(request); try { const session = await requirePermission(request, "VIEW_APPROVAL_CENTER"); const params = request.nextUrl.searchParams; return Response.json(await listInventoryApprovals(session.user, { tab: params.get("tab") ?? "pending", q: params.get("q") ?? "", page: Number(params.get("page") ?? 1), pageSize: Number(params.get("pageSize") ?? 20) })); } catch (error) { return apiError(error, meta.requestId); } }
