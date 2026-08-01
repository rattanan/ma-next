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
    const department = await prisma.department.upsert({ where: { organizationId_code: { organizationId: organization.id, code: "MAINT" } }, update: {}, create: { organizationId: organization.id, siteId: site.id, code: "MAINT", name: "Maintenance" } });
    const priority = await prisma.masterDataType.upsert({ where: { code: "WORK_PRIORITY" }, update: {}, create: { code: "WORK_PRIORITY", name: "Work priority", description: "Operational priority values", system: true } });
    await prisma.masterDataValue.createMany({ data: [["LOW", "Low", 10], ["MEDIUM", "Medium", 20], ["HIGH", "High", 30], ["CRITICAL", "Critical", 40]].map(([code, label, sortOrder]) => ({ masterDataTypeId: priority.id, code: String(code), label: String(label), sortOrder: Number(sortOrder) })), skipDuplicates: true });
    const equipmentType = await prisma.assetType.upsert({ where: { code: "ROTATING" }, update: { active: true }, create: { code: "ROTATING", name: "Rotating Equipment", description: "Pumps, motors and rotating packages", createdBy: admin.id, updatedBy: admin.id } });
    const pumpCategory = await prisma.assetCategory.upsert({ where: { code: "PUMP" }, update: { active: true }, create: { code: "PUMP", name: "Pump", description: "Process and utility pumps", createdBy: admin.id, updatedBy: admin.id } });
    const pump = await prisma.asset.upsert({ where: { code: "P-101" }, update: { status: "ACTIVE" }, create: { code: "P-101", name: "Boiler Feed Water Pump A", description: "Primary boiler feed-water pump", assetTypeId: equipmentType.id, assetCategoryId: pumpCategory.id, structureLevel: "EQUIPMENT", location: "Main Plant / Boiler Area", criticality: "CRITICAL", status: "ACTIVE", ownerUserId: admin.id, createdBy: admin.id, updatedBy: admin.id } });
    await prisma.sparePart.upsert({ where: { code: "SEAL-P101" }, update: { availableQuantity: 4 }, create: { code: "SEAL-P101", name: "Mechanical seal kit P-101", description: "Seal replacement kit", unit: "SET", availableQuantity: 4 } });
    const demoOrder = await prisma.workOrder.upsert({ where: { code: "WO-DEMO-001" }, update: {}, create: { code: "WO-DEMO-001", sourceType: "MANUAL", workType: "CORRECTIVE", assetId: pump.id, title: "Inspect mechanical seal leakage", description: "Confirm leakage source, isolate equipment and replace the seal if required.", priority: "HIGH", severity: "MAJOR", equipmentOperatingStatus: "DEGRADED", status: "OPEN", departmentId: department.id, crewName: "Mechanical Maintenance", assignedTo: admin.id, supervisorId: admin.id, reporterName: "Operations Shift A", reportedAt: new Date(), plannedStartAt: new Date(Date.now() + 3600000), dueAt: new Date(Date.now() + 86400000), estimatedMinutes: 180, notes: "Development acceptance record with preserved planning fields.", createdBy: admin.id, updatedBy: admin.id } });
    await prisma.workOrderTask.upsert({ where: { workOrderId_sequence: { workOrderId: demoOrder.id, sequence: 1 } }, update: {}, create: { workOrderId: demoOrder.id, sequence: 1, title: "Isolate pump and verify zero energy", description: "Apply approved isolation procedure before opening the seal housing.", required: true, kind: "JOB_STEP", status: "OPEN", assignedTo: admin.id, assetId: pump.id, estimatedMinutes: 30 } });
    await prisma.workOrderTask.upsert({ where: { workOrderId_sequence: { workOrderId: demoOrder.id, sequence: 2 } }, update: {}, create: { workOrderId: demoOrder.id, sequence: 2, title: "Confirm guard and coupling condition", required: true, kind: "CHECKLIST", status: "OPEN", responseType: "PASS_FAIL" } });
    if (!(await prisma.workOrderAssignment.findFirst({ where: { workOrderId: demoOrder.id, userId: admin.id, endedAt: null } }))) await prisma.workOrderAssignment.create({ data: { workOrderId: demoOrder.id, departmentId: department.id, userId: admin.id, teamName: "Mechanical Maintenance", assignmentType: "TECHNICIAN", assignedAt: new Date(), assignedBy: admin.id, note: "Seeded development assignment" } });
    if (!(await prisma.workOrderEvent.findFirst({ where: { workOrderId: demoOrder.id, eventType: "WORK_ORDER_CREATED" } }))) await prisma.workOrderEvent.create({ data: { workOrderId: demoOrder.id, eventType: "WORK_ORDER_CREATED", toStatus: "OPEN", note: "Seeded development work order", actorUserId: admin.id } });
    console.info("Seed completed for local MA Next foundation data.");
  } finally { await prisma.$disconnect(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Seed failed"); process.exitCode = 1; });
