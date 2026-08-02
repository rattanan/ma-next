import { z } from "zod";

export const inventoryDocumentTypes = ["ISSUE", "RECEIPT", "TRANSFER"] as const;
export const inventoryDocumentStatuses = ["DRAFT", "PENDING_MAINTENANCE_MANAGER", "PENDING_WAREHOUSE_MANAGER", "APPROVED", "POSTED", "RETURNED", "REJECTED", "CANCELLED", "POSTING_FAILED"] as const;
export const inventoryApprovalSteps = ["MAINTENANCE_MANAGER", "WAREHOUSE_MANAGER", "PLANT_MANAGER"] as const;
export const stockCountTypes = ["FULL_COUNT", "CYCLE_COUNT", "LOCATION", "STOCK_ITEM", "CATEGORY"] as const;

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();
const decimalText = z.union([z.string(), z.number()]).transform((value) => String(value)).refine((value) => /^-?\d+(\.\d{1,6})?$/.test(value), "Must be a decimal with up to 6 places");
const positiveDecimal = decimalText.refine((value) => !value.startsWith("-"), "Must be positive").refine((value) => Number(value) > 0, "Must be greater than zero");
const nonNegativeDecimal = decimalText.refine((value) => !value.startsWith("-"), "Must be zero or greater");
const dateText = z.string().trim().min(1).max(40);

export const inventoryListQuerySchema = z.object({
  q: z.string().trim().max(190).default(""),
  active: z.enum(["true", "false", "all"]).default("true"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(25),
});

export const stockItemMutationSchema = z.object({
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(190),
  description: optionalText(10000),
  category: optionalText(120),
  unit: z.string().trim().min(1).max(45),
  manufacturer: optionalText(160),
  partNumber: optionalText(120),
  barcode: optionalText(160),
  minimumStock: nonNegativeDecimal.default("0"),
  maximumStock: nonNegativeDecimal.optional().nullable(),
  reorderPoint: nonNegativeDecimal.optional().nullable(),
  defaultUnitCost: nonNegativeDecimal.default("0"),
  mainLocationId: z.string().uuid().optional().nullable(),
  criticalSparePart: z.boolean().default(false),
  active: z.boolean().default(true),
  remark: optionalText(10000),
});

export const inventoryLocationMutationSchema = z.object({
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(190),
  plant: optionalText(120),
  warehouse: optionalText(120),
  zone: optionalText(120),
  rack: optionalText(120),
  shelf: optionalText(120),
  bin: optionalText(120),
  responsiblePersonId: z.string().uuid().optional().nullable(),
  description: optionalText(10000),
  active: z.boolean().default(true),
});

export const vendorContactMutationSchema = z.object({
  name: z.string().trim().min(1).max(160),
  position: optionalText(120),
  department: optionalText(120),
  phone: optionalText(80),
  mobile: optionalText(80),
  email: z.string().trim().email().max(190).optional().nullable(),
  lineId: optionalText(80),
  primaryContact: z.boolean().default(false),
  active: z.boolean().default(true),
  remark: optionalText(10000),
});

export const vendorMutationSchema = z.object({
  code: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(190),
  taxId: optionalText(80),
  address: optionalText(10000),
  country: optionalText(100),
  province: optionalText(120),
  phone: optionalText(80),
  email: z.string().trim().email().max(190).optional().nullable(),
  website: z.string().trim().url().max(255).optional().nullable(),
  paymentTerms: optionalText(120),
  deliveryTerms: optionalText(120),
  leadTime: z.coerce.number().int().min(0).max(3650).optional().nullable(),
  preferredVendor: z.boolean().default(false),
  active: z.boolean().default(true),
  remark: optionalText(10000),
});

export const inventoryDocumentLineSchema = z.object({
  stockItemId: z.string().uuid(),
  sourceLocationId: z.string().uuid().optional().nullable(),
  destinationLocationId: z.string().uuid().optional().nullable(),
  requestedQuantity: positiveDecimal,
  approvedQuantity: positiveDecimal.optional().nullable(),
  unit: z.string().trim().min(1).max(45).optional(),
  unitCost: nonNegativeDecimal.optional(),
  receiptAmount: nonNegativeDecimal.optional(),
  sourceReceiptLineId: z.string().uuid().optional().nullable(),
  vendorId: z.string().uuid().optional().nullable(),
  purchaseOrderReference: optionalText(120),
  expectedDeliveryDate: dateText.optional().nullable(),
  actualDeliveryDate: dateText.optional().nullable(),
  workOrderId: z.string().uuid().optional().nullable(),
  jobStepId: z.string().uuid().optional().nullable(),
  rejectedQuantity: nonNegativeDecimal.optional().default("0"),
  remark: optionalText(10000),
});

export const inventoryDocumentMutationSchema = z.object({
  documentType: z.enum(inventoryDocumentTypes),
  documentDate: dateText,
  siteId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  purpose: optionalText(10000),
  referenceWorkOrderId: z.string().uuid().optional().nullable(),
  referenceNotificationId: z.string().uuid().optional().nullable(),
  remark: optionalText(10000),
  lines: z.array(inventoryDocumentLineSchema).min(1).max(500),
});

export const inventoryDocumentUpdateSchema = inventoryDocumentMutationSchema.partial().extend({ lines: z.array(inventoryDocumentLineSchema).min(1).max(500).optional() });

export const inventoryDocumentActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("SUBMIT") }),
  z.object({ action: z.literal("APPROVE"), comment: z.string().trim().min(3).max(4000) }),
  z.object({ action: z.literal("RETURN"), comment: z.string().trim().min(3).max(4000) }),
  z.object({ action: z.literal("REJECT"), comment: z.string().trim().min(3).max(4000) }),
  z.object({ action: z.literal("CANCEL"), comment: z.string().trim().max(4000).optional() }),
]);

export const inventoryApprovalActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("OPEN"), comment: z.string().trim().max(4000).optional() }),
  z.object({ action: z.literal("APPROVE"), comment: z.string().trim().min(3).max(4000) }),
  z.object({ action: z.literal("RETURN"), comment: z.string().trim().min(3).max(4000) }),
  z.object({ action: z.literal("REJECT"), comment: z.string().trim().min(3).max(4000) }),
]);

export const stockCountMutationSchema = z.object({
  countDate: dateText,
  cutoffAt: dateText,
  siteId: z.string().uuid().optional().nullable(),
  locationId: z.string().uuid().optional().nullable(),
  countType: z.enum(stockCountTypes),
  responsiblePersonId: z.string().uuid().optional().nullable(),
  remark: optionalText(10000),
  lines: z.array(z.object({ stockItemId: z.string().uuid(), locationId: z.string().uuid(), countedQuantity: nonNegativeDecimal.optional().nullable(), remark: optionalText(10000) })).min(1).max(10000),
});

export const stockCountUpdateSchema = z.object({
  remark: optionalText(10000).optional(),
  lines: z.array(z.object({ id: z.string().uuid(), countedQuantity: nonNegativeDecimal.optional().nullable(), remark: optionalText(10000) })).min(1).max(10000),
});

export const stockCountActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("SUBMIT") }),
  z.object({ action: z.literal("APPROVE"), comment: z.string().trim().min(3).max(4000) }),
  z.object({ action: z.literal("RETURN"), comment: z.string().trim().min(3).max(4000) }),
  z.object({ action: z.literal("REJECT"), comment: z.string().trim().min(3).max(4000) }),
]);

export const vendorRatingMutationSchema = z.object({
  manualScore: nonNegativeDecimal.refine((value) => Number(value) <= 100, "Score must be 0-100"),
  manualAdjustmentReason: z.string().trim().min(3).max(4000),
});

export const inventoryReportQuerySchema = z.object({
  stockItemId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  vendorId: z.string().uuid().optional(),
  movementType: z.string().trim().max(40).optional(),
  documentNumber: z.string().trim().max(80).optional(),
  from: dateText.optional(),
  to: dateText.optional(),
  q: z.string().trim().max(190).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(200).default(50),
});

export const inventoryReceiptSourceQuerySchema = z.object({
  stockItemId: z.string().uuid(),
  locationId: z.string().uuid(),
});

export const inventorySettingMutationSchema = z.object({
  settingKey: z.string().trim().min(2).max(120),
  value: z.string().trim().max(4000),
  description: optionalText(4000),
});

export type InventoryDocumentInput = z.infer<typeof inventoryDocumentMutationSchema>;
export type InventoryDocumentLineInput = z.infer<typeof inventoryDocumentLineSchema>;
