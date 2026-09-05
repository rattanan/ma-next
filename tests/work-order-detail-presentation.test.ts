import { describe, expect, it } from "vitest";
import { localDateTimeValue, validWorkOrderTab } from "@/lib/work-orders/detail-presentation";

describe("work order detail presentation", () => {
  it("uses local calendar fields for datetime-local input instead of a UTC string", () => {
    const date = new Date(2026, 8, 5, 9, 7);
    expect(localDateTimeValue(date)).toBe("2026-09-05T09:07");
  });
  it("only accepts known sections, including rejecting inherited object keys", () => {
    expect(validWorkOrderTab("labor")).toBe("labor");
    expect(validWorkOrderTab("completion")).toBe("completion");
    for (const value of ["constructor", "__proto__", "unknown", null]) expect(validWorkOrderTab(value)).toBe("overview");
  });
});
