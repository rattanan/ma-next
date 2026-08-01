import { compare, hash } from "bcryptjs";
import { randomBytes, randomUUID } from "node:crypto";
import { eq, or } from "drizzle-orm";
import { db, pool } from "../lib/db";
import { assetCategories, assetCustomFieldDefinitions, assetCustomFieldGroups, assetCustomFieldValues, assets, assetSpareParts, assetTypes, contracts, maintenanceNotifications, notificationReviews, spareParts, users, workOrderEvents, workOrders, workOrderTasks, type Role } from "../lib/db/schema";

const definitions: Array<{ role: Role; name: string; username: string; emailKey: string; passwordKey: string; defaultEmail: string }> = [
  { role: "ADMIN", name: "System Administrator", username: "admin", emailKey: "SEED_ADMIN_EMAIL", passwordKey: "SEED_ADMIN_PASSWORD", defaultEmail: "admin@example.com" },
  { role: "DATA_SOURCE_CREATOR", name: "Data Source Creator", username: "datasource", emailKey: "SEED_DATA_SOURCE_EMAIL", passwordKey: "SEED_DATA_SOURCE_PASSWORD", defaultEmail: "datasource@example.com" },
  { role: "DASHBOARD_CREATOR", name: "Dashboard Creator", username: "dashboard", emailKey: "SEED_DASHBOARD_EMAIL", passwordKey: "SEED_DASHBOARD_PASSWORD", defaultEmail: "dashboard@example.com" },
  { role: "VIEWER", name: "Dashboard Viewer", username: "viewer", emailKey: "SEED_VIEWER_EMAIL", passwordKey: "SEED_VIEWER_PASSWORD", defaultEmail: "viewer@example.com" },
];

function temporaryPassword() {
  return `A!${randomBytes(12).toString("base64url")}9z`;
}

async function main() {
  const created: Array<{ role: Role; email: string }> = [];
  for (const definition of definitions) {
    const email = (process.env[definition.emailKey] || definition.defaultEmail).trim().toLowerCase();
    const existing = await db.select({ id: users.id }).from(users).where(or(eq(users.email, email), eq(users.username, definition.username))).limit(1);
    if (existing.length) continue;
    const supplied = process.env[definition.passwordKey];
    if (process.env.NODE_ENV === "production" && !supplied) throw new Error(`${definition.passwordKey} is required in production`);
    const password = supplied || temporaryPassword();
    const passwordHash = await hash(password, 12);
    if (await compare(password, passwordHash) !== true) throw new Error("Password hashing verification failed");
    const now = new Date();
    await db.insert(users).values({ id: randomUUID(), fullName: definition.name, username: definition.username, email, passwordHash, role: definition.role, status: "ACTIVE", mustChangePassword: true, createdAt: now, updatedAt: now });
    created.push({ role: definition.role, email });
  }
  const admin = (await db.select({ id: users.id }).from(users).where(eq(users.role, "ADMIN")).limit(1))[0];
  if (!admin) throw new Error("An administrator is required to seed maintenance masters");
  const now = new Date();
  let assetType = (await db.select().from(assetTypes).where(eq(assetTypes.code, "EQUIPMENT")).limit(1))[0];
  if (!assetType) { const id = randomUUID(); await db.insert(assetTypes).values({ id, code: "EQUIPMENT", name: "Equipment", description: "Maintainable plant and facility equipment", active: true, createdAt: now, updatedAt: now, createdBy: admin.id, updatedBy: admin.id }); assetType = (await db.select().from(assetTypes).where(eq(assetTypes.id, id)).limit(1))[0]; }
  let category = (await db.select().from(assetCategories).where(eq(assetCategories.code, "GENERAL")).limit(1))[0];
  if (!category) { const id = randomUUID(); await db.insert(assetCategories).values({ id, code: "GENERAL", name: "General", description: "Default migration category", active: true, createdAt: now, updatedAt: now, createdBy: admin.id, updatedBy: admin.id }); category = (await db.select().from(assetCategories).where(eq(assetCategories.id, id)).limit(1))[0]; }
  if (!assetType || !category) throw new Error("Asset masters could not be seeded");
  if (process.env.NODE_ENV !== "production" && !(await db.select({ id: assets.id }).from(assets).limit(1)).length) {
    const systemId = randomUUID(); const equipmentId = randomUUID(); const componentId = randomUUID(); const contractId = randomUUID();
    await db.insert(contracts).values({ id: contractId, code: "CNT-DEMO-01", name: "Rotating equipment service", contractNumber: "MA-2026-001", vendorName: "Demonstration Services", contactName: "Service Desk", startsAt: now, endsAt: new Date(now.getTime() + 365 * 86400000), amount: "250000.00", terms: "Preventive and corrective support" });
    await db.insert(assets).values([
      { id: systemId, code: "10MKA", name: "Boiler feedwater system", description: "Demo System record for the Asset Management slice", assetTypeId: assetType.id, assetCategoryId: category.id, structureLevel: "SYSTEM", location: "Block 1", criticality: "HIGH", status: "ACTIVE", unit: "SYSTEM", createdAt: now, updatedAt: now, createdBy: admin.id, updatedBy: admin.id },
      { id: equipmentId, code: "10MKA10AP001", name: "Boiler feed pump 1", description: "Main boiler feedwater pump", assetTypeId: assetType.id, assetCategoryId: category.id, parentAssetId: systemId, structureLevel: "EQUIPMENT", location: "Turbine hall", criticality: "CRITICAL", status: "ACTIVE", contractId, unit: "EA", serialNumber: "BFP-DEMO-001", maintenanceInterval: 90, runningHourCode: "10MKA10CF001", budgetId: "ME-DEMO-001", gpsCoordinates: "14.0500, 100.6100", inventoryLocationName: "Block 1 mechanical area", createdAt: now, updatedAt: now, createdBy: admin.id, updatedBy: admin.id },
      { id: componentId, code: "10MKA10AP001-M01", name: "Pump drive motor", description: "Electric motor component", assetTypeId: assetType.id, assetCategoryId: category.id, parentAssetId: equipmentId, structureLevel: "COMPONENT", location: "Turbine hall", criticality: "HIGH", status: "RESERVED", unit: "EA", serialNumber: "MTR-DEMO-001", createdAt: now, updatedAt: now, createdBy: admin.id, updatedBy: admin.id },
    ]);
    const groupId = randomUUID(); const definitionId = randomUUID();
    await db.insert(assetCustomFieldGroups).values({ id: groupId, name: "SPECIFICATION", sortOrder: 10 });
    await db.insert(assetCustomFieldDefinitions).values({ id: definitionId, assetCategoryId: category.id, groupId, name: "manufacturer", label: "Manufacturer", description: "Original equipment manufacturer", fieldType: "STRING", sortOrder: 10, active: true });
    await db.insert(assetCustomFieldValues).values({ id: randomUUID(), assetId: equipmentId, definitionId, value: "Sulzer" });
    const partId = randomUUID();
    await db.insert(spareParts).values({ id: partId, code: "BRG-6312-C3", name: "Drive-end bearing", unit: "EA", availableQuantity: "2" });
    await db.insert(assetSpareParts).values({ id: randomUUID(), sequence: 10, assetId: equipmentId, sparePartId: partId, requiredQuantity: "1", enabled: true, note: "Critical insurance spare" });
  }
  if (process.env.NODE_ENV !== "production" && !(await db.select({ id: maintenanceNotifications.id }).from(maintenanceNotifications).where(eq(maintenanceNotifications.code, "NO-DEMO-001")).limit(1)).length) {
    const demoAsset = (await db.select({ id: assets.id }).from(assets).where(eq(assets.code, "10MKA10AP001")).limit(1))[0];
    const technician = (await db.select({ id: users.id }).from(users).where(eq(users.role, "DATA_SOURCE_CREATOR")).limit(1))[0];
    if (demoAsset && technician) {
      const notificationId = randomUUID(); const orderId = randomUUID(); const dueAt = new Date(now.getTime() + 2 * 86400000);
      await db.insert(maintenanceNotifications).values({ id: notificationId, code: "NO-DEMO-001", assetId: demoAsset.id, title: "Mechanical seal leakage", description: "Visible leakage at the pump drive-end seal while equipment remains available at reduced capacity.", type: "CORRECTIVE", priority: "HIGH", severity: "MAJOR", equipmentOperatingStatus: "DEGRADED", status: "APPROVED", breakdown: false, requestedBy: admin.id, assignedPersonId: technician.id, supervisorId: admin.id, dueAt, reviewedAt: now, photoAttachmentIds: "[]", createdAt: now, updatedAt: now, createdBy: admin.id, updatedBy: admin.id });
      await db.insert(notificationReviews).values({ id: randomUUID(), notificationId, decision: "APPROVED", note: "Approved demo corrective repair", reviewedBy: admin.id, reviewedAt: now });
      await db.insert(workOrders).values({ id: orderId, code: "WO-DEMO-001", notificationId, assetId: demoAsset.id, title: "Replace mechanical seal", description: "Isolate pump, replace the leaking seal, align and operationally test.", priority: "HIGH", severity: "MAJOR", status: "OPEN", assignedTo: technician.id, supervisorId: admin.id, dueAt, createdAt: now, updatedAt: now, createdBy: admin.id, updatedBy: admin.id });
      await db.insert(workOrderTasks).values([
        { id: randomUUID(), workOrderId: orderId, sequence: 10, title: "Isolate and replace mechanical seal", description: "Apply LOTO and follow the approved maintenance procedure.", required: true, kind: "JOB_STEP", status: "OPEN", assignedTo: technician.id, createdAt: now, updatedAt: now },
        { id: randomUUID(), workOrderId: orderId, sequence: 20, title: "Verify guards and leak-free operation", description: "Complete after operational test.", required: true, kind: "CHECKLIST", status: "OPEN", assignedTo: technician.id, createdAt: now, updatedAt: now },
      ]);
      await db.insert(workOrderEvents).values({ id: randomUUID(), workOrderId: orderId, eventType: "WORK_ORDER_CREATED", toStatus: "OPEN", note: "Seeded approved corrective notification and work order", actorUserId: admin.id, createdAt: now });
    }
  }
  if (!created.length) console.log("User seed skipped: all four role users already exist.");
  else console.log(`Created ${created.length} seed user(s): ${created.map((item) => `${item.role} <${item.email}>`).join(", ")}. Reset temporary credentials through the approved admin workflow.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Seed failed");
  process.exitCode = 1;
}).finally(async () => pool.end());
