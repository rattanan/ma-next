import type { NextRequest } from "next/server";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { departmentSchema } from "@/lib/organization/validation";
import { createDepartment } from "@/lib/organization/service";

export async function POST(request: NextRequest) { const meta = getRequestMeta(request); try { if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED"); const session = await requirePermission(request, "MANAGE_ORGANIZATION"); const department = await createDepartment(departmentSchema.parse(await request.json()), session.user, meta); return Response.json({ department }, { status: 201 }); } catch (error) { return apiError(error, meta.requestId); } }
