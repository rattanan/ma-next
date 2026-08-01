import type { NextRequest } from "next/server";
import { getRequestMeta } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { searchAssetTypeOptions } from "@/lib/assets/service";
import { assetTypeSearchQuerySchema } from "@/lib/assets/validation";
import { apiError } from "@/lib/http";

export async function GET(request: NextRequest) {
  const meta = getRequestMeta(request);
  try {
    await requirePermission(request, "ASSET_READ");
    const query = assetTypeSearchQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return Response.json(await searchAssetTypeOptions(query));
  } catch (error) { return apiError(error, meta.requestId); }
}
