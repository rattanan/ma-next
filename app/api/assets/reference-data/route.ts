import type { NextRequest } from "next/server";
import { getRequestMeta } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { getAssetFormReferences } from "@/lib/assets/service";
import { apiError } from "@/lib/http";

export async function GET(request: NextRequest) {
  const meta = getRequestMeta(request);
  try { await requirePermission(request, "ASSET_READ"); return Response.json(await getAssetFormReferences()); }
  catch (error) { return apiError(error, meta.requestId); }
}
