import { HttpError } from "@/lib/http";

export type WorkOrderMaterialTransaction = "REQUESTED" | "RESERVED" | "ISSUED" | "RETURNED" | "CONSUMED";

/**
 * Boundary for the future Inventory ledger integration. Work Order currently
 * records an immutable material transaction and never mutates stock balances.
 */
export const workOrderInventoryAdapter = {
  mode: "RECORD_ONLY" as const,
  prepare(input: { transactionType: WorkOrderMaterialTransaction; quantity: number; referenceDocument?: string | null }) {
    if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
      throw new HttpError(400, "Material quantity must be greater than zero", "INVALID_MATERIAL_QUANTITY");
    }
    if (["ISSUED", "RETURNED"].includes(input.transactionType) && !input.referenceDocument?.trim()) {
      throw new HttpError(400, "Issue and return transactions require a reference document", "MATERIAL_REFERENCE_REQUIRED");
    }
    return { ...input, stockBalanceChanged: false };
  },
};
