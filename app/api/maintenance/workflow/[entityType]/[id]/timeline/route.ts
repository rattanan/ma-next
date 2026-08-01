import type { NextRequest } from "next/server";
import { getRequestMeta } from "@/lib/auth/request";
import { requireSession } from "@/lib/auth/session";
import { apiError, HttpError } from "@/lib/http";
import { getGovernedTimeline } from "@/lib/maintenance/governed-service";
export async function GET(request: NextRequest, { params }: { params: Promise<{ entityType: string; id: string }> }) { const meta = getRequestMeta(request); try { const session = await requireSession(request); const { entityType, id } = await params; if (entityType !== "notifications" && entityType !== "work-orders") throw new HttpError(404, "Unknown entity type", "ENTITY_NOT_FOUND"); return Response.json({ events: await getGovernedTimeline(entityType === "notifications" ? "NOTIFICATION" : "WORK_ORDER", id, session.user) }); } catch (error) { return apiError(error, meta.requestId); } }
