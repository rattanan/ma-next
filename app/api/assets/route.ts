import type { NextRequest } from "next/server";
import { getRequestMeta } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { listAssets } from "@/lib/assets/service";
import { assetListQuerySchema } from "@/lib/assets/validation";
import { apiError } from "@/lib/http";

export async function GET(request: NextRequest) {
  const meta = getRequestMeta(request);
  try {
    await requirePermission(request, "ASSET_READ");
    const filters = assetListQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return Response.json(await listAssets(filters));
  } catch (error) { return apiError(error, meta.requestId); }
}
