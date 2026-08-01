import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";
import { getServerEnv } from "@/lib/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function adapterFromUrl(url: string) {
  const parsed = new URL(url);
  return new PrismaMariaDb({
    host: parsed.hostname,
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ""),
    connectionLimit: 10,
  });
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter: adapterFromUrl(getServerEnv().DATABASE_URL) });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
