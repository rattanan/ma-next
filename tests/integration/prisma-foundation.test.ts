import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../../generated/prisma/client";

const testUrl = process.env.TEST_DATABASE_URL;
function options(url: string) { const value = new URL(url); return { host: value.hostname, port: Number(value.port || 3306), user: decodeURIComponent(value.username), password: decodeURIComponent(value.password), database: value.pathname.replace(/^\//, ""), connectionLimit: 2 }; }
describe.skipIf(!testUrl)("Prisma MariaDB foundation integration", () => {
  let prisma: PrismaClient;
  beforeAll(() => { if (!testUrl || /prod(uction)?/i.test(testUrl)) throw new Error("TEST_DATABASE_URL must identify a disposable non-production database"); prisma = new PrismaClient({ adapter: new PrismaMariaDb(options(testUrl)) }); });
  afterAll(async () => { await prisma?.$disconnect(); });
  it("commits organization and audit records together", async () => { const code = `T${Date.now()}`; const result = await prisma.$transaction(async (tx) => { const organization = await tx.organization.create({ data: { code, name: "Integration Test" } }); const audit = await tx.auditLog.create({ data: { action: "ORGANIZATION_CREATED", category: "TEST", targetType: "ORGANIZATION", targetId: organization.id, targetName: organization.name, result: "SUCCESS", requestId: crypto.randomUUID() } }); return { organization, audit }; }); expect(result.audit.targetId).toBe(result.organization.id); await prisma.auditLog.delete({ where: { id: result.audit.id } }); await prisma.organization.delete({ where: { id: result.organization.id } }); });
});
