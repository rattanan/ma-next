import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getRequestMeta } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError } from "@/lib/http";
import { listMaintenanceOverview } from "@/lib/maintenance/service";

export async function GET(request: NextRequest) {
  const meta = getRequestMeta(request);
  try { await requirePermission(request, "VIEW_MAINTENANCE"); return NextResponse.json(await listMaintenanceOverview()); }
  catch (error) { return apiError(error, meta.requestId); }
}
