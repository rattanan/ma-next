import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";

const permissionDefinitions = [
  ["VIEW_ORGANIZATION", "View organization", "ORGANIZATION"], ["MANAGE_ORGANIZATION", "Manage organization", "ORGANIZATION"],
  ["VIEW_MASTER_DATA", "View master data", "CONFIGURATION"], ["MANAGE_MASTER_DATA", "Manage master data", "CONFIGURATION"],
  ["VIEW_NOTIFICATIONS", "View notifications", "NOTIFICATIONS"], ["MANAGE_NOTIFICATIONS", "Manage notifications", "NOTIFICATIONS"],
  ["VIEW_ATTACHMENTS", "View attachments", "FILES"], ["MANAGE_ATTACHMENTS", "Manage attachments", "FILES"],
  ["MANAGE_USERS", "Manage users", "IDENTITY"], ["VIEW_LOGIN_HISTORY", "View login history", "IDENTITY"], ["VIEW_AUDIT_LOGS", "View audit logs", "AUDIT"],
  ["VIEW_MAINTENANCE", "View maintenance", "MAINTENANCE"], ["CREATE_MAINTENANCE_NOTIFICATION", "Report maintenance", "MAINTENANCE"], ["REVIEW_MAINTENANCE_NOTIFICATION", "Review maintenance notification", "MAINTENANCE"], ["MANAGE_WORK_ORDERS", "Manage work orders", "MAINTENANCE"], ["EXECUTE_WORK_ORDERS", "Execute work orders", "MAINTENANCE"], ["VERIFY_WORK_ORDERS", "Verify work orders", "MAINTENANCE"], ["CLOSE_WORK_ORDERS", "Close work orders", "MAINTENANCE"],
  ["ASSET_READ", "View asset register and detail", "ASSETS"], ["ASSET_CREATE", "Create assets", "ASSETS"], ["ASSET_UPDATE", "Update assets", "ASSETS"], ["ASSET_ARCHIVE", "Archive assets", "ASSETS"], ["ASSET_HIERARCHY_MANAGE", "Manage asset hierarchy", "ASSETS"], ["ASSET_CUSTOM_FIELDS_MANAGE", "Manage asset custom fields", "ASSETS"],
] as const;

function options(url: string) { const value = new URL(url); return { host: value.hostname, port: Number(value.port || 3306), user: decodeURIComponent(value.username), password: decodeURIComponent(value.password), database: value.pathname.replace(/^\//, ""), connectionLimit: 5 }; }
async function main() {
  const url = process.env.DATABASE_URL; if (!url) throw new Error("DATABASE_URL is required");
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(options(url)) });
  try {
    for (const [code, name, category] of permissionDefinitions) await prisma.permission.upsert({ where: { code }, update: { name, category }, create: { code, name, category } });
    const allPermissions = await prisma.permission.findMany();
    const adminRole = await prisma.role.upsert({ where: { code: "ADMIN" }, update: { active: true }, create: { code: "ADMIN", name: "Administrator", description: "Full platform administration", system: true } });
    await prisma.rolePermission.createMany({ data: allPermissions.map((permission) => ({ roleId: adminRole.id, permissionId: permission.id })), skipDuplicates: true });
    const email = (process.env.SEED_ADMIN_EMAIL || "admin@example.test").trim().toLowerCase();
    const suppliedPassword = process.env.SEED_ADMIN_PASSWORD;
    if (process.env.NODE_ENV === "production" && !suppliedPassword) throw new Error("SEED_ADMIN_PASSWORD is required in production");
    const passwordHash = await hash(suppliedPassword || "ChangeMe!123456", 12);
    const admin = await prisma.user.upsert({ where: { email }, update: { legacyRole: "ADMIN", status: "ACTIVE" }, create: { fullName: "System Administrator", username: "admin", email, passwordHash, legacyRole: "ADMIN", mustChangePassword: true } });
    const globalAssignment = await prisma.userRole.findFirst({ where: { userId: admin.id, roleId: adminRole.id, scopeType: "GLOBAL", organizationId: null, siteId: null, departmentId: null } });
    if (!globalAssignment) await prisma.userRole.create({ data: { userId: admin.id, roleId: adminRole.id, scopeType: "GLOBAL" } });
    const organization = await prisma.organization.upsert({ where: { code: "DEMO" }, update: {}, create: { code: "DEMO", name: "Demonstration Organization", description: "Local development organization" } });
    const site = await prisma.site.upsert({ where: { organizationId_code: { organizationId: organization.id, code: "MAIN" } }, update: {}, create: { organizationId: organization.id, code: "MAIN", name: "Main Site", timezone: "Asia/Bangkok" } });
    await prisma.department.upsert({ where: { organizationId_code: { organizationId: organization.id, code: "MAINT" } }, update: {}, create: { organizationId: organization.id, siteId: site.id, code: "MAINT", name: "Maintenance" } });
    const priority = await prisma.masterDataType.upsert({ where: { code: "WORK_PRIORITY" }, update: {}, create: { code: "WORK_PRIORITY", name: "Work priority", description: "Operational priority values", system: true } });
    await prisma.masterDataValue.createMany({ data: [["LOW", "Low", 10], ["MEDIUM", "Medium", 20], ["HIGH", "High", 30], ["CRITICAL", "Critical", 40]].map(([code, label, sortOrder]) => ({ masterDataTypeId: priority.id, code: String(code), label: String(label), sortOrder: Number(sortOrder) })), skipDuplicates: true });
    console.info("Seed completed for local MA Next foundation data.");
  } finally { await prisma.$disconnect(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Seed failed"); process.exitCode = 1; });
