import { describe, expect, it } from "vitest";
import { nextCompletionRevisionNumber } from "../lib/maintenance/revisions";
describe("completion revisions", () => {
  it("starts at one and increments monotonically", () => { expect(nextCompletionRevisionNumber()).toBe(1); expect(nextCompletionRevisionNumber(1)).toBe(2); expect(nextCompletionRevisionNumber(7)).toBe(8); });
});
