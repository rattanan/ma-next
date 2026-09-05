import { describe, expect, it } from "vitest";
import { defaults, listHref, readListFilters, safeListReturn } from "@/lib/work-orders/list-state";

describe("work order list navigation", () => {
  it("round trips search, assignment, pagination and view through a detail return link", () => {
    const filters = { ...defaults, q: "ปั๊มน้ำ & motor", assignedTo: "11111111-1111-4111-8111-111111111111", status: "IN_PROGRESS", page: "3", sort: "dueAt", order: "asc" };
    const href = listHref(filters, "board");
    const detail = new URL(`https://example.test/work-orders/demo?returnTo=${encodeURIComponent(href)}`);
    expect(safeListReturn(detail.searchParams.get("returnTo"))).toBe(href);
    expect(readListFilters(new URLSearchParams(href.split("?")[1]))).toEqual(filters);
  });
  it("rejects malformed paging, enums and IDs without breaking valid filters", () => {
    const result = readListFilters(new URLSearchParams("page=-2&pageSize=101&status=INVALID&assignedTo=other&priority=HIGH&sort=sql"));
    expect(result).toEqual({ ...defaults, priority: "HIGH" });
  });
  it("never accepts an external or unrelated return destination", () => {
    for (const href of ["https://example.com", "//example.com", "javascript:alert(1)", "/work-orders/123", "/work-orders-evil", "/work-orders?redirect=https://example.com", null]) {
      expect(safeListReturn(href)).toBe("/work-orders");
    }
  });
  it("preserves due-date links and excludes presentation view from API filters", () => {
    const query = new URLSearchParams("dateFrom=2026-09-01T00%3A00%3A00Z&view=calendar");
    expect(readListFilters(query).dateFrom).toBe("2026-09-01T00:00:00Z");
    expect(readListFilters(query)).not.toHaveProperty("view");
  });
});
