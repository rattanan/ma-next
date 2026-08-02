import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { getInventoryConfiguration, updateInventorySetting } from "@/lib/inventory/service";
import { inventorySettingMutationSchema } from "@/lib/inventory/validation";

export async function GET(request: NextRequest) { const meta = getRequestMeta(request); try { const session = await requirePermission(request, "VIEW_INVENTORY"); return Response.json(await getInventoryConfiguration(session.user)); } catch (error) { return apiError(error, meta.requestId); } }
export async function PATCH(request: NextRequest) { const meta = getRequestMeta(request); try { if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED"); const session = await requirePermission(request, "INVENTORY_CONFIG_MANAGE"); return Response.json(await updateInventorySetting(inventorySettingMutationSchema.parse(await request.json()), session.user, meta)); } catch (error) { return apiError(error, meta.requestId); } }
