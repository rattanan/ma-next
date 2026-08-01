import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
import { describe, expect, it } from "vitest";

const testUrl = process.env.TEST_DATABASE_URL;
describe.skipIf(!testUrl)("corrective maintenance service integration", () => {
  it("creates and rejects a notification with review and audit records in the service transaction", async () => {
    if (!testUrl || /prod(uction)?/i.test(testUrl)) throw new Error("TEST_DATABASE_URL must identify a disposable non-production database");
    process.env.DATABASE_URL = testUrl;
    const connection = await mysql.createConnection({ uri: testUrl });
    const userId = randomUUID(); const typeId = randomUUID(); const assetId = randomUUID(); const suffix = Date.now();
    await connection.execute("INSERT INTO users (id,full_name,username,email,password_hash,role,status,must_change_password,failed_login_attempts,created_at,updated_at) VALUES (?,?,?,?,?,'ADMIN','ACTIVE',false,0,NOW(3),NOW(3))", [userId, "CM Integration", `cm-${suffix}`, `cm-${suffix}@example.test`, "not-used"]);
    await connection.execute("INSERT INTO asset_types (id,code,name,active,created_at,updated_at,created_by,updated_by) VALUES (?,?,?,true,NOW(3),NOW(3),?,?)", [typeId, `CM${suffix}`, "CM Test Type", userId, userId]);
    await connection.execute("INSERT INTO assets (id,code,name,asset_type_id,structure_level,location,criticality,status,created_at,updated_at,created_by,updated_by) VALUES (?,?,?,?,'EQUIPMENT','Test bay','MEDIUM','ACTIVE',NOW(3),NOW(3),?,?)", [assetId, `CM-ASSET-${suffix}`, "CM Test Asset", typeId, userId, userId]);
    const service = await import("../../lib/maintenance/service");
    const actor = { id: userId, fullName: "CM Integration", username: `cm-${suffix}`, email: `cm-${suffix}@example.test`, role: "ADMIN" as const, permissions: ["CREATE_MAINTENANCE_NOTIFICATION", "REVIEW_MAINTENANCE_NOTIFICATION"] as never[], mustChangePassword: false };
    const meta = { requestId: randomUUID(), ipAddress: "127.0.0.1", userAgent: "vitest", browser: "vitest", operatingSystem: "test", deviceType: "server" };
    const created = await service.createNotification({ assetId, title: "Seal leak", description: "Visible process-water leak at drive end", type: "CORRECTIVE", priority: "HIGH", severity: "MAJOR", equipmentOperatingStatus: "DEGRADED", breakdown: false, departmentId: null, assignedPersonId: null, supervisorId: null, photoAttachmentIds: [], dueAt: null }, actor, meta);
    const reviewed = await service.reviewMaintenanceNotification(created.id, { decision: "REJECTED", note: "Duplicate notification", assignedTo: null, dueAt: null, backlogReason: "" }, actor, meta);
    expect(reviewed.status).toBe("REJECTED");
    const [rows] = await connection.execute<mysql.RowDataPacket[]>("SELECT n.status, COUNT(r.id) review_count FROM maintenance_notifications n LEFT JOIN notification_reviews r ON r.notification_id=n.id WHERE n.id=? GROUP BY n.id", [created.id]);
    expect(rows[0]).toMatchObject({ status: "REJECTED", review_count: 1 });
    await connection.execute("DELETE FROM audit_logs WHERE target_id IN (?,?)", [created.id, assetId]);
    await connection.execute("DELETE FROM maintenance_notifications WHERE id=?", [created.id]);
    await connection.execute("DELETE FROM assets WHERE id=?", [assetId]);
    await connection.execute("DELETE FROM asset_types WHERE id=?", [typeId]);
    await connection.execute("DELETE FROM users WHERE id=?", [userId]);
    await connection.end();
  });
});
