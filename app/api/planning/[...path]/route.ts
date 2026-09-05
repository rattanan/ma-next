import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { getRequestMeta, isSameOrigin } from "@/lib/auth/request";
import { apiError, HttpError } from "@/lib/http";
import * as service from "@/lib/planning/service";
import { scopeSchema } from "@/lib/planning/validation";

type Context = { params: Promise<{ path: string[] }> };
export async function GET(request: NextRequest, context: Context) {
  const meta = getRequestMeta(request);
  try {
    const { user } = await requireSession(request);
    const { path } = await context.params; const [area, id] = path;
    if (area === "references" && path.length === 1) return Response.json(await service.planningReferences(user, z.enum(["projects", "programs"]).parse(request.nextUrl.searchParams.get("area") ?? "projects")));
    if (area === "projects" && path.length === 1) return Response.json({ items: await service.listProjects(user, z.coerce.number().int().min(1).max(10000).parse(request.nextUrl.searchParams.get("page") ?? 1)) });
    if (area === "projects" && path.length === 2) return Response.json(await service.projectDetail(z.string().uuid().parse(id), user));
    if (area === "programs" && path.length === 1) return Response.json(await service.listPrograms(user));
    if (area === "programs" && path.length === 2) return Response.json(await service.programDetail(z.string().uuid().parse(id), user, request.nextUrl.searchParams.has("from") ? Object.fromEntries(request.nextUrl.searchParams) : undefined));
    throw new HttpError(404, "Planning endpoint not found");
  } catch (error) { return apiError(error, meta.requestId); }
}
export async function POST(request: NextRequest, context: Context) {
  const meta = getRequestMeta(request);
  try {
    if (!isSameOrigin(request)) throw new HttpError(403, "Invalid request origin", "CSRF_REJECTED");
    const { user } = await requireSession(request);
    const { path } = await context.params; const [area, id, command] = path;
    const body = await request.json();
    if (path.length > 3) throw new HttpError(404, "Planning endpoint not found");
    if (path.length === 1) {
      if (area === "projects") return Response.json(await service.createProject(body, user), { status: 201 });
      if (area === "programs") return Response.json(await service.createProgram(body, user), { status: 201 });
      if (area === "templates") return Response.json(await service.createTemplate(body, user), { status: 201 });
    }
    z.string().uuid().parse(id);
    if (area === "assets" && command === "scope") { await service.bindAssetScope(id, scopeSchema.parse(body), user); return Response.json({ ok: true }); }
    if (area === "projects" && command === "tasks") return Response.json(await service.addProjectTask(id, body, user), { status: 201 });
    if (area === "projects" && command) return Response.json(await service.commandProject(id, command, body, user));
    if (area === "tasks" && ["convert", "preview"].includes(command)) return Response.json(await service.convertTask(id, body, user, command === "preview"));
    if (area === "tasks" && command) return Response.json(await service.commandTask(id, command, body, user));
    if (area === "programs" && command === "generate") return Response.json(await service.generateProgram(id, body, user));
    if (area === "programs" && command) { await service.commandProgram(id, command, body, user); return Response.json({ ok: true }); }
    throw new HttpError(404, "Planning endpoint not found");
  } catch (error) { return apiError(error, meta.requestId); }
}
