import type { NextRequest } from "next/server";
import { getRequestMeta } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { getInventoryApprovalDetail } from "@/lib/inventory/service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const meta = getRequestMeta(request); try { const session = await requirePermission(request, "VIEW_APPROVAL_CENTER"); return Response.json(await getInventoryApprovalDetail((await params).id, session.user)); } catch (error) { return apiError(error, meta.requestId); } }
