export type EditablePurchase = {
  id: string; status: string; requestNumber?: string; orderNumber?: string;
  departmentId: string; currencyCode: string; exchangeRateToThb: string;
  remark: string | null; internalRemark?: string | null; purchaseRequestId?: string | null;
  vendorId?: string; purchaseMethod?: string | null; headerDiscountAmount?: string; vatAmount?: string;
  candidateVendors?: Array<{ vendorId: string; rank: number }>;
  lines: Array<{ id: string; stockItemId: string; stockCodeSnapshot: string; description: string; quantity: string; estimatedUnitPrice?: string; unitPrice?: string; discountAmount?: string; itemDiscountAmount?: string; remark: string | null }>;
};
export function purchaseEditPayload(kind: "request" | "order", document: EditablePurchase) {
  const shared = { departmentId: document.departmentId, currencyCode: document.currencyCode, exchangeRateToThb: document.exchangeRateToThb, remark: document.remark };
  if (kind === "request") return { ...shared, candidateVendorIds: [...(document.candidateVendors ?? [])].sort((a, b) => a.rank - b.rank).map((vendor) => vendor.vendorId), lines: document.lines.map((line) => ({ stockItemId: line.stockItemId, quantity: line.quantity, estimatedUnitPrice: line.estimatedUnitPrice, discountAmount: line.discountAmount ?? "0", remark: line.remark })) };
  return { ...shared, purchaseRequestId: document.purchaseRequestId ?? null, vendorId: document.vendorId, purchaseMethod: document.purchaseMethod, internalRemark: document.internalRemark, headerDiscountAmount: document.headerDiscountAmount ?? "0", vatAmount: document.vatAmount ?? "0", lines: document.lines.map((line) => ({ stockItemId: line.stockItemId, quantity: line.quantity, unitPrice: line.unitPrice, itemDiscountAmount: line.itemDiscountAmount ?? "0", remark: line.remark })) };
}
