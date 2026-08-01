import { z } from "zod";

const booleanString = z.enum(["true", "false"]).transform((value) => value === "true");
export const serverEnvSchema = z.object({
  DATABASE_URL: z.string().regex(/^mysql:\/\//, "DATABASE_URL must be a MariaDB/MySQL URL"),
  APP_URL: z.url().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  SESSION_COOKIE_SECURE: booleanString.default(false),
  ATTACHMENT_DRIVER: z.enum(["LOCAL", "S3", "AZURE"]).default("LOCAL"),
  ATTACHMENT_LOCAL_ROOT: z.string().min(1).default("./storage/attachments"),
  MAX_ATTACHMENT_BYTES: z.coerce.number().int().positive().max(100 * 1024 * 1024).default(10 * 1024 * 1024),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
let cached: ServerEnv | undefined;
export function getServerEnv(): ServerEnv {
  cached ??= serverEnvSchema.parse(process.env);
  return cached;
}
