import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import {
  createAssetHierarchyLink, createAssetSparePartLink, deleteAssetHierarchyLink, deleteAssetSparePartLink,
  updateAssetHierarchyLink, updateAssetSparePartLink,
} from "@/lib/assets/service";
import { assetHierarchyLinkSchema, assetRelationDeleteSchema, assetSparePartLinkSchema } from "@/lib/assets/validation";
import { apiError, HttpError } from "@/lib/http";

type Context = { params: Promise<{ id: string; type: string }> };

async function authorize(request: NextRequest) {
  if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED");
  return requirePermission(request, "ASSET_HIERARCHY_MANAGE");
}

export async function POST(request: NextRequest, context: Context) {
  const meta = getRequestMeta(request);
  try {
    const session = await authorize(request); const { id, type } = await context.params; const body = await request.json();
    if (type === "hierarchy") return Response.json(await createAssetHierarchyLink(id, assetHierarchyLinkSchema.parse(body), session.user, meta), { status: 201 });
    if (type === "spare-parts") return Response.json(await createAssetSparePartLink(id, assetSparePartLinkSchema.parse(body), session.user, meta), { status: 201 });
    throw new HttpError(404, "Relation type not found", "RELATION_TYPE_NOT_FOUND");
  } catch (error) { return apiError(error, meta.requestId); }
}

export async function PATCH(request: NextRequest, context: Context) {
  const meta = getRequestMeta(request);
  try {
    const session = await authorize(request); const { id, type } = await context.params; const body = await request.json();
    const linkId = assetRelationDeleteSchema.shape.linkId.parse(body.linkId); const { linkId: _linkId, ...input } = body; void _linkId;
    if (type === "hierarchy") return Response.json(await updateAssetHierarchyLink(id, linkId, assetHierarchyLinkSchema.parse(input), session.user, meta));
    if (type === "spare-parts") return Response.json(await updateAssetSparePartLink(id, linkId, assetSparePartLinkSchema.parse(input), session.user, meta));
    throw new HttpError(404, "Relation type not found", "RELATION_TYPE_NOT_FOUND");
  } catch (error) { return apiError(error, meta.requestId); }
}

export async function DELETE(request: NextRequest, context: Context) {
  const meta = getRequestMeta(request);
  try {
    const session = await authorize(request); const { id, type } = await context.params; const { linkId } = assetRelationDeleteSchema.parse(await request.json());
    if (type === "hierarchy") return Response.json(await deleteAssetHierarchyLink(id, linkId, session.user, meta));
    if (type === "spare-parts") return Response.json(await deleteAssetSparePartLink(id, linkId, session.user, meta));
    throw new HttpError(404, "Relation type not found", "RELATION_TYPE_NOT_FOUND");
  } catch (error) { return apiError(error, meta.requestId); }
}
