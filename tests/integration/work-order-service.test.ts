import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
import { describe, expect, it } from "vitest";

const testUrl = process.env.TEST_DATABASE_URL;
describe.skipIf(!testUrl)("Work Order service integration", () => {
  it("creates, backlogs and resumes a manual Work Order with audit history", async () => {
    if (!testUrl || /prod(uction)?/i.test(testUrl)) throw new Error("TEST_DATABASE_URL must identify a disposable non-production database");
    process.env.DATABASE_URL = testUrl;
    const connection = await mysql.createConnection({ uri: testUrl }); const suffix = Date.now(); const userId = randomUUID(); const typeId = randomUUID(); const assetId = randomUUID();
    await connection.execute("INSERT INTO users (id,full_name,username,email,password_hash,role,status,must_change_password,failed_login_attempts,created_at,updated_at) VALUES (?,?,?,?,?,'ADMIN','ACTIVE',false,0,NOW(3),NOW(3))", [userId, "WO Integration", `wo-${suffix}`, `wo-${suffix}@example.test`, "not-used"]);
    await connection.execute("INSERT INTO asset_types (id,code,name,active,created_at,updated_at,created_by,updated_by) VALUES (?,?,?,true,NOW(3),NOW(3),?,?)", [typeId, `WO${suffix}`, "WO Test Type", userId, userId]);
    await connection.execute("INSERT INTO assets (id,code,name,asset_type_id,structure_level,location,criticality,status,created_at,updated_at,created_by,updated_by) VALUES (?,?,?,?,'EQUIPMENT','Test bay','MEDIUM','ACTIVE',NOW(3),NOW(3),?,?)", [assetId, `WO-ASSET-${suffix}`, "WO Test Asset", typeId, userId, userId]);
    const service = await import("../../lib/work-orders/service");
    const actor = { id: userId, fullName: "WO Integration", username: `wo-${suffix}`, email: `wo-${suffix}@example.test`, role: "ADMIN" as const, permissions: ["MANAGE_WORK_ORDERS", "EXECUTE_WORK_ORDERS"] as never[], mustChangePassword: false };
    const meta = { requestId: randomUUID(), ipAddress: "127.0.0.1", userAgent: "vitest", browser: "vitest", operatingSystem: "test", deviceType: "server" };
    const created = await service.createWorkOrder({ sourceType: "MANUAL", workType: "CORRECTIVE", assetId, title: "Inspect test pump", description: "Inspect test pump for integration flow", priority: "MEDIUM", severity: "MODERATE", equipmentOperatingStatus: "UNKNOWN", departmentId: null, assignedTo: null, leadUserId: null, supervisorId: null, notes: "Integration test", backlogReason: "" }, actor, meta);
    expect(created.status).toBe("OPEN");
    expect((await service.backlogWorkOrder(created.id, { reason: "Awaiting permit" }, actor, { ...meta, requestId: randomUUID() })).status).toBe("BACKLOG");
    expect((await service.resumeWorkOrder(created.id, { resolution: "Permit issued" }, actor, { ...meta, requestId: randomUUID() })).status).toBe("OPEN");
    const [rows] = await connection.execute<mysql.RowDataPacket[]>("SELECT status,(SELECT COUNT(*) FROM work_order_events e WHERE e.work_order_id=w.id) event_count,(SELECT COUNT(*) FROM work_order_backlog_events b WHERE b.work_order_id=w.id AND b.resumed_at IS NOT NULL) resumed_count FROM work_orders w WHERE id=?", [created.id]);
    expect(rows[0]).toMatchObject({ status: "OPEN", event_count: 3, resumed_count: 1 });
    await connection.execute("DELETE FROM audit_logs WHERE target_id IN (?,?)", [created.id, assetId]);
    await connection.execute("DELETE FROM work_orders WHERE id=?", [created.id]); await connection.execute("DELETE FROM assets WHERE id=?", [assetId]); await connection.execute("DELETE FROM asset_types WHERE id=?", [typeId]); await connection.execute("DELETE FROM users WHERE id=?", [userId]); await connection.end();
  });
});
