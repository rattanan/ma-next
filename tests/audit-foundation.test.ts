import { describe, expect, it } from "vitest";
import { auditData } from "../lib/audit/service";
describe("foundation audit payload", () => {
  it("captures actor and masks important mutation values", () => { const data = auditData({ action: "CREATED", category: "TEST", targetType: "THING", targetId: "1", description: "Created", newValues: { password: "secret", name: "Safe" } }, { id: "u1", fullName: "Admin", username: "admin", email: "admin@example.test", role: "ADMIN", permissions: [], mustChangePassword: false }, { requestId: "r1", ipAddress: "127.0.0.1", userAgent: "test", browser: "Other", operatingSystem: "Other", deviceType: "Desktop" }); expect(data.actorUserId).toBe("u1"); expect(data.newValues).not.toContain("secret"); });
});
