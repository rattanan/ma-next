import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { archiveAssetRecord, getAssetDetail, updateAssetRecord } from "@/lib/assets/service";
import { assetArchiveSchema, assetMutationSchema } from "@/lib/assets/validation";
import { apiError, HttpError } from "@/lib/http";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const meta = getRequestMeta(request);
  try {
    await requirePermission(request, "ASSET_READ");
    const { id } = await context.params;
    return Response.json(await getAssetDetail(id));
  } catch (error) { return apiError(error, meta.requestId); }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const meta = getRequestMeta(request);
  try {
    if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED");
    const session = await requirePermission(request, "ASSET_UPDATE"); const { id } = await context.params;
    return Response.json(await updateAssetRecord(id, assetMutationSchema.parse(await request.json()), session.user, meta));
  } catch (error) { return apiError(error, meta.requestId); }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const meta = getRequestMeta(request);
  try {
    if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED");
    const session = await requirePermission(request, "ASSET_ARCHIVE"); const { id } = await context.params;
    const input = assetArchiveSchema.parse(await request.json());
    return Response.json(await archiveAssetRecord(id, input.reason, session.user, meta));
  } catch (error) { return apiError(error, meta.requestId); }
}
