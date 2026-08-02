import "dotenv/config";
import { hash } from "bcryptjs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";

function options(url: string) { const value = new URL(url); return { host: value.hostname, port: Number(value.port || 3306), user: decodeURIComponent(value.username), password: decodeURIComponent(value.password), database: value.pathname.replace(/^\//, ""), charset: "utf8mb4", collation: "utf8mb4_unicode_ci", connectionLimit: 5 }; }
const demoUsers = [
  ["operator.demo@example.test", "operator.demo", "Operator User", "OPERATOR"],
  ["manager.demo@example.test", "manager.demo", "Maintenance Manager User", "MAINTENANCE_MANAGER"],
  ["technician.a@example.test", "technician.a", "Technician A", "TECHNICIAN"],
  ["technician.b@example.test", "technician.b", "Technician B", "TECHNICIAN"],
] as const;
const scenarios = [
  ["DEMO-SERVER-AC", "Air conditioner failure in a server room", "WAITING_FOR_OPERATOR_ACCEPTANCE", "WAITING_FOR_OPERATOR_ACCEPTANCE", "CRITICAL"],
  ["DEMO-CCTV", "CCTV camera offline", "IN_MAINTENANCE", "IN_PROGRESS", "HIGH"],
  ["DEMO-PUMP", "Water pump vibration", "IN_MAINTENANCE", "RETURNED_TO_TECHNICIAN", "HIGH"],
  ["DEMO-SWITCH", "Network switch overheating", "SUBMITTED", null, "CRITICAL"],
  ["DEMO-LIGHT", "Streetlight repeat failure", "CLOSED", "CLOSED", "MEDIUM"],
] as const;

async function main() {
  const url = process.env.DATABASE_URL; if (!url) throw new Error("DATABASE_URL is required");
  if (process.env.NODE_ENV === "production") throw new Error("Workflow demo seed is disabled in production");
  const prisma = new PrismaClient({ adapter: new PrismaMariaDb(options(url)) });
  try {
    const organization = await prisma.organization.findUnique({ where: { code: "DEMO" } }); if (!organization) throw new Error("Run npm run db:seed before the workflow demo seed");
    const site = await prisma.site.findFirstOrThrow({ where: { organizationId: organization.id, code: "MAIN" } });
    const operations = await prisma.department.upsert({ where: { organizationId_code: { organizationId: organization.id, code: "OPS" } }, update: {}, create: { organizationId: organization.id, siteId: site.id, code: "OPS", name: "Operations" } });
    const passwordHash = await hash(process.env.SEED_DEMO_PASSWORD || "DemoChange!123", 12); const users: Record<string, { id: string; fullName: string }> = {};
    for (const [email, username, fullName, roleCode] of demoUsers) {
      const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
      const user = await prisma.user.upsert({ where: { email }, update: { fullName, legacyRole: roleCode, status: "ACTIVE" }, create: { email, username, fullName, passwordHash, legacyRole: roleCode, status: "ACTIVE", mustChangePassword: true } }); users[roleCode === "TECHNICIAN" ? username : roleCode] = user;
      const assigned = await prisma.userRole.findFirst({ where: { userId: user.id, roleId: role.id, scopeType: "ORGANIZATION", organizationId: organization.id } }); if (!assigned) await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, scopeType: "ORGANIZATION", organizationId: organization.id } });
    }
    const operator = users.OPERATOR; const manager = users.MAINTENANCE_MANAGER; const technicianA = users["technician.a"]; const technicianB = users["technician.b"];
    const type = await prisma.assetType.upsert({ where: { code: "WORKFLOW_DEMO" }, update: { active: true }, create: { code: "WORKFLOW_DEMO", name: "Workflow demo equipment", createdBy: manager.id, updatedBy: manager.id } });
    for (let index = 0; index < scenarios.length; index += 1) {
      const [assetCode, title, notificationStatus, workStatus, priority] = scenarios[index]; const suffix = String(index + 1).padStart(3, "0"); const now = new Date(Date.now() - (scenarios.length - index) * 3_600_000);
      const asset = await prisma.asset.upsert({ where: { code: assetCode }, update: { status: "ACTIVE" }, create: { code: assetCode, name: title, assetTypeId: type.id, structureLevel: "EQUIPMENT", location: index === 0 ? "Server room A" : index === 4 ? "North access road" : "Demo plant", criticality: priority === "CRITICAL" ? "CRITICAL" : "HIGH", status: "ACTIVE", ownerUserId: operator.id, createdBy: manager.id, updatedBy: manager.id } });
      const notification = await prisma.maintenanceNotification.upsert({ where: { code: `MN-DEMO-${suffix}` }, update: {}, create: { code: `MN-DEMO-${suffix}`, organizationId: organization.id, siteId: site.id, assetId: asset.id, title, description: `Demonstration report: ${title}`, operationalImpact: priority === "CRITICAL" ? "Service interruption" : "Reduced service", type: "CORRECTIVE", priority, severity: priority === "CRITICAL" ? "CRITICAL" : "MAJOR", equipmentOperatingStatus: "DEGRADED", status: notificationStatus, requestedBy: operator.id, departmentId: operations.id, submittedAt: now, reviewedAt: workStatus ? new Date(now.getTime() + 600_000) : null, reviewedBy: workStatus ? manager.id : null, operatorAcceptedBy: notificationStatus === "CLOSED" ? operator.id : null, operatorAcceptedAt: notificationStatus === "CLOSED" ? new Date(now.getTime() + 10_800_000) : null, closedBy: notificationStatus === "CLOSED" ? operator.id : null, closedAt: notificationStatus === "CLOSED" ? new Date(now.getTime() + 14_400_000) : null, createdBy: operator.id, updatedBy: notificationStatus === "CLOSED" ? operator.id : manager.id } });
      if (!workStatus) continue;
      const order = await prisma.workOrder.upsert({ where: { code: `WO-DEMO-${suffix}` }, update: {}, create: { code: `WO-DEMO-${suffix}`, organizationId: organization.id, siteId: site.id, notificationId: notification.id, sourceType: "NOTIFICATION", workType: "CORRECTIVE", assetId: asset.id, title, description: `Inspect, repair, test, and return ${title.toLowerCase()} to service.`, priority, severity: priority === "CRITICAL" ? "CRITICAL" : "MAJOR", equipmentOperatingStatus: "DEGRADED", status: workStatus, departmentId: operations.id, assignedTo: index === 4 ? technicianB.id : technicianA.id, assignedBy: manager.id, assignedAt: now, technicianAcceptedAt: new Date(now.getTime() + 600_000), startedAt: new Date(now.getTime() + 1_200_000), managerApprovedAt: ["WAITING_FOR_OPERATOR_ACCEPTANCE", "OPERATOR_ACCEPTED", "CLOSED"].includes(workStatus) ? new Date(now.getTime() + 7_200_000) : null, operatorAcceptedAt: workStatus === "CLOSED" ? new Date(now.getTime() + 10_800_000) : null, closedAt: workStatus === "CLOSED" ? new Date(now.getTime() + 14_000_000) : null, dueAt: new Date(now.getTime() + 86_400_000), createdBy: manager.id, updatedBy: manager.id } });
      if (!(await prisma.workOrderAssignment.findFirst({ where: { workOrderId: order.id } }))) await prisma.workOrderAssignment.create({ data: { workOrderId: order.id, departmentId: operations.id, userId: technicianA.id, teamName: "Demo Maintenance", assignedAt: now, assignedBy: manager.id, note: "Initial demo assignment" } });
      if (index === 4 && !(await prisma.workOrderCompletion.findFirst({ where: { workOrderId: order.id } }))) {
        const first = await prisma.workOrderCompletion.create({ data: { workOrderId: order.id, revisionNumber: 1, result: "Lamp restored but intermittent", problem: "Repeated lamp outage", cause: "Loose terminal", solution: "Tightened terminal", notes: "Initial repair", durationMinutes: 35, testProcedure: "Switch cycle test", testResult: "Passed initially", managerDecision: "RETURNED", managerId: manager.id, managerComment: "Operator still observed flicker", managerReviewedAt: new Date(now.getTime() + 5_000_000), completedBy: technicianA.id, completedAt: new Date(now.getTime() + 4_000_000) } });
        await prisma.workOrderRecheck.create({ data: { workOrderId: order.id, completionId: first.id, cycleNumber: 1, requestedByUserId: operator.id, requestedByRole: "OPERATOR", returnReason: "Streetlight still flickers", requiredActions: JSON.stringify(["Inspect cable termination", "Repeat night test"]), assignedTechnicianId: technicianB.id, returnedAt: new Date(now.getTime() + 6_000_000), status: "APPROVED", resolvedAt: new Date(now.getTime() + 9_000_000) } });
        await prisma.workOrderAssignment.updateMany({ where: { workOrderId: order.id, endedAt: null }, data: { endedAt: new Date(now.getTime() + 6_100_000) } }); await prisma.workOrderAssignment.create({ data: { workOrderId: order.id, departmentId: operations.id, userId: technicianB.id, teamName: "Demo Maintenance", assignedAt: new Date(now.getTime() + 6_100_000), assignedBy: manager.id, note: "Reassigned for independent recheck" } });
        await prisma.workOrderCompletion.create({ data: { workOrderId: order.id, revisionNumber: 2, result: "Streetlight stable", problem: "Intermittent supply", cause: "Damaged cable lug", solution: "Replaced cable lug and weather seal", notes: "Second immutable completion revision", durationMinutes: 55, testProcedure: "Ten switch cycles and 30-minute load test", testResult: "Passed", managerDecision: "APPROVED", managerId: manager.id, managerComment: "Evidence and test accepted", managerReviewedAt: new Date(now.getTime() + 9_500_000), completedBy: technicianB.id, completedAt: new Date(now.getTime() + 9_000_000) } });
        await prisma.workOrderOperatorDecision.create({ data: { workOrderId: order.id, notificationId: notification.id, decision: "REJECTED", reason: "Flicker remained", remainingProblem: "Light flickered after first repair", decidedBy: operator.id, decidedAt: new Date(now.getTime() + 5_500_000) } }); await prisma.workOrderOperatorDecision.create({ data: { workOrderId: order.id, notificationId: notification.id, decision: "ACCEPTED", reason: "Stable after recheck", decidedBy: operator.id, decidedAt: new Date(now.getTime() + 10_800_000) } });
      }
      if (!(await prisma.workOrderEvent.findFirst({ where: { workOrderId: order.id } }))) await prisma.workOrderEvent.createMany({ data: [{ workOrderId: order.id, eventType: "WORK_ORDER_CREATED", toStatus: "CREATED", actorUserId: manager.id, actorRole: "MAINTENANCE_MANAGER", createdAt: now }, { workOrderId: order.id, eventType: "TECHNICIAN_ASSIGNED", fromStatus: "CREATED", toStatus: "ASSIGNED", actorUserId: manager.id, actorRole: "MAINTENANCE_MANAGER", createdAt: new Date(now.getTime() + 1000) }] });
    }
    console.info("Workflow demo seed completed. Demo users must change the configured demo password at first login.");
  } finally { await prisma.$disconnect(); }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Workflow seed failed"); process.exitCode = 1; });
