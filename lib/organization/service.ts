import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit/service";
import type { AuthenticatedUser } from "@/lib/auth/session";
import type { RequestMeta } from "@/lib/auth/request";
import { organizationSchema, siteSchema, departmentSchema } from "./validation";

export function listOrganizationDirectory() { return prisma.organization.findMany({ include: { sites: { orderBy: { name: "asc" } }, departments: { orderBy: { name: "asc" } } }, orderBy: { name: "asc" } }); }
export function createOrganization(input: z.infer<typeof organizationSchema>, actor: AuthenticatedUser, meta: RequestMeta) { return prisma.$transaction(async (tx) => { const record = await tx.organization.create({ data: { ...input, description: input.description || null } }); await writeAudit(tx, { action: "ORGANIZATION_CREATED", category: "FOUNDATION", targetType: "ORGANIZATION", targetId: record.id, targetName: record.name, description: `Created organization ${record.code}`, newValues: input }, actor, meta); return record; }); }
export function createSite(input: z.infer<typeof siteSchema>, actor: AuthenticatedUser, meta: RequestMeta) { return prisma.$transaction(async (tx) => { const record = await tx.site.create({ data: { ...input, address: input.address || null } }); await writeAudit(tx, { action: "SITE_CREATED", category: "FOUNDATION", targetType: "SITE", targetId: record.id, targetName: record.name, description: `Created site ${record.code}`, newValues: input }, actor, meta); return record; }); }
export function createDepartment(input: z.infer<typeof departmentSchema>, actor: AuthenticatedUser, meta: RequestMeta) { return prisma.$transaction(async (tx) => { const record = await tx.department.create({ data: { ...input, siteId: input.siteId ?? null, parentId: input.parentId ?? null } }); await writeAudit(tx, { action: "DEPARTMENT_CREATED", category: "FOUNDATION", targetType: "DEPARTMENT", targetId: record.id, targetName: record.name, description: `Created department ${record.code}`, newValues: input }, actor, meta); return record; }); }
