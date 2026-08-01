import { z } from "zod";
const code = z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/).transform((value) => value.toUpperCase());
export const organizationSchema = z.object({ code, name: z.string().trim().min(2).max(160), description: z.string().trim().max(4000).optional().default(""), active: z.boolean().default(true) });
export const siteSchema = z.object({ organizationId: z.uuid(), code, name: z.string().trim().min(2).max(160), timezone: z.string().trim().min(3).max(80).default("Asia/Bangkok"), address: z.string().trim().max(4000).optional().default(""), active: z.boolean().default(true) });
export const departmentSchema = z.object({ organizationId: z.uuid(), siteId: z.uuid().nullable().optional(), parentId: z.uuid().nullable().optional(), code, name: z.string().trim().min(2).max(160), active: z.boolean().default(true) });
