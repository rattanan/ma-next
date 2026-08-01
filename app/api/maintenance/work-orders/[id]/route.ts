import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRequestMeta } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { getWorkOrderDetail } from "@/lib/maintenance/service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const meta = getRequestMeta(request); try { await requirePermission(request, "VIEW_MAINTENANCE"); const { id } = await params; return NextResponse.json(await getWorkOrderDetail(id)); } catch (error) { return apiError(error, meta.requestId); } }
