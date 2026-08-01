import type { NextRequest } from "next/server";
import { getRequestMeta } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { getAssetDetail } from "@/lib/assets/service";
import { apiError } from "@/lib/http";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const meta = getRequestMeta(request);
  try {
    await requirePermission(request, "ASSET_READ");
    const { id } = await context.params;
    return Response.json(await getAssetDetail(id));
  } catch (error) { return apiError(error, meta.requestId); }
}
