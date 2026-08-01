import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { assetSchema } from "@/lib/maintenance/validation";
import { createAsset, listMaintenanceOverview } from "@/lib/maintenance/service";

export async function GET(request: NextRequest) { const meta = getRequestMeta(request); try { await requirePermission(request, "VIEW_MAINTENANCE"); return NextResponse.json({ assets: (await listMaintenanceOverview()).assets }); } catch (error) { return apiError(error, meta.requestId); } }
export async function POST(request: NextRequest) { const meta = getRequestMeta(request); try { if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED"); const session = await requirePermission(request, "MANAGE_WORK_ORDERS"); const asset = await createAsset(assetSchema.parse(await request.json()), session.user, meta); return NextResponse.json({ asset }, { status: 201 }); } catch (error) { return apiError(error, meta.requestId); } }
