import { describe, expect, it } from "vitest";
import { inventoryDocumentLineSchema, purchaseOrderReceiptMutationSchema } from "@/lib/inventory/validation";

const id = (suffix: string) => `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;

describe("purchase order receipt validation", () => {
  it("accepts partial delivery with a rejected quantity", () => {
    const parsed = purchaseOrderReceiptMutationSchema.parse({
      purchaseOrderId: id("1"),
      documentDate: "2026-08-09",
      deliveryNoteNumber: "DN-1001",
      lines: [{ purchaseOrderLineId: id("2"), destinationLocationId: id("3"), receivedQuantity: "10", rejectedQuantity: "2" }],
    });
    expect(parsed.lines[0]).toMatchObject({ receivedQuantity: "10", rejectedQuantity: "2" });
  });

  it("rejects a rejected quantity greater than the delivered quantity", () => {
    const parsed = purchaseOrderReceiptMutationSchema.safeParse({
      purchaseOrderId: id("1"),
      documentDate: "2026-08-09",
      lines: [{ purchaseOrderLineId: id("2"), destinationLocationId: id("3"), receivedQuantity: "4", rejectedQuantity: "5" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects duplicate PO lines in one receipt", () => {
    const line = { purchaseOrderLineId: id("2"), destinationLocationId: id("3"), receivedQuantity: "1", rejectedQuantity: "0" };
    const parsed = purchaseOrderReceiptMutationSchema.safeParse({ purchaseOrderId: id("1"), documentDate: "2026-08-09", lines: [line, line] });
    expect(parsed.success).toBe(false);
  });

  it("applies the same reject guard to non-PO inventory receipts", () => {
    const parsed = inventoryDocumentLineSchema.safeParse({
      stockItemId: id("4"), destinationLocationId: id("3"), requestedQuantity: "2", receiptAmount: "200", rejectedQuantity: "3",
    });
    expect(parsed.success).toBe(false);
  });
});
