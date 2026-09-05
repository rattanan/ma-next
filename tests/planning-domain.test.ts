import { describe, expect, it } from "vitest";
import { assertAcyclic, occurrenceDates, rollupProject, scheduledInstant, taskStatusFromWorkOrder, type RollupTask } from "@/lib/planning/domain";
const task = (id: string, status: RollupTask["status"]): RollupTask => ({ id, parentId: null, kind: "EXECUTION", status });
describe("shutdown roll-up", () => {
  it("does not complete empty or entirely cancelled projects", () => {
    expect(rollupProject("PLANNED", []).status).toBe("PLANNED");
    expect(rollupProject("PLANNED", [task("a", "CANCELLED")])).toMatchObject({ status: "PLANNED", progress: 0 });
  });
  it("counts leaves once and waits for milestones", () => {
    const tasks: RollupTask[] = [{ ...task("parent", "READY"), kind: "SUMMARY" }, task("a", "COMPLETED"), { ...task("gate", "READY"), kind: "MILESTONE" }];
    expect(rollupProject("PLANNED", tasks)).toMatchObject({ status: "IN_PROGRESS", progress: 50 });
    tasks[2].status = "COMPLETED";
    expect(rollupProject("IN_PROGRESS", tasks)).toMatchObject({ status: "COMPLETED", progress: 100 });
    expect(rollupProject("ON_HOLD", tasks)).toMatchObject({ status: "ON_HOLD", progress: 100 });
  });
  it("does not count verification or cancelled WOs as completed", () => {
    expect(taskStatusFromWorkOrder.VERIFIED).toBe("WAITING_COMPLETION");
    expect(taskStatusFromWorkOrder.CANCELLED).toBe("BLOCKED");
    expect(taskStatusFromWorkOrder.CLOSED).toBe("COMPLETED");
  });
  it("rejects dependency cycles", () => {
    expect(() => assertAcyclic([{ from: "a", to: "b" }, { from: "b", to: "a" }])).toThrow();
    expect(() => assertAcyclic([{ from: "a", to: "b" }, { from: "a", to: "c" }])).not.toThrow();
  });
});
describe("PM calendar recurrence", () => {
  it("retains monthly anchor after February", () => expect(occurrenceDates("2028-01-31", "2028-04-30", "MONTH", 1, "2028-01-01", "2028-04-30")).toEqual(["2028-01-31", "2028-02-29", "2028-03-31", "2028-04-30"]));
  it("respects boundaries and preview limits", () => {
    expect(occurrenceDates("2026-01-01", "2026-01-16", "WEEK", 1, "2026-01-02", "2026-02-01")).toEqual(["2026-01-08", "2026-01-15"]);
    expect(() => occurrenceDates("2026-01-01", "2026-12-31", "DAY", 1, "2026-01-01", "2026-12-31", 10)).toThrow();
    expect(() => occurrenceDates("2026-02-30", "2026-12-31", "DAY", 1, "2026-01-01", "2026-12-31")).toThrow();
  });
  it("converts local time and rejects nonexistent DST wall time", () => {
    expect(scheduledInstant("2026-09-05", "08:00", "Asia/Bangkok").toISOString()).toBe("2026-09-05T01:00:00.000Z");
    expect(() => scheduledInstant("2026-03-08", "02:30", "America/New_York")).toThrow();
  });
});
