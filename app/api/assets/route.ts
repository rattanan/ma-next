import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { createAssetRecord, listAssets } from "@/lib/assets/service";
import { assetListQuerySchema, assetMutationSchema } from "@/lib/assets/validation";
import { apiError, HttpError } from "@/lib/http";

export async function GET(request: NextRequest) {
  const meta = getRequestMeta(request);
  try {
    await requirePermission(request, "ASSET_READ");
    const filters = assetListQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    return Response.json(await listAssets(filters));
  } catch (error) { return apiError(error, meta.requestId); }
}

export async function POST(request: NextRequest) {
  const meta = getRequestMeta(request);
  try {
    if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED");
    const session = await requirePermission(request, "ASSET_CREATE");
    const result = await createAssetRecord(assetMutationSchema.parse(await request.json()), session.user, meta);
    return Response.json(result, { status: 201 });
  } catch (error) { return apiError(error, meta.requestId); }
}
