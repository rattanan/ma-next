import { describe, expect, it } from "vitest";
import { redactLogValue, serializeLog } from "../lib/logger";
describe("structured logger", () => {
  it("redacts nested credentials", () => { expect(redactLogValue({ user: "a", password: "secret", nested: { sessionToken: "token" } })).toEqual({ user: "a", password: "[REDACTED]", nested: { sessionToken: "[REDACTED]" } }); });
  it("emits parseable JSON", () => { const parsed = JSON.parse(serializeLog("info", "ready", { requestId: "r1" })); expect(parsed).toMatchObject({ level: "info", message: "ready", requestId: "r1" }); });
});
