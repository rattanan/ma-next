import type { NextRequest } from "next/server";
import { z } from "zod";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { requirePermission } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { masterDataTypeSchema, masterDataValueSchema } from "@/lib/master-data/validation";
import { createMasterDataType, createMasterDataValue, listMasterData } from "@/lib/master-data/service";

const payloadSchema = z.discriminatedUnion("kind", [z.object({ kind: z.literal("type"), data: masterDataTypeSchema }), z.object({ kind: z.literal("value"), data: masterDataValueSchema })]);
export async function GET(request: NextRequest) { const meta = getRequestMeta(request); try { await requirePermission(request, "VIEW_MASTER_DATA"); return Response.json({ types: await listMasterData() }); } catch (error) { return apiError(error, meta.requestId); } }
export async function POST(request: NextRequest) { const meta = getRequestMeta(request); try { if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED"); const session = await requirePermission(request, "MANAGE_MASTER_DATA"); const input = payloadSchema.parse(await request.json()); const record = input.kind === "type" ? await createMasterDataType(input.data, session.user, meta) : await createMasterDataValue(input.data, session.user, meta); return Response.json({ record }, { status: 201 }); } catch (error) { return apiError(error, meta.requestId); } }
