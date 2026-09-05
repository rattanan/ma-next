import { describe, expect, it } from "vitest";
import { findConcerns, findInsights, summarizeSnapshot, type PageSnapshot } from "../lib/assistant/page-analysis";

const snapshot: PageSnapshot = {
  title: "ใบสั่งงานซ่อม",
  headings: ["ใบสั่งงานซ่อม", "รายการงาน"],
  text: "OPEN OVERDUE ไม่ระบุ",
  rowCount: 24,
  fields: [{ label: "ผู้รับผิดชอบ", required: true, value: "" }],
  statusCounts: { OPEN: 8, BACKLOG: 3 },
};

describe("contextual page analysis", () => {
  it("summarizes visible rows, fields, and statuses", () => {
    expect(summarizeSnapshot(snapshot)).toContain("24 รายการ");
    expect(summarizeSnapshot(snapshot)).toContain("OPEN 8");
  });

  it("flags warning text and required empty fields", () => {
    expect(findConcerns(snapshot)).toContain("overdue");
    expect(findConcerns(snapshot)).toContain("ผู้รับผิดชอบ");
  });

  it("derives workload and dominant-status insights", () => {
    expect(findInsights(snapshot)).toContain("OPEN");
    expect(findInsights(snapshot)).toContain("รายการค่อนข้างมาก");
  });
});
