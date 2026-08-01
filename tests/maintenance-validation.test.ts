import { describe, expect, it } from "vitest";
import { assetSchema, completionSchema, notificationReviewSchema, notificationSchema } from "../lib/maintenance/validation";

const id = "11111111-1111-4111-8111-111111111111";

describe("maintenance validation", () => {
  it("normalizes asset codes", () => {
    expect(assetSchema.parse({ code: " pump-01 ", name: "Feed pump", assetTypeId: id, location: "Plant A" }).code).toBe("PUMP-01");
  });

  it("requires meaningful notification detail", () => {
    expect(notificationSchema.safeParse({ assetId: id, title: "Leak", description: "bad" }).success).toBe(false);
  });

  it("requires an assignee for approved work", () => {
    const result = notificationReviewSchema.safeParse({ decision: "APPROVED", note: "Proceed with repair" });
    expect(result.success).toBe(false);
  });

  it("accepts rejection without an assignee", () => {
    expect(notificationReviewSchema.safeParse({ decision: "REJECTED", note: "Duplicate request" }).success).toBe(true);
  });

  it("requires positive completion duration and a solution", () => {
    expect(completionSchema.safeParse({ result: "Restored", solution: "", durationMinutes: 0 }).success).toBe(false);
  });
});
