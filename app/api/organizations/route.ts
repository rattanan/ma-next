import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { organizationSchema } from "@/lib/organization/validation";
import { createOrganization, listOrganizationDirectory } from "@/lib/organization/service";

export async function GET(request: NextRequest) { const meta = getRequestMeta(request); try { await requirePermission(request, "VIEW_ORGANIZATION"); return Response.json({ organizations: await listOrganizationDirectory() }); } catch (error) { return apiError(error, meta.requestId); } }
export async function POST(request: NextRequest) { const meta = getRequestMeta(request); try { if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED"); const session = await requirePermission(request, "MANAGE_ORGANIZATION"); const organization = await createOrganization(organizationSchema.parse(await request.json()), session.user, meta); return Response.json({ organization }, { status: 201 }); } catch (error) { return apiError(error, meta.requestId); } }
