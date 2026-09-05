import { describe, expect, it } from "vitest";
import { previewSchema, programSchema } from "../lib/planning/validation";
const id = "11111111-1111-4111-8111-111111111111";
const program = { organizationId: id, siteId: id, name: "Daily inspection", assetId: id, templateId: id, assignedTo: id, operatorId: id, startDate: "2026-01-01", expiryDate: "2026-12-31", frequency: "DAY", interval: 1, timezone: "Asia/Bangkok", localTime: "08:00" };
describe("PM planning controls", () => {
  it("preserves backward-compatible priority/duration defaults", () => {
    expect(programSchema.parse(program)).toMatchObject({ priority: "MEDIUM", estimatedMinutes: 60 });
    expect(programSchema.parse({ ...program, priority: "CRITICAL", estimatedMinutes: "45" })).toMatchObject({ priority: "CRITICAL", estimatedMinutes: 45 });
    expect(programSchema.safeParse({ ...program, estimatedMinutes: 0 }).success).toBe(false);
  });
  it("bounds historical preview and rejects reversed ranges", () => {
    expect(previewSchema.safeParse({ from: "2026-01-01", to: "2026-12-31" }).success).toBe(true);
    expect(previewSchema.safeParse({ from: "2026-01-02", to: "2026-01-01" }).success).toBe(false);
    expect(previewSchema.safeParse({ from: "2026-01-01", to: "2027-01-02" }).success).toBe(false);
  });
});
