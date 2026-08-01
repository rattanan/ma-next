import { z } from "zod";
const code = z.string().trim().min(2).max(80).regex(/^[A-Za-z0-9_.-]+$/).transform((value) => value.toUpperCase());
export const masterDataTypeSchema = z.object({ code, name: z.string().trim().min(2).max(160), description: z.string().trim().max(4000).optional().default(""), valueSchema: z.string().trim().max(16000).optional().default(""), active: z.boolean().default(true) });
export const masterDataValueSchema = z.object({ masterDataTypeId: z.uuid(), code, label: z.string().trim().min(1).max(190), description: z.string().trim().max(4000).optional().default(""), sortOrder: z.coerce.number().int().min(0).max(100000).default(0), metadata: z.string().trim().max(16000).optional().default(""), active: z.boolean().default(true) });
