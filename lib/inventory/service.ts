import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuthenticatedUser } from "@/lib/auth/session";
import type { RequestMeta } from "@/lib/auth/request";
import { writeAudit } from "@/lib/audit/service";
import { createNotification } from "@/lib/notifications/service";
import { requireActorPermission, requireScope } from "@/lib/maintenance/authorization";
import { HttpError } from "@/lib/http";
import {
  inventoryApprovalActionSchema,
  inventoryDocumentLineSchema,
  inventoryDocumentMutationSchema,
  inventoryListQuerySchema,
  inventoryLocationMutationSchema,
  inventoryReportQuerySchema,
  inventoryReceiptSourceQuerySchema,
  inventorySettingMutationSchema,
  stockCountActionSchema,
  stockCountMutationSchema,
  stockCountUpdateSchema,
  stockItemMutationSchema,
  vendorContactMutationSchema,
  vendorMutationSchema,
  vendorRatingMutationSchema,
  type InventoryDocumentInput,
  type InventoryDocumentLineInput,
} from "./validation";

type Actor = AuthenticatedUser;
type Tx = Prisma.TransactionClient;
type Decimal = Prisma.Decimal;
type DecimalLike = Decimal | string | number | null | undefined;

const D = (value: DecimalLike) => new Prisma.Decimal(String(value ?? "0"));
const decimalString = (value: DecimalLike) => D(value).toFixed(6).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
const optionalString = (value: string | null | undefined) => value?.trim() || null;
const asDate = (value: string | null | undefined) => value ? new Date(value) : null;
const isAdmin = (actor: Actor) => actor.role === "ADMIN" || actor.roleCodes?.includes("ADMIN");
const canManageAll = (actor: Actor) => isAdmin(actor) || actor.permissions.includes("MANAGE_INVENTORY") || ["WAREHOUSE_MANAGER", "PLANT_MANAGER", "MAINTENANCE_MANAGER"].some((role) => actor.roleCodes?.includes(role));
const canSeeCosts = (actor: Actor) => canManageAll(actor) || actor.permissions.includes("INVENTORY_EXPORT");

function requireInventoryPermission(actor: Actor, permission: Parameters<typeof requireActorPermission>[1]) {
  requireActorPermission(actor, permission);
}

function requireInventoryScope(actor: Actor, siteId?: string | null, departmentId?: string | null) {
  if (siteId || departmentId) requireScope(actor, { siteId, departmentId }, "VIEW_INVENTORY");
}

function mapCost(value: DecimalLike, actor: Actor) { return canSeeCosts(actor) ? decimalString(value) : null; }

function grade(score: DecimalLike) {
  const value = D(score);
  if (value.gte(90)) return "A";
  if (value.gte(80)) return "B";
  if (value.gte(70)) return "C";
  if (value.gte(60)) return "D";
  return "F";
}

function userRoleWhere(codes: string[]) {
  return { OR: [{ legacyRole: { in: codes } }, { roles: { some: { role: { code: { in: codes }, active: true } } } }] };
}

async function notifyRoles(roleCodes: string[], input: { type: string; title: string; message: string; actionUrl: string; sourceType: string; sourceId: string }, actor: Actor, meta: RequestMeta) {
  const recipients = await prisma.user.findMany({ where: { status: "ACTIVE", ...userRoleWhere(roleCodes) }, select: { id: true } });
  if (recipients.length) await createNotification({ ...input, recipientIds: recipients.map((recipient) => recipient.id) }, actor, meta);
}

async function nextDocumentNumber(tx: Tx, type: "ISSUE" | "RECEIPT" | "TRANSFER", date: Date) {
  const code = type === "ISSUE" ? "ISS" : type === "RECEIPT" ? "REC" : "TRF";
  const key = `${code}-${date.getUTCFullYear()}`;
  const row = await tx.inventoryDocumentSequence.upsert({
    where: { sequenceKey: key },
    create: { id: randomUUID(), sequenceKey: key, prefix: `INV-${code}-${date.getUTCFullYear()}`, nextNumber: 2, padding: 5, active: true },
    update: { nextNumber: { increment: 1 } },
  });
  const number = row.nextNumber - 1;
  return `${row.prefix}-${String(number).padStart(row.padding, "0")}`;
}

function itemWhere(query: z.infer<typeof inventoryListQuerySchema>) {
  const filters: Prisma.StockItemWhereInput[] = [];
  if (query.active !== "all") filters.push({ active: query.active === "true" });
  if (query.q) filters.push({ OR: [{ code: { contains: query.q } }, { name: { contains: query.q } }, { category: { contains: query.q } }, { partNumber: { contains: query.q } }, { barcode: { contains: query.q } }] });
  return filters.length ? { AND: filters } : undefined;
}

export async function listStockItems(query: z.infer<typeof inventoryListQuerySchema>, actor: Actor) {
  requireInventoryPermission(actor, "VIEW_INVENTORY");
  const where = itemWhere(query);
  const [items, total] = await Promise.all([
    prisma.stockItem.findMany({ where, include: { mainLocation: true, balances: { include: { location: true }, orderBy: { location: { code: "asc" } } } }, orderBy: [{ active: "desc" }, { code: "asc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.stockItem.count({ where }),
  ]);
  return { items: items.map((item) => ({
    ...item,
    minimumStock: decimalString(item.minimumStock), maximumStock: item.maximumStock ? decimalString(item.maximumStock) : null, reorderPoint: item.reorderPoint ? decimalString(item.reorderPoint) : null,
    defaultUnitCost: mapCost(item.defaultUnitCost, actor), movingAverageCost: mapCost(item.movingAverageCost, actor),
    balances: item.balances.map((balance) => ({ ...balance, quantityOnHand: decimalString(balance.quantityOnHand), reservedQuantity: decimalString(balance.reservedQuantity), availableQuantity: decimalString(D(balance.quantityOnHand).minus(balance.reservedQuantity)), movingAverageCost: mapCost(balance.movingAverageCost, actor), inventoryValue: mapCost(D(balance.quantityOnHand).times(balance.movingAverageCost), actor) })),
  })), total, page: query.page, pageSize: query.pageSize, pages: Math.max(1, Math.ceil(total / query.pageSize)) };
}

export async function getStockItem(id: string, actor: Actor) {
  requireInventoryPermission(actor, "VIEW_INVENTORY");
  const item = await prisma.stockItem.findUnique({ where: { id }, include: { mainLocation: true, locations: { include: { location: true }, orderBy: { location: { code: "asc" } } }, balances: { include: { location: true }, orderBy: { location: { code: "asc" } } }, movements: { orderBy: { postedAt: "desc" }, take: 30 }, documentLines: { include: { document: true }, orderBy: { document: { documentDate: "desc" } }, take: 30 } } });
  if (!item) throw new HttpError(404, "Stock item not found", "STOCK_ITEM_NOT_FOUND");
  return {
    ...item,
    minimumStock: decimalString(item.minimumStock), maximumStock: item.maximumStock ? decimalString(item.maximumStock) : null, reorderPoint: item.reorderPoint ? decimalString(item.reorderPoint) : null,
    defaultUnitCost: mapCost(item.defaultUnitCost, actor), movingAverageCost: mapCost(item.movingAverageCost, actor),
    balances: item.balances.map((balance) => ({ ...balance, quantityOnHand: decimalString(balance.quantityOnHand), reservedQuantity: decimalString(balance.reservedQuantity), availableQuantity: decimalString(D(balance.quantityOnHand).minus(balance.reservedQuantity)), movingAverageCost: mapCost(balance.movingAverageCost, actor), inventoryValue: mapCost(D(balance.quantityOnHand).times(balance.movingAverageCost), actor) })),
    movements: item.movements.map((movement) => ({ ...movement, quantityIn: decimalString(movement.quantityIn), quantityOut: decimalString(movement.quantityOut), quantityBefore: decimalString(movement.quantityBefore), quantityAfter: decimalString(movement.quantityAfter), unitCost: mapCost(movement.unitCost, actor), amountIn: mapCost(movement.amountIn, actor), amountOut: mapCost(movement.amountOut, actor), valueBefore: mapCost(movement.valueBefore, actor), valueAfter: mapCost(movement.valueAfter, actor), movingAverageCostBefore: mapCost(movement.movingAverageCostBefore, actor), movingAverageCostAfter: mapCost(movement.movingAverageCostAfter, actor) })),
    documentLines: item.documentLines.map((line) => ({ ...line, requestedQuantity: decimalString(line.requestedQuantity), approvedQuantity: line.approvedQuantity ? decimalString(line.approvedQuantity) : null, rejectedQuantity: decimalString(line.rejectedQuantity), unitCost: mapCost(line.unitCost, actor), totalAmount: mapCost(line.totalAmount, actor) })),
  };
}

export async function createStockItem(input: z.infer<typeof stockItemMutationSchema>, actor: Actor, meta: RequestMeta) {
  requireInventoryPermission(actor, "INVENTORY_STOCK_ITEM_MANAGE");
  const now = new Date();
  const record = await prisma.$transaction(async (tx) => {
    if (input.mainLocationId && !(await tx.inventoryLocation.findFirst({ where: { id: input.mainLocationId, active: true } }))) throw new HttpError(400, "Main location is not active", "INVALID_MAIN_LOCATION");
    const item = await tx.stockItem.create({ data: { code: input.code, name: input.name, description: optionalString(input.description), category: optionalString(input.category), unit: input.unit, manufacturer: optionalString(input.manufacturer), partNumber: optionalString(input.partNumber), barcode: optionalString(input.barcode), minimumStock: D(input.minimumStock), maximumStock: input.maximumStock ? D(input.maximumStock) : null, reorderPoint: input.reorderPoint ? D(input.reorderPoint) : null, defaultUnitCost: D(input.defaultUnitCost), movingAverageCost: D(input.defaultUnitCost), mainLocationId: input.mainLocationId ?? null, criticalSparePart: input.criticalSparePart, active: input.active, remark: optionalString(input.remark), createdBy: actor.id, updatedBy: actor.id, createdAt: now, updatedAt: now } });
    if (input.mainLocationId) await tx.stockItemLocation.create({ data: { id: randomUUID(), stockItemId: item.id, locationId: input.mainLocationId, createdAt: now } });
    await writeAudit(tx, { action: "STOCK_ITEM_CREATED", category: "INVENTORY", targetType: "STOCK_ITEM", targetId: item.id, targetName: item.code, description: `Created stock item ${item.code}`, newValues: input }, actor, meta);
    return item;
  });
  return { ...record, minimumStock: decimalString(record.minimumStock), maximumStock: record.maximumStock ? decimalString(record.maximumStock) : null, reorderPoint: record.reorderPoint ? decimalString(record.reorderPoint) : null, defaultUnitCost: mapCost(record.defaultUnitCost, actor), movingAverageCost: mapCost(record.movingAverageCost, actor) };
}

export async function updateStockItem(id: string, input: z.infer<typeof stockItemMutationSchema>, actor: Actor, meta: RequestMeta) {
  requireInventoryPermission(actor, "INVENTORY_STOCK_ITEM_MANAGE");
  const record = await prisma.$transaction(async (tx) => {
    const existing = await tx.stockItem.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Stock item not found", "STOCK_ITEM_NOT_FOUND");
    if (input.mainLocationId && !(await tx.inventoryLocation.findFirst({ where: { id: input.mainLocationId, active: true } }))) throw new HttpError(400, "Main location is not active", "INVALID_MAIN_LOCATION");
    const updated = await tx.stockItem.update({ where: { id }, data: { code: input.code, name: input.name, description: optionalString(input.description), category: optionalString(input.category), unit: input.unit, manufacturer: optionalString(input.manufacturer), partNumber: optionalString(input.partNumber), barcode: optionalString(input.barcode), minimumStock: D(input.minimumStock), maximumStock: input.maximumStock ? D(input.maximumStock) : null, reorderPoint: input.reorderPoint ? D(input.reorderPoint) : null, defaultUnitCost: D(input.defaultUnitCost), mainLocationId: input.mainLocationId ?? null, criticalSparePart: input.criticalSparePart, active: input.active, remark: optionalString(input.remark), updatedBy: actor.id } });
    if (input.mainLocationId) await tx.stockItemLocation.upsert({ where: { stockItemId_locationId: { stockItemId: id, locationId: input.mainLocationId } }, create: { id: randomUUID(), stockItemId: id, locationId: input.mainLocationId, createdAt: new Date() }, update: {} });
    await writeAudit(tx, { action: "STOCK_ITEM_UPDATED", category: "INVENTORY", targetType: "STOCK_ITEM", targetId: id, targetName: updated.code, description: `Updated stock item ${updated.code}`, previousValues: { mainLocationId: existing.mainLocationId, active: existing.active }, newValues: { mainLocationId: updated.mainLocationId, active: updated.active } }, actor, meta);
    if (existing.mainLocationId !== updated.mainLocationId) await writeAudit(tx, { action: "MAIN_LOCATION_CHANGED", category: "INVENTORY", targetType: "STOCK_ITEM", targetId: id, targetName: updated.code, description: `Changed main location for ${updated.code}`, previousValues: { mainLocationId: existing.mainLocationId }, newValues: { mainLocationId: updated.mainLocationId } }, actor, meta);
    return updated;
  });
  return { ...record, minimumStock: decimalString(record.minimumStock), maximumStock: record.maximumStock ? decimalString(record.maximumStock) : null, reorderPoint: record.reorderPoint ? decimalString(record.reorderPoint) : null, defaultUnitCost: mapCost(record.defaultUnitCost, actor), movingAverageCost: mapCost(record.movingAverageCost, actor) };
}

function locationWhere(query: z.infer<typeof inventoryListQuerySchema>) {
  const filters: Prisma.InventoryLocationWhereInput[] = [];
  if (query.active !== "all") filters.push({ active: query.active === "true" });
  if (query.q) filters.push({ OR: [{ code: { contains: query.q } }, { name: { contains: query.q } }, { plant: { contains: query.q } }, { warehouse: { contains: query.q } }, { zone: { contains: query.q } }, { rack: { contains: query.q } }, { shelf: { contains: query.q } }, { bin: { contains: query.q } }] });
  return filters.length ? { AND: filters } : undefined;
}

export async function listLocations(query: z.infer<typeof inventoryListQuerySchema>, actor: Actor) {
  requireInventoryPermission(actor, "VIEW_INVENTORY");
  const where = locationWhere(query);
  const [locations, total] = await Promise.all([
    prisma.inventoryLocation.findMany({ where, include: { balances: { include: { stockItem: true } } }, orderBy: [{ active: "desc" }, { code: "asc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.inventoryLocation.count({ where }),
  ]);
  return { locations: locations.map((location) => ({ ...location, balances: location.balances.map((balance) => ({ ...balance, quantityOnHand: decimalString(balance.quantityOnHand), reservedQuantity: decimalString(balance.reservedQuantity), movingAverageCost: mapCost(balance.movingAverageCost, actor), inventoryValue: mapCost(D(balance.quantityOnHand).times(balance.movingAverageCost), actor) })) })), total, page: query.page, pageSize: query.pageSize, pages: Math.max(1, Math.ceil(total / query.pageSize)) };
}

export async function createLocation(input: z.infer<typeof inventoryLocationMutationSchema>, actor: Actor, meta: RequestMeta) {
  requireInventoryPermission(actor, "INVENTORY_LOCATION_MANAGE");
  const record = await prisma.$transaction(async (tx) => {
    const location = await tx.inventoryLocation.create({ data: { ...input, plant: optionalString(input.plant), warehouse: optionalString(input.warehouse), zone: optionalString(input.zone), rack: optionalString(input.rack), shelf: optionalString(input.shelf), bin: optionalString(input.bin), description: optionalString(input.description), responsiblePersonId: input.responsiblePersonId ?? null, createdBy: actor.id, updatedBy: actor.id } });
    await writeAudit(tx, { action: "INVENTORY_LOCATION_CREATED", category: "INVENTORY", targetType: "INVENTORY_LOCATION", targetId: location.id, targetName: location.code, description: `Created inventory location ${location.code}`, newValues: input }, actor, meta);
    return location;
  });
  return record;
}

export async function updateLocation(id: string, input: z.infer<typeof inventoryLocationMutationSchema>, actor: Actor, meta: RequestMeta) {
  requireInventoryPermission(actor, "INVENTORY_LOCATION_MANAGE");
  return prisma.$transaction(async (tx) => {
    const existing = await tx.inventoryLocation.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Storage location not found", "LOCATION_NOT_FOUND");
    const updated = await tx.inventoryLocation.update({ where: { id }, data: { ...input, plant: optionalString(input.plant), warehouse: optionalString(input.warehouse), zone: optionalString(input.zone), rack: optionalString(input.rack), shelf: optionalString(input.shelf), bin: optionalString(input.bin), description: optionalString(input.description), responsiblePersonId: input.responsiblePersonId ?? null, updatedBy: actor.id } });
    await writeAudit(tx, { action: "INVENTORY_LOCATION_UPDATED", category: "INVENTORY", targetType: "INVENTORY_LOCATION", targetId: id, targetName: updated.code, description: `Updated inventory location ${updated.code}`, previousValues: existing, newValues: updated }, actor, meta);
    return updated;
  });
}

export async function listVendors(query: z.infer<typeof inventoryListQuerySchema>, actor: Actor) {
  requireInventoryPermission(actor, "VIEW_INVENTORY");
  const filters: Prisma.VendorWhereInput[] = [];
  if (query.active !== "all") filters.push({ active: query.active === "true" });
  if (query.q) filters.push({ OR: [{ code: { contains: query.q } }, { name: { contains: query.q } }, { taxId: { contains: query.q } }, { email: { contains: query.q } }] });
  const where = filters.length ? { AND: filters } : undefined;
  const [vendors, total] = await Promise.all([
    prisma.vendor.findMany({ where, include: { rating: true, contacts: { where: { active: true }, orderBy: [{ primaryContact: "desc" }, { name: "asc" }], take: 3 } }, orderBy: [{ active: "desc" }, { preferredVendor: "desc" }, { code: "asc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.vendor.count({ where }),
  ]);
  return { vendors: vendors.map((vendor) => ({ ...vendor, rating: vendor.rating ? { ...vendor.rating, calculatedScore: mapCost(vendor.rating.calculatedScore, actor), manualScore: mapCost(vendor.rating.manualScore, actor), finalScore: mapCost(vendor.rating.finalScore, actor) } : null })), total, page: query.page, pageSize: query.pageSize, pages: Math.max(1, Math.ceil(total / query.pageSize)) };
}

export async function getVendor(id: string, actor: Actor) {
  requireInventoryPermission(actor, "VIEW_INVENTORY");
  const vendor = await prisma.vendor.findUnique({ where: { id }, include: { contacts: { orderBy: [{ primaryContact: "desc" }, { name: "asc" }] }, rating: true, ratingHistory: { orderBy: { createdAt: "desc" }, take: 30 }, documentLines: { include: { document: true, stockItem: true }, orderBy: { document: { documentDate: "desc" } }, take: 50 } } });
  if (!vendor) throw new HttpError(404, "Vendor not found", "VENDOR_NOT_FOUND");
  return { ...vendor, rating: vendor.rating ? { ...vendor.rating, calculatedScore: mapCost(vendor.rating.calculatedScore, actor), manualScore: mapCost(vendor.rating.manualScore, actor), finalScore: mapCost(vendor.rating.finalScore, actor) } : null, ratingHistory: vendor.ratingHistory.map((entry) => ({ ...entry, calculatedScore: mapCost(entry.calculatedScore, actor), manualScore: mapCost(entry.manualScore, actor), finalScore: mapCost(entry.finalScore, actor) })), documentLines: vendor.documentLines.map((line) => ({ ...line, requestedQuantity: decimalString(line.requestedQuantity), approvedQuantity: line.approvedQuantity ? decimalString(line.approvedQuantity) : null, rejectedQuantity: decimalString(line.rejectedQuantity), unitCost: mapCost(line.unitCost, actor), totalAmount: mapCost(line.totalAmount, actor) })) };
}

export async function createVendor(input: z.infer<typeof vendorMutationSchema>, actor: Actor, meta: RequestMeta) {
  requireInventoryPermission(actor, "INVENTORY_VENDOR_MANAGE");
  return prisma.$transaction(async (tx) => {
    const vendor = await tx.vendor.create({ data: { ...input, taxId: optionalString(input.taxId), address: optionalString(input.address), country: optionalString(input.country), province: optionalString(input.province), phone: optionalString(input.phone), email: optionalString(input.email), website: optionalString(input.website), paymentTerms: optionalString(input.paymentTerms), deliveryTerms: optionalString(input.deliveryTerms), remark: optionalString(input.remark), leadTime: input.leadTime ?? null, createdBy: actor.id, updatedBy: actor.id } });
    await writeAudit(tx, { action: "VENDOR_CREATED", category: "INVENTORY", targetType: "VENDOR", targetId: vendor.id, targetName: vendor.code, description: `Created vendor ${vendor.code}`, newValues: input }, actor, meta);
    return vendor;
  });
}

export async function updateVendor(id: string, input: z.infer<typeof vendorMutationSchema>, actor: Actor, meta: RequestMeta) {
  requireInventoryPermission(actor, "INVENTORY_VENDOR_MANAGE");
  return prisma.$transaction(async (tx) => {
    const existing = await tx.vendor.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Vendor not found", "VENDOR_NOT_FOUND");
    const vendor = await tx.vendor.update({ where: { id }, data: { ...input, taxId: optionalString(input.taxId), address: optionalString(input.address), country: optionalString(input.country), province: optionalString(input.province), phone: optionalString(input.phone), email: optionalString(input.email), website: optionalString(input.website), paymentTerms: optionalString(input.paymentTerms), deliveryTerms: optionalString(input.deliveryTerms), remark: optionalString(input.remark), leadTime: input.leadTime ?? null, updatedBy: actor.id } });
    await writeAudit(tx, { action: "VENDOR_UPDATED", category: "INVENTORY", targetType: "VENDOR", targetId: id, targetName: vendor.code, description: `Updated vendor ${vendor.code}`, previousValues: existing, newValues: vendor }, actor, meta);
    return vendor;
  });
}

export async function upsertVendorContact(vendorId: string, contactId: string | null, input: z.infer<typeof vendorContactMutationSchema>, actor: Actor, meta: RequestMeta) {
  requireInventoryPermission(actor, "INVENTORY_VENDOR_MANAGE");
  return prisma.$transaction(async (tx) => {
    if (!(await tx.vendor.findUnique({ where: { id: vendorId } }))) throw new HttpError(404, "Vendor not found", "VENDOR_NOT_FOUND");
    if (input.primaryContact) await tx.vendorContact.updateMany({ where: { vendorId, ...(contactId ? { id: { not: contactId } } : {}) }, data: { primaryContact: false, updatedAt: new Date() } });
    const contact = contactId ? await tx.vendorContact.update({ where: { id: contactId }, data: { ...input, vendorId, email: optionalString(input.email), remark: optionalString(input.remark) } }) : await tx.vendorContact.create({ data: { ...input, vendorId, email: optionalString(input.email), remark: optionalString(input.remark) } });
    await writeAudit(tx, { action: "VENDOR_CONTACT_UPDATED", category: "INVENTORY", targetType: "VENDOR", targetId: vendorId, targetName: contact.name, description: `Updated vendor contact for ${vendorId}`, newValues: input }, actor, meta);
    return contact;
  });
}

async function calculateVendorRatingTx(tx: Tx, vendorId: string, manualScore: Decimal | null, reason: string | null, actor: Actor) {
  const lines = await tx.inventoryDocumentLine.findMany({ where: { vendorId, document: { documentType: "RECEIPT", status: "POSTED" } }, select: { requestedQuantity: true, approvedQuantity: true, rejectedQuantity: true, expectedDeliveryDate: true, actualDeliveryDate: true, document: { select: { id: true, documentDate: true } } } });
  const totalOrdered = lines.reduce((sum, line) => sum.plus(line.requestedQuantity), D(0));
  const totalReceived = lines.reduce((sum, line) => sum.plus(line.approvedQuantity ?? line.requestedQuantity), D(0));
  const totalRejected = lines.reduce((sum, line) => sum.plus(line.rejectedQuantity), D(0));
  const completeReceipts = new Set(lines.map((line) => line.document.id)).size;
  const onTimeReceipts = new Set(lines.filter((line) => line.expectedDeliveryDate && line.actualDeliveryDate && line.actualDeliveryDate <= line.expectedDeliveryDate).map((line) => line.document.id)).size;
  const onTimeRate = completeReceipts ? D(onTimeReceipts).div(completeReceipts).clamp(0, 1) : D(0);
  const fulfillmentRate = totalOrdered.gt(0) ? totalReceived.div(totalOrdered).clamp(0, 1) : D(0);
  const qualityRate = totalReceived.gt(0) ? totalReceived.minus(totalRejected).div(totalReceived).clamp(0, 1) : D(0);
  const calculated = onTimeRate.times(60).plus(fulfillmentRate.times(30)).plus(qualityRate.times(10)).toDecimalPlaces(2);
  const finalScore = manualScore ?? calculated;
  const rating = await tx.vendorRating.upsert({ where: { vendorId }, create: { id: randomUUID(), vendorId, calculatedScore: calculated, manualScore, finalScore, ratingGrade: grade(finalScore), lastCalculatedDate: new Date(), manualAdjustmentReason: reason, adjustedBy: manualScore ? actor.id : null, adjustedAt: manualScore ? new Date() : null }, update: { calculatedScore: calculated, ...(manualScore !== null ? { manualScore, manualAdjustmentReason: reason, adjustedBy: actor.id, adjustedAt: new Date() } : {}), finalScore, ratingGrade: grade(finalScore), lastCalculatedDate: new Date() } });
  await tx.vendorRatingHistory.create({ data: { id: randomUUID(), vendorId, calculatedScore: calculated, manualScore: rating.manualScore, finalScore, ratingGrade: rating.ratingGrade, reason: reason ?? "Receipt performance recalculation", changedBy: actor.id } });
  return { rating, metrics: { completeReceipts, onTimeReceipts, onTimeRate: onTimeRate.toFixed(4), fulfillmentRate: fulfillmentRate.toFixed(4), qualityRate: qualityRate.toFixed(4) } };
}

export async function recalculateVendorRating(vendorId: string, actor: Actor, meta: RequestMeta) {
  requireInventoryPermission(actor, "INVENTORY_VENDOR_MANAGE");
  const result = await prisma.$transaction(async (tx) => {
    const vendor = await tx.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new HttpError(404, "Vendor not found", "VENDOR_NOT_FOUND");
    const current = await tx.vendorRating.findUnique({ where: { vendorId } });
    const calculation = await calculateVendorRatingTx(tx, vendorId, current?.manualScore ?? null, null, actor);
    await writeAudit(tx, { action: "VENDOR_SCORE_CALCULATED", category: "INVENTORY", targetType: "VENDOR", targetId: vendorId, targetName: vendor.code, description: `Recalculated vendor score for ${vendor.code}`, newValues: { calculatedScore: calculation.rating.calculatedScore, finalScore: calculation.rating.finalScore, metrics: calculation.metrics } }, actor, meta);
    return calculation;
  });
  if (result.rating.finalScore && D(result.rating.finalScore).lt(70)) await notifyRoles(["WAREHOUSE_MANAGER", "ADMIN"], { type: "VENDOR_SCORE_LOW", title: `Vendor score below threshold: ${vendorId}`, message: `Review vendor performance and delivery history.`, actionUrl: `/inventory/vendors/${vendorId}`, sourceType: "VENDOR", sourceId: vendorId }, actor, meta).catch(() => undefined);
  return { ...result.rating, calculatedScore: mapCost(result.rating.calculatedScore, actor), manualScore: mapCost(result.rating.manualScore, actor), finalScore: mapCost(result.rating.finalScore, actor), metrics: result.metrics };
}

export async function updateVendorRating(vendorId: string, input: z.infer<typeof vendorRatingMutationSchema>, actor: Actor, meta: RequestMeta) {
  requireInventoryPermission(actor, "INVENTORY_VENDOR_MANAGE");
  return prisma.$transaction(async (tx) => {
    const vendor = await tx.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new HttpError(404, "Vendor not found", "VENDOR_NOT_FOUND");
    const current = await tx.vendorRating.findUnique({ where: { vendorId } });
    const calculation = await calculateVendorRatingTx(tx, vendorId, D(input.manualScore), input.manualAdjustmentReason, actor);
    await writeAudit(tx, { action: "VENDOR_SCORE_CHANGED", category: "INVENTORY", targetType: "VENDOR", targetId: vendorId, targetName: vendor.code, description: `Changed manual vendor score for ${vendor.code}`, previousValues: { manualScore: current?.manualScore, finalScore: current?.finalScore }, newValues: { manualScore: calculation.rating.manualScore, finalScore: calculation.rating.finalScore, reason: input.manualAdjustmentReason } }, actor, meta);
    return { ...calculation.rating, calculatedScore: mapCost(calculation.rating.calculatedScore, actor), manualScore: mapCost(calculation.rating.manualScore, actor), finalScore: mapCost(calculation.rating.finalScore, actor) };
  });
}

function documentCanRead(actor: Actor, document: { requesterId: string; siteId: string | null; departmentId: string | null }) {
  if (document.requesterId === actor.id || canManageAll(actor)) return true;
  return false;
}

function documentWhereForActor(actor: Actor): Prisma.InventoryDocumentWhereInput {
  return canManageAll(actor) ? {} : { requesterId: actor.id };
}

function lineData(input: InventoryDocumentLineInput, item: { unit: string; defaultUnitCost: Decimal; movingAverageCost: Decimal }, documentType: "ISSUE" | "RECEIPT" | "TRANSFER", lineNumber: number) {
  const quantity = D(input.requestedQuantity);
  const enteredReceiptAmount = input.receiptAmount !== undefined ? D(input.receiptAmount) : documentType === "RECEIPT" && input.unitCost !== undefined ? quantity.times(D(input.unitCost)) : null;
  const unitCost = enteredReceiptAmount !== null ? enteredReceiptAmount.div(quantity) : input.unitCost !== undefined ? D(input.unitCost) : documentType === "RECEIPT" ? D(item.defaultUnitCost) : D(item.movingAverageCost);
  const totalAmount = documentType === "RECEIPT" && enteredReceiptAmount !== null ? enteredReceiptAmount : quantity.times(unitCost);
  return { lineNumber, stockItemId: input.stockItemId, sourceLocationId: input.sourceLocationId ?? null, destinationLocationId: input.destinationLocationId ?? null, requestedQuantity: quantity, approvedQuantity: input.approvedQuantity ? D(input.approvedQuantity) : null, rejectedQuantity: D(input.rejectedQuantity ?? "0"), unit: input.unit ?? item.unit, unitCost, totalAmount, vendorId: input.vendorId ?? null, purchaseOrderReference: optionalString(input.purchaseOrderReference), expectedDeliveryDate: asDate(input.expectedDeliveryDate), actualDeliveryDate: asDate(input.actualDeliveryDate), workOrderId: input.workOrderId ?? null, jobStepId: input.jobStepId ?? null, sourceReceiptLineId: input.sourceReceiptLineId ?? null, remark: optionalString(input.remark) };
}

async function validateDocumentLines(tx: Tx, documentType: "ISSUE" | "RECEIPT" | "TRANSFER", lines: InventoryDocumentLineInput[]) {
  const itemIds = [...new Set(lines.map((line) => line.stockItemId))];
  const locationIds = [...new Set(lines.flatMap((line) => [line.sourceLocationId, line.destinationLocationId]).filter((id): id is string => Boolean(id)))];
  const vendorIds = [...new Set(lines.map((line) => line.vendorId).filter((id): id is string => Boolean(id)))];
  const [items, locations, vendors] = await Promise.all([
    tx.stockItem.findMany({ where: { id: { in: itemIds }, active: true } }),
    locationIds.length ? tx.inventoryLocation.findMany({ where: { id: { in: locationIds }, active: true } }) : [],
    vendorIds.length ? tx.vendor.findMany({ where: { id: { in: vendorIds }, active: true } }) : [],
  ]);
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const locationMap = new Map(locations.map((location) => [location.id, location]));
  const vendorMap = new Map(vendors.map((vendor) => [vendor.id, vendor]));
  if (items.length !== itemIds.length) throw new HttpError(400, "Every line must reference an active stock item", "INVALID_STOCK_ITEM");
  const receiptSourceIds = lines.map((line) => line.sourceReceiptLineId).filter((id): id is string => Boolean(id));
  if (new Set(receiptSourceIds).size !== receiptSourceIds.length) throw new HttpError(400, "Each Issue line must select a different Receipt line", "DUPLICATE_RECEIPT_SOURCE");
  for (const line of lines) {
    if (documentType === "ISSUE" && !line.sourceLocationId) throw new HttpError(400, "Issue lines require a source location", "SOURCE_LOCATION_REQUIRED");
    if (documentType === "ISSUE" && !line.sourceReceiptLineId) throw new HttpError(400, "Issue lines require a source Receipt", "SOURCE_RECEIPT_REQUIRED");
    if (documentType === "RECEIPT" && !line.destinationLocationId) throw new HttpError(400, "Receipt lines require a destination location", "DESTINATION_LOCATION_REQUIRED");
    if (documentType === "RECEIPT" && line.receiptAmount === undefined && line.unitCost === undefined) throw new HttpError(400, "Receipt lines require an entered amount", "RECEIPT_AMOUNT_REQUIRED");
    if (documentType === "TRANSFER" && (!line.sourceLocationId || !line.destinationLocationId)) throw new HttpError(400, "Transfer lines require source and destination locations", "TRANSFER_LOCATION_REQUIRED");
    if (documentType !== "ISSUE" && line.sourceReceiptLineId) throw new HttpError(400, "Only Issue lines may select a source Receipt", "INVALID_RECEIPT_SOURCE");
    if (line.sourceLocationId && line.destinationLocationId && line.sourceLocationId === line.destinationLocationId) throw new HttpError(400, "Source and destination locations must be different", "SAME_LOCATION");
    if (line.sourceLocationId && !locationMap.has(line.sourceLocationId)) throw new HttpError(400, "Source location is not active", "INVALID_SOURCE_LOCATION");
    if (line.destinationLocationId && !locationMap.has(line.destinationLocationId)) throw new HttpError(400, "Destination location is not active", "INVALID_DESTINATION_LOCATION");
    if (line.vendorId && !vendorMap.has(line.vendorId)) throw new HttpError(400, "Vendor is not active", "INVALID_VENDOR");
  }
  return { itemMap };
}

export async function listAvailableReceiptSources(query: z.infer<typeof inventoryReceiptSourceQuerySchema>, actor: Actor) {
  requireInventoryPermission(actor, "INVENTORY_REQUEST_CREATE");
  const lines = await prisma.inventoryDocumentLine.findMany({
    where: { stockItemId: query.stockItemId, destinationLocationId: query.locationId, document: { documentType: "RECEIPT", status: "POSTED" } },
    include: { document: { select: { id: true, documentNumber: true, documentDate: true } }, stockItem: { select: { id: true, code: true, name: true, unit: true } }, destinationLocation: { select: { id: true, code: true, name: true } }, vendor: { select: { id: true, code: true, name: true } } },
    orderBy: [{ document: { documentDate: "asc" } }, { lineNumber: "asc" }],
  });
  const issued = lines.length ? await prisma.inventoryDocumentLine.findMany({ where: { sourceReceiptLineId: { in: lines.map((line) => line.id) }, document: { documentType: "ISSUE", status: "POSTED" } }, select: { sourceReceiptLineId: true, approvedQuantity: true, requestedQuantity: true } }) : [];
  const issuedByReceipt = new Map<string, Decimal>();
  for (const line of issued) if (line.sourceReceiptLineId) issuedByReceipt.set(line.sourceReceiptLineId, (issuedByReceipt.get(line.sourceReceiptLineId) ?? D(0)).plus(line.approvedQuantity ?? line.requestedQuantity));
  return { receiptSources: lines.map((line) => { const receivedQuantity = D(line.approvedQuantity ?? line.requestedQuantity); const issuedQuantity = issuedByReceipt.get(line.id) ?? D(0); const availableQuantity = receivedQuantity.minus(issuedQuantity); return { id: line.id, documentId: line.document.id, documentNumber: line.document.documentNumber, documentDate: line.document.documentDate, lineNumber: line.lineNumber, stockItem: line.stockItem, destinationLocation: line.destinationLocation, vendor: line.vendor, receivedQuantity: decimalString(receivedQuantity), issuedQuantity: decimalString(issuedQuantity), availableQuantity: decimalString(availableQuantity), unitCost: mapCost(line.unitCost, actor), totalAmount: mapCost(line.totalAmount, actor) }; }).filter((line) => D(line.availableQuantity).gt(0)) };
}

export async function listInventoryDocuments(query: z.infer<typeof inventoryListQuerySchema> & { type?: "ISSUE" | "RECEIPT" | "TRANSFER"; status?: string }, actor: Actor) {
  requireInventoryPermission(actor, "INVENTORY_REQUEST_VIEW");
  const where: Prisma.InventoryDocumentWhereInput = { ...documentWhereForActor(actor), ...(query.type ? { documentType: query.type } : {}), ...(query.status ? { status: query.status as never } : {}) };
  if (query.q) where.OR = [{ documentNumber: { contains: query.q } }, { purpose: { contains: query.q } }];
  const [documents, total] = await Promise.all([
    prisma.inventoryDocument.findMany({ where, include: { lines: { include: { stockItem: true, sourceLocation: true, destinationLocation: true, vendor: true, sourceReceiptLine: { select: { id: true, document: { select: { id: true, documentNumber: true, documentDate: true, status: true } } } } } }, approvals: { orderBy: { sequence: "asc" } } }, orderBy: { createdAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.inventoryDocument.count({ where }),
  ]);
  const people = await prisma.user.findMany({ where: { id: { in: [...new Set(documents.map((document) => document.requesterId))] } }, select: { id: true, fullName: true } });
  const peopleMap = new Map(people.map((person) => [person.id, person.fullName]));
  return { documents: documents.map((document) => ({ ...document, requesterName: peopleMap.get(document.requesterId) ?? "Unknown user", lines: document.lines.map((line) => ({ ...line, requestedQuantity: decimalString(line.requestedQuantity), approvedQuantity: line.approvedQuantity ? decimalString(line.approvedQuantity) : null, rejectedQuantity: decimalString(line.rejectedQuantity), unitCost: mapCost(line.unitCost, actor), totalAmount: mapCost(line.totalAmount, actor) })) })), total, page: query.page, pageSize: query.pageSize, pages: Math.max(1, Math.ceil(total / query.pageSize)) };
}

export async function getInventoryDocument(id: string, actor: Actor) {
  requireInventoryPermission(actor, "INVENTORY_REQUEST_VIEW");
  const document = await prisma.inventoryDocument.findUnique({ where: { id }, include: { lines: { include: { stockItem: true, sourceLocation: true, destinationLocation: true, vendor: true, sourceReceiptLine: { select: { id: true, document: { select: { id: true, documentNumber: true, documentDate: true, status: true } } } } }, orderBy: { lineNumber: "asc" } }, approvals: { orderBy: [{ round: "asc" }, { sequence: "asc" }] }, attachments: true, movements: { include: { sourceReceiptLine: { select: { id: true, document: { select: { id: true, documentNumber: true, documentDate: true, status: true } } } } }, orderBy: { postedAt: "desc" } } } });
  if (!document) throw new HttpError(404, "Inventory document not found", "INVENTORY_DOCUMENT_NOT_FOUND");
  if (!documentCanRead(actor, document)) throw new HttpError(403, "This document is outside your inventory scope", "SCOPE_FORBIDDEN");
  const attachments = await prisma.attachment.findMany({ where: { entityType: "INVENTORY_DOCUMENT", entityId: id, deletedAt: null }, orderBy: { createdAt: "desc" } });
  const people = await prisma.user.findMany({ where: { id: { in: [...new Set([document.requesterId, ...document.approvals.flatMap((approval) => [approval.decisionBy, approval.requestedBy].filter((value): value is string => Boolean(value))), ...document.movements.map((movement) => movement.postedBy)])] } }, select: { id: true, fullName: true } });
  const peopleMap = new Map(people.map((person) => [person.id, person.fullName]));
  return { ...document, requesterName: peopleMap.get(document.requesterId) ?? "Unknown user", lines: document.lines.map((line) => ({ ...line, requestedQuantity: decimalString(line.requestedQuantity), approvedQuantity: line.approvedQuantity ? decimalString(line.approvedQuantity) : null, rejectedQuantity: decimalString(line.rejectedQuantity), unitCost: mapCost(line.unitCost, actor), totalAmount: mapCost(line.totalAmount, actor) })), approvals: document.approvals.map((approval) => ({ ...approval, requestedByName: peopleMap.get(approval.requestedBy) ?? "Unknown user", decisionByName: approval.decisionBy ? peopleMap.get(approval.decisionBy) ?? "Unknown user" : null })), movements: document.movements.map((movement) => ({ ...movement, postedByName: peopleMap.get(movement.postedBy) ?? "Unknown user", quantityIn: decimalString(movement.quantityIn), quantityOut: decimalString(movement.quantityOut), unitCost: mapCost(movement.unitCost, actor), amountIn: mapCost(movement.amountIn, actor), amountOut: mapCost(movement.amountOut, actor) })), attachments };
}

export async function createInventoryDocument(input: InventoryDocumentInput, actor: Actor, meta: RequestMeta) {
  requireInventoryPermission(actor, "INVENTORY_REQUEST_CREATE");
  requireInventoryScope(actor, input.siteId, input.departmentId);
  const record = await prisma.$transaction(async (tx) => {
    const { itemMap } = await validateDocumentLines(tx, input.documentType, input.lines);
    const documentDate = new Date(input.documentDate);
    const number = await nextDocumentNumber(tx, input.documentType, documentDate);
    const document = await tx.inventoryDocument.create({ data: { id: randomUUID(), documentType: input.documentType, documentNumber: number, documentDate, siteId: input.siteId ?? null, requesterId: actor.id, departmentId: input.departmentId ?? null, purpose: optionalString(input.purpose), referenceWorkOrderId: input.referenceWorkOrderId ?? null, referenceNotificationId: input.referenceNotificationId ?? null, status: "DRAFT", currentApprovalStep: null, remark: optionalString(input.remark), createdBy: actor.id, updatedBy: actor.id, lines: { create: input.lines.map((line, index) => lineData(line, itemMap.get(line.stockItemId)!, input.documentType, index + 1)) } } });
    await writeAudit(tx, { action: "INVENTORY_DOCUMENT_CREATED", category: "INVENTORY", targetType: "INVENTORY_DOCUMENT", targetId: document.id, targetName: document.documentNumber, description: `Created ${input.documentType.toLowerCase()} ${document.documentNumber}`, newValues: input }, actor, meta);
    return document;
  });
  return { id: record.id, documentNumber: record.documentNumber, status: record.status };
}

export async function updateInventoryDocument(id: string, input: InventoryDocumentInput, actor: Actor, meta: RequestMeta) {
  requireInventoryPermission(actor, "INVENTORY_REQUEST_CREATE");
  return prisma.$transaction(async (tx) => {
    const existing = await tx.inventoryDocument.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Inventory document not found", "INVENTORY_DOCUMENT_NOT_FOUND");
    if (existing.requesterId !== actor.id && !canManageAll(actor)) throw new HttpError(403, "Only the requester or inventory manager may edit this document", "FORBIDDEN");
    if (!["DRAFT", "RETURNED"].includes(existing.status)) throw new HttpError(409, "Submitted inventory documents cannot be edited", "INVENTORY_DOCUMENT_LOCKED");
    const { itemMap } = await validateDocumentLines(tx, input.documentType, input.lines);
    await tx.inventoryDocumentLine.deleteMany({ where: { documentId: id } });
    const updated = await tx.inventoryDocument.update({ where: { id }, data: { documentType: input.documentType, documentDate: new Date(input.documentDate), siteId: input.siteId ?? null, departmentId: input.departmentId ?? null, purpose: optionalString(input.purpose), referenceWorkOrderId: input.referenceWorkOrderId ?? null, referenceNotificationId: input.referenceNotificationId ?? null, status: existing.status === "RETURNED" ? "DRAFT" : existing.status, currentApprovalStep: null, remark: optionalString(input.remark), updatedBy: actor.id, lines: { create: input.lines.map((line, index) => lineData(line, itemMap.get(line.stockItemId)!, input.documentType, index + 1)) } } });
    await writeAudit(tx, { action: "INVENTORY_DOCUMENT_UPDATED", category: "INVENTORY", targetType: "INVENTORY_DOCUMENT", targetId: id, targetName: updated.documentNumber, description: `Updated inventory document ${updated.documentNumber}`, previousValues: { status: existing.status }, newValues: input }, actor, meta);
    return { id: updated.id, documentNumber: updated.documentNumber, status: updated.status };
  });
}

async function createDocumentApproval(tx: Tx, documentId: string, step: "MAINTENANCE_MANAGER" | "WAREHOUSE_MANAGER", requestedBy: string, round: number) {
  return tx.inventoryApproval.create({ data: { id: randomUUID(), documentId, step, sequence: step === "MAINTENANCE_MANAGER" ? 1 : 2, status: "PENDING", assignedRole: step, requestedBy, round } });
}

export async function submitInventoryDocument(id: string, actor: Actor, meta: RequestMeta) {
  requireInventoryPermission(actor, "INVENTORY_REQUEST_SUBMIT");
  const result = await prisma.$transaction(async (tx) => {
    const document = await tx.inventoryDocument.findUnique({ where: { id }, include: { lines: true } });
    if (!document) throw new HttpError(404, "Inventory document not found", "INVENTORY_DOCUMENT_NOT_FOUND");
    if (document.requesterId !== actor.id && !canManageAll(actor)) throw new HttpError(403, "Only the requester may submit this document", "FORBIDDEN");
    if (!["DRAFT", "RETURNED"].includes(document.status)) throw new HttpError(409, "Only a draft or returned document may be submitted", "INVALID_INVENTORY_STATUS");
    if (!document.lines.length) throw new HttpError(400, "Document requires at least one line", "INVENTORY_LINES_REQUIRED");
    const round = (await tx.inventoryApproval.aggregate({ where: { documentId: id }, _max: { round: true } }))._max.round ?? 0;
    await tx.inventoryDocument.update({ where: { id }, data: { status: "PENDING_MAINTENANCE_MANAGER", currentApprovalStep: "MAINTENANCE_MANAGER", submittedAt: new Date(), updatedBy: actor.id } });
    await createDocumentApproval(tx, id, "MAINTENANCE_MANAGER", actor.id, round + 1);
    await writeAudit(tx, { action: "INVENTORY_DOCUMENT_SUBMITTED", category: "INVENTORY", targetType: "INVENTORY_DOCUMENT", targetId: id, targetName: document.documentNumber, description: `Submitted ${document.documentNumber} for maintenance manager approval`, previousValues: { status: document.status }, newValues: { status: "PENDING_MAINTENANCE_MANAGER" } }, actor, meta);
    return document;
  });
  await notifyRoles(["MAINTENANCE_MANAGER", "ADMIN"], { type: "INVENTORY_PENDING_APPROVAL", title: `Inventory request awaiting review: ${result.documentNumber}`, message: `${result.documentType} request submitted by ${actor.fullName}.`, actionUrl: `/approvals?type=INVENTORY`, sourceType: "INVENTORY_DOCUMENT", sourceId: id }, actor, meta).catch(() => undefined);
  return { id, status: "PENDING_MAINTENANCE_MANAGER" };
}

async function lockBalance(tx: Tx, stockItemId: string, locationId: string) {
  await tx.stockItemLocation.upsert({ where: { stockItemId_locationId: { stockItemId, locationId } }, create: { id: randomUUID(), stockItemId, locationId, createdAt: new Date() }, update: {} });
  await tx.inventoryBalance.upsert({ where: { stockItemId_locationId: { stockItemId, locationId } }, create: { id: randomUUID(), stockItemId, locationId, quantityOnHand: D(0), reservedQuantity: D(0), movingAverageCost: D(0), createdAt: new Date(), updatedAt: new Date() }, update: {} });
  await tx.$queryRaw(Prisma.sql`SELECT id FROM inventory_balances WHERE stock_item_id = ${stockItemId} AND location_id = ${locationId} FOR UPDATE`);
  const balance = await tx.inventoryBalance.findUnique({ where: { stockItemId_locationId: { stockItemId, locationId } } });
  if (!balance) throw new HttpError(409, "Unable to lock inventory balance", "BALANCE_LOCK_FAILED");
  return balance;
}

async function allowNegativeStock(tx: Tx) {
  const setting = await tx.inventorySetting.findUnique({ where: { settingKey: "ALLOW_NEGATIVE_STOCK" } });
  return setting?.value.toLowerCase() === "true";
}

function movementData(base: { movementType: "ISSUE" | "RECEIPT" | "TRANSFER_OUT" | "TRANSFER_IN" | "ADJUST_IN" | "ADJUST_OUT" | "REVERSAL"; documentId?: string | null; documentNumber?: string | null; lineId?: string | null; stockItemId: string; locationId: string; sourceLocationId?: string | null; destinationLocationId?: string | null; sourceReceiptLineId?: string | null; quantityIn?: DecimalLike; quantityOut?: DecimalLike; quantityBefore: DecimalLike; quantityAfter: DecimalLike; unitCost: DecimalLike; amountIn?: DecimalLike; amountOut?: DecimalLike; valueBefore: DecimalLike; valueAfter: DecimalLike; movingAverageCostBefore: DecimalLike; movingAverageCostAfter: DecimalLike; vendorId?: string | null; workOrderId?: string | null; stockCountId?: string | null; postedBy: string; postedAt: Date }) {
  return { id: randomUUID(), movementType: base.movementType, documentId: base.documentId ?? null, documentNumber: base.documentNumber ?? null, lineId: base.lineId ?? null, stockItemId: base.stockItemId, locationId: base.locationId, sourceLocationId: base.sourceLocationId ?? null, destinationLocationId: base.destinationLocationId ?? null, sourceReceiptLineId: base.sourceReceiptLineId ?? null, quantityIn: D(base.quantityIn), quantityOut: D(base.quantityOut), quantityBefore: D(base.quantityBefore), quantityAfter: D(base.quantityAfter), unitCost: D(base.unitCost), amountIn: D(base.amountIn), amountOut: D(base.amountOut), valueBefore: D(base.valueBefore), valueAfter: D(base.valueAfter), movingAverageCostBefore: D(base.movingAverageCostBefore), movingAverageCostAfter: D(base.movingAverageCostAfter), vendorId: base.vendorId ?? null, workOrderId: base.workOrderId ?? null, stockCountId: base.stockCountId ?? null, postedBy: base.postedBy, postedAt: base.postedAt };
}

async function applyOut(tx: Tx, balance: Awaited<ReturnType<typeof lockBalance>>, quantity: Decimal, type: "ISSUE" | "TRANSFER_OUT" | "ADJUST_OUT" | "REVERSAL", context: { documentId?: string | null; documentNumber?: string | null; lineId?: string | null; stockItemId: string; locationId: string; sourceLocationId?: string | null; destinationLocationId?: string | null; sourceReceiptLineId?: string | null; unitCost?: DecimalLike; amount?: DecimalLike; vendorId?: string | null; workOrderId?: string | null; stockCountId?: string | null; postedBy: string; postedAt: Date }, allowNegative: boolean) {
  const before = D(balance.quantityOnHand); const balanceCost = D(balance.movingAverageCost); const movementCost = context.unitCost !== undefined ? D(context.unitCost) : balanceCost; const valueBefore = before.times(balanceCost); const after = before.minus(quantity);
  if (!allowNegative && after.lt(0)) throw new HttpError(409, "Insufficient available stock", "INSUFFICIENT_STOCK");
  const valueAfter = after.times(balanceCost); const amountOut = context.amount !== undefined ? D(context.amount) : quantity.times(movementCost);
  await tx.inventoryBalance.update({ where: { id: balance.id }, data: { quantityOnHand: after, lastMovementDate: context.postedAt, updatedAt: context.postedAt } });
  await tx.inventoryMovement.create({ data: movementData({ ...context, movementType: type, quantityOut: quantity, quantityBefore: before, quantityAfter: after, unitCost: movementCost, amountOut, valueBefore, valueAfter, movingAverageCostBefore: balanceCost, movingAverageCostAfter: balanceCost }) });
  Object.assign(balance, { quantityOnHand: after });
  return { quantity: after, cost: balanceCost };
}

async function applyIn(tx: Tx, balance: Awaited<ReturnType<typeof lockBalance>>, quantity: Decimal, unitCost: Decimal, type: "RECEIPT" | "TRANSFER_IN" | "ADJUST_IN" | "REVERSAL", context: { documentId?: string | null; documentNumber?: string | null; lineId?: string | null; stockItemId: string; locationId: string; sourceLocationId?: string | null; destinationLocationId?: string | null; sourceReceiptLineId?: string | null; amount?: DecimalLike; vendorId?: string | null; workOrderId?: string | null; stockCountId?: string | null; postedBy: string; postedAt: Date }) {
  const before = D(balance.quantityOnHand); const oldCost = D(balance.movingAverageCost); const valueBefore = before.times(oldCost); const amountIn = context.amount !== undefined ? D(context.amount) : quantity.times(unitCost); const after = before.plus(quantity); const valueAfter = valueBefore.plus(amountIn); const newCost = after.gt(0) ? valueAfter.div(after) : unitCost;
  await tx.inventoryBalance.update({ where: { id: balance.id }, data: { quantityOnHand: after, movingAverageCost: newCost, lastMovementDate: context.postedAt, updatedAt: context.postedAt } });
  await tx.inventoryMovement.create({ data: movementData({ ...context, movementType: type, quantityIn: quantity, quantityBefore: before, quantityAfter: after, unitCost, amountIn, valueBefore, valueAfter, movingAverageCostBefore: oldCost, movingAverageCostAfter: newCost }) });
  await tx.stockItem.update({ where: { id: context.stockItemId }, data: { movingAverageCost: newCost, updatedBy: context.postedBy } });
  Object.assign(balance, { quantityOnHand: after, movingAverageCost: newCost });
  return { quantity: after, cost: newCost };
}

async function resolveIssueReceiptSource(tx: Tx, line: { id: string; stockItemId: string; sourceLocationId: string | null; sourceReceiptLineId: string | null }, documentId: string, quantity: Decimal) {
  if (!line.sourceReceiptLineId) throw new HttpError(409, "Issue line has no source Receipt", "SOURCE_RECEIPT_REQUIRED");
  await tx.$queryRaw(Prisma.sql`SELECT id FROM inventory_document_lines WHERE id = ${line.sourceReceiptLineId} FOR UPDATE`);
  const receiptLine = await tx.inventoryDocumentLine.findUnique({ where: { id: line.sourceReceiptLineId }, include: { document: true } });
  if (!receiptLine || receiptLine.document.documentType !== "RECEIPT" || receiptLine.document.status !== "POSTED") throw new HttpError(409, "The selected Receipt is not posted", "RECEIPT_SOURCE_NOT_POSTED");
  if (receiptLine.stockItemId !== line.stockItemId) throw new HttpError(409, "The selected Receipt item does not match the Issue item", "RECEIPT_SOURCE_ITEM_MISMATCH");
  if (!line.sourceLocationId || receiptLine.destinationLocationId !== line.sourceLocationId) throw new HttpError(409, "The selected Receipt location does not match the Issue source location", "RECEIPT_SOURCE_LOCATION_MISMATCH");
  const receivedQuantity = D(receiptLine.approvedQuantity ?? receiptLine.requestedQuantity);
  const issuedLines = await tx.inventoryDocumentLine.findMany({ where: { sourceReceiptLineId: line.sourceReceiptLineId, document: { documentType: "ISSUE", status: "POSTED", id: { not: documentId } } }, select: { approvedQuantity: true, requestedQuantity: true } });
  const alreadyIssued = issuedLines.reduce((sum, issuedLine) => sum.plus(issuedLine.approvedQuantity ?? issuedLine.requestedQuantity), D(0));
  if (alreadyIssued.plus(quantity).gt(receivedQuantity)) throw new HttpError(409, `Issue quantity exceeds the selected Receipt available quantity (${decimalString(receivedQuantity.minus(alreadyIssued))})`, "RECEIPT_SOURCE_QUANTITY_EXCEEDED");
  const unitCost = D(receiptLine.totalAmount).gt(0) && receivedQuantity.gt(0) ? D(receiptLine.totalAmount).div(receivedQuantity) : D(receiptLine.unitCost);
  const amount = alreadyIssued.isZero() && quantity.eq(receivedQuantity) ? D(receiptLine.totalAmount) : quantity.times(unitCost);
  return { receiptLine, unitCost, amount, availableQuantity: receivedQuantity.minus(alreadyIssued) };
}

export async function postInventoryDocumentTx(tx: Tx, documentId: string, actor: Actor, meta: RequestMeta) {
  const document = await tx.inventoryDocument.findUnique({ where: { id: documentId }, include: { lines: { orderBy: { lineNumber: "asc" } } } });
  if (!document) throw new HttpError(404, "Inventory document not found", "INVENTORY_DOCUMENT_NOT_FOUND");
  if (document.status === "POSTED") return document;
  if (!["PENDING_WAREHOUSE_MANAGER", "APPROVED"].includes(document.status)) throw new HttpError(409, "Inventory document is not ready for posting", "INVENTORY_NOT_READY_TO_POST");
  const pairs = document.lines.flatMap((line) => [line.sourceLocationId, line.destinationLocationId].filter((locationId): locationId is string => Boolean(locationId)).map((locationId) => ({ itemId: line.stockItemId, locationId }))).sort((a, b) => `${a.itemId}:${a.locationId}`.localeCompare(`${b.itemId}:${b.locationId}`));
  const balances = new Map<string, Awaited<ReturnType<typeof lockBalance>>>();
  for (const pair of pairs) if (!balances.has(`${pair.itemId}:${pair.locationId}`)) balances.set(`${pair.itemId}:${pair.locationId}`, await lockBalance(tx, pair.itemId, pair.locationId));
  const negativeAllowed = await allowNegativeStock(tx); const postedAt = new Date();
  for (const line of document.lines) {
    const quantity = D(line.approvedQuantity ?? line.requestedQuantity); if (quantity.lte(0)) continue;
    if (document.documentType === "ISSUE") {
      const receiptSource = await resolveIssueReceiptSource(tx, line, documentId, quantity);
      const source = balances.get(`${line.stockItemId}:${line.sourceLocationId}`)!;
      await applyOut(tx, source, quantity, "ISSUE", { documentId, documentNumber: document.documentNumber, lineId: line.id, stockItemId: line.stockItemId, locationId: line.sourceLocationId!, destinationLocationId: null, sourceReceiptLineId: line.sourceReceiptLineId, unitCost: receiptSource.unitCost, amount: receiptSource.amount, vendorId: line.vendorId, workOrderId: line.workOrderId, postedBy: actor.id, postedAt }, negativeAllowed);
      await tx.inventoryDocumentLine.update({ where: { id: line.id }, data: { unitCost: receiptSource.unitCost, totalAmount: quantity.times(receiptSource.unitCost) } });
    } else if (document.documentType === "RECEIPT") {
      const destination = balances.get(`${line.stockItemId}:${line.destinationLocationId}`)!;
      const receiptQuantity = D(line.requestedQuantity); const receiptAmount = receiptQuantity.gt(0) ? D(line.totalAmount).div(receiptQuantity).times(quantity) : D(line.totalAmount);
      await applyIn(tx, destination, quantity, D(line.unitCost), "RECEIPT", { documentId, documentNumber: document.documentNumber, lineId: line.id, stockItemId: line.stockItemId, locationId: line.destinationLocationId!, amount: receiptAmount, vendorId: line.vendorId, workOrderId: line.workOrderId, postedBy: actor.id, postedAt });
    } else {
      const source = balances.get(`${line.stockItemId}:${line.sourceLocationId}`)!; const destination = balances.get(`${line.stockItemId}:${line.destinationLocationId}`)!; const sourceCost = D(source.movingAverageCost);
      await applyOut(tx, source, quantity, "TRANSFER_OUT", { documentId, documentNumber: document.documentNumber, lineId: line.id, stockItemId: line.stockItemId, locationId: line.sourceLocationId!, destinationLocationId: line.destinationLocationId, workOrderId: line.workOrderId, postedBy: actor.id, postedAt }, negativeAllowed);
      await applyIn(tx, destination, quantity, sourceCost, "TRANSFER_IN", { documentId, documentNumber: document.documentNumber, lineId: line.id, stockItemId: line.stockItemId, locationId: line.destinationLocationId!, sourceLocationId: line.sourceLocationId, workOrderId: line.workOrderId, postedBy: actor.id, postedAt });
    }
  }
  const posted = await tx.inventoryDocument.update({ where: { id: documentId }, data: { status: "POSTED", currentApprovalStep: null, postedAt, postedBy: actor.id, postingTransactionId: randomUUID(), updatedBy: actor.id } });
  await writeAudit(tx, { action: "INVENTORY_DOCUMENT_POSTED", category: "INVENTORY", targetType: "INVENTORY_DOCUMENT", targetId: documentId, targetName: document.documentNumber, description: `Posted inventory document ${document.documentNumber}`, previousValues: { status: document.status }, newValues: { status: posted.status, postedAt } }, actor, meta);
  return posted;
}

export async function cancelInventoryDocument(id: string, actor: Actor, meta: RequestMeta) {
  requireInventoryPermission(actor, "INVENTORY_POST");
  const result = await prisma.$transaction(async (tx) => {
    const document = await tx.inventoryDocument.findUnique({ where: { id }, include: { movements: { orderBy: { postedAt: "desc" } } } });
    if (!document) throw new HttpError(404, "Inventory document not found", "INVENTORY_DOCUMENT_NOT_FOUND");
    if (document.status === "CANCELLED") return document;
    if (["DRAFT", "RETURNED", "REJECTED"].includes(document.status)) {
      const cancelled = await tx.inventoryDocument.update({ where: { id }, data: { status: "CANCELLED", currentApprovalStep: null, updatedBy: actor.id } });
      await writeAudit(tx, { action: "INVENTORY_CANCELLED", category: "INVENTORY", targetType: "INVENTORY_DOCUMENT", targetId: id, targetName: document.documentNumber, description: `Cancelled inventory document ${document.documentNumber}`, previousValues: { status: document.status }, newValues: { status: cancelled.status } }, actor, meta);
      return cancelled;
    }
    if (document.status !== "POSTED") throw new HttpError(409, "Only a posted document can be reversed", "INVENTORY_NOT_REVERSIBLE");
    if (document.documentType === "RECEIPT") {
      const receiptLines = await tx.inventoryDocumentLine.findMany({ where: { documentId: id }, select: { id: true } });
      const issuedAgainstReceipt = receiptLines.length ? await tx.inventoryDocumentLine.findFirst({ where: { sourceReceiptLineId: { in: receiptLines.map((line) => line.id) }, document: { documentType: "ISSUE", status: "POSTED" } }, select: { id: true } }) : null;
      if (issuedAgainstReceipt) throw new HttpError(409, "A Receipt with posted Issues cannot be cancelled", "RECEIPT_HAS_ISSUES");
    }
    const pairs = document.movements.map((movement) => ({ itemId: movement.stockItemId, locationId: movement.locationId })).sort((a, b) => `${a.itemId}:${a.locationId}`.localeCompare(`${b.itemId}:${b.locationId}`));
    const balances = new Map<string, Awaited<ReturnType<typeof lockBalance>>>();
    for (const pair of pairs) if (!balances.has(`${pair.itemId}:${pair.locationId}`)) balances.set(`${pair.itemId}:${pair.locationId}`, await lockBalance(tx, pair.itemId, pair.locationId));
    const postedAt = new Date();
    for (const movement of document.movements) {
      const balance = balances.get(`${movement.stockItemId}:${movement.locationId}`)!;
      const context = { documentId: id, documentNumber: document.documentNumber, lineId: movement.lineId, stockItemId: movement.stockItemId, locationId: movement.locationId, sourceLocationId: movement.sourceLocationId, destinationLocationId: movement.destinationLocationId, sourceReceiptLineId: movement.sourceReceiptLineId, unitCost: movement.unitCost, vendorId: movement.vendorId, workOrderId: movement.workOrderId, stockCountId: movement.stockCountId, postedBy: actor.id, postedAt };
      if (D(movement.quantityIn).gt(0)) await applyOut(tx, balance, D(movement.quantityIn), "REVERSAL", { ...context, amount: movement.amountIn }, false);
      if (D(movement.quantityOut).gt(0)) await applyIn(tx, balance, D(movement.quantityOut), D(movement.unitCost), "REVERSAL", { ...context, amount: movement.amountOut });
    }
    const cancelled = await tx.inventoryDocument.update({ where: { id }, data: { status: "CANCELLED", currentApprovalStep: null, updatedBy: actor.id } });
    await writeAudit(tx, { action: "INVENTORY_REVERSED", category: "INVENTORY", targetType: "INVENTORY_DOCUMENT", targetId: id, targetName: document.documentNumber, description: `Reversed posted inventory document ${document.documentNumber}`, previousValues: { status: document.status }, newValues: { status: cancelled.status, reversalAt: postedAt } }, actor, meta);
    return cancelled;
  });
  if (result.requesterId && result.requesterId !== actor.id) await createNotification({ type: "INVENTORY_CANCELLED", title: `Inventory document cancelled: ${result.documentNumber}`, message: `Document ${result.documentNumber} was cancelled and any posted stock was reversed.`, actionUrl: `/inventory/requests`, sourceType: "INVENTORY_DOCUMENT", sourceId: id, recipientIds: [result.requesterId] }, actor, meta).catch(() => undefined);
  return { id, status: result.status };
}

export async function reviewInventoryApproval(id: string, input: z.infer<typeof inventoryApprovalActionSchema>, actor: Actor, meta: RequestMeta) {
  requireInventoryPermission(actor, "VIEW_APPROVAL_CENTER");
  if (input.action === "OPEN") {
    const approval = await prisma.inventoryApproval.findUnique({ where: { id } });
    if (!approval || (approval.status !== "PENDING" && approval.status !== "IN_REVIEW")) throw new HttpError(404, "Inventory approval not found", "INVENTORY_APPROVAL_NOT_FOUND");
    if (approval.step === "MAINTENANCE_MANAGER") requireInventoryPermission(actor, "INVENTORY_APPROVE_MAINTENANCE");
    if (approval.step === "WAREHOUSE_MANAGER") requireInventoryPermission(actor, "INVENTORY_APPROVE_WAREHOUSE");
    if (approval.step === "PLANT_MANAGER") requireInventoryPermission(actor, "INVENTORY_COUNT_REVIEW");
    if (approval.requestedBy === actor.id) throw new HttpError(409, "The requester cannot approve their own inventory document", "SEGREGATION_OF_DUTIES");
    return prisma.inventoryApproval.update({ where: { id }, data: { status: "IN_REVIEW" } });
  }
  const result = await prisma.$transaction(async (tx) => {
    const approval = await tx.inventoryApproval.findUnique({ where: { id }, include: { document: { include: { lines: true } }, stockCount: { include: { lines: true } } } });
    if (!approval || (approval.status !== "PENDING" && approval.status !== "IN_REVIEW")) throw new HttpError(409, "Inventory approval is already completed", "INVENTORY_APPROVAL_COMPLETED");
    if (approval.requestedBy === actor.id) throw new HttpError(409, "The requester cannot approve their own inventory document", "SEGREGATION_OF_DUTIES");
    if (approval.step === "MAINTENANCE_MANAGER") requireInventoryPermission(actor, "INVENTORY_APPROVE_MAINTENANCE");
    if (approval.step === "WAREHOUSE_MANAGER") requireInventoryPermission(actor, "INVENTORY_APPROVE_WAREHOUSE");
    if (approval.step === "PLANT_MANAGER") requireInventoryPermission(actor, "INVENTORY_COUNT_REVIEW");
    const now = new Date(); const status = input.action === "APPROVE" ? "APPROVED" : input.action === "RETURN" ? "RETURNED" : "REJECTED";
    await tx.inventoryApproval.update({ where: { id }, data: { status, decisionBy: actor.id, decisionComment: input.comment, decidedAt: now } });
    if (approval.document) {
      if (input.action === "APPROVE" && approval.step === "MAINTENANCE_MANAGER") {
        await tx.inventoryDocument.update({ where: { id: approval.document.id }, data: { status: "PENDING_WAREHOUSE_MANAGER", currentApprovalStep: "WAREHOUSE_MANAGER", updatedBy: actor.id } });
        await createDocumentApproval(tx, approval.document.id, "WAREHOUSE_MANAGER", approval.requestedBy, approval.round);
      } else if (input.action === "APPROVE" && approval.step === "WAREHOUSE_MANAGER") {
        await tx.inventoryDocument.update({ where: { id: approval.document.id }, data: { status: "APPROVED", updatedBy: actor.id } });
        await postInventoryDocumentTx(tx, approval.document.id, actor, meta);
      } else {
        await tx.inventoryDocument.update({ where: { id: approval.document.id }, data: { status, currentApprovalStep: null, updatedBy: actor.id } });
      }
      await writeAudit(tx, { action: `INVENTORY_${input.action}`, category: "INVENTORY", targetType: "INVENTORY_DOCUMENT", targetId: approval.document.id, targetName: approval.document.documentNumber, description: `${input.action} inventory document ${approval.document.documentNumber}`, newValues: { step: approval.step, comment: input.comment } }, actor, meta);
      return { id, documentId: approval.document.id, documentNumber: approval.document.documentNumber, requesterId: approval.requestedBy, status, nextRole: input.action === "APPROVE" && approval.step === "MAINTENANCE_MANAGER" ? "WAREHOUSE_MANAGER" : null, notifyRequester: input.action !== "APPROVE" || approval.step === "WAREHOUSE_MANAGER", posted: input.action === "APPROVE" && approval.step === "WAREHOUSE_MANAGER" };
    }
    if (!approval.stockCount) throw new HttpError(409, "Inventory approval has no target", "INVENTORY_APPROVAL_TARGET_MISSING");
    if (input.action === "APPROVE") {
      await postStockCountTx(tx, approval.stockCount.id, actor, meta);
    } else {
      await tx.stockCount.update({ where: { id: approval.stockCount.id }, data: { status, updatedBy: actor.id } });
    }
    await writeAudit(tx, { action: `STOCK_COUNT_${input.action}`, category: "INVENTORY", targetType: "STOCK_COUNT", targetId: approval.stockCount.id, targetName: approval.stockCount.countNumber, description: `${input.action} stock count ${approval.stockCount.countNumber}`, newValues: { comment: input.comment } }, actor, meta);
    return { id, stockCountId: approval.stockCount.id, countNumber: approval.stockCount.countNumber, requesterId: approval.requestedBy, status, nextRole: null, notifyRequester: true, posted: input.action === "APPROVE" };
  });
  if (result.nextRole) await notifyRoles([result.nextRole, "ADMIN"], { type: "INVENTORY_PENDING_APPROVAL", title: `Inventory approval required: ${result.documentNumber}`, message: `Document ${result.documentNumber} is waiting for Warehouse Manager approval.`, actionUrl: `/approvals?type=INVENTORY`, sourceType: "INVENTORY_DOCUMENT", sourceId: result.documentId! }, actor, meta).catch(() => undefined);
  if (result.notifyRequester && result.requesterId !== actor.id) {
    const referenceNumber = result.documentNumber ?? result.countNumber ?? "inventory record";
    const message = result.posted ? `${referenceNumber} was approved and posted.` : `${referenceNumber} was ${input.action.toLowerCase()} with comment: ${input.comment}`;
    await createNotification({ type: result.posted ? "INVENTORY_POSTED" : `INVENTORY_${input.action}`, title: `${referenceNumber} ${result.posted ? "posted" : input.action.toLowerCase()}`, message, actionUrl: result.documentId ? `/inventory/requests` : `/inventory/counts`, sourceType: result.documentId ? "INVENTORY_DOCUMENT" : "STOCK_COUNT", sourceId: result.documentId ?? result.stockCountId!, recipientIds: [result.requesterId] }, actor, meta).catch(() => undefined);
  }
  return { id: result.id, documentId: result.documentId, stockCountId: result.stockCountId, status: result.status };
}

export async function listInventoryApprovals(actor: Actor, query: { tab?: string; q?: string; type?: string; page?: number; pageSize?: number } = {}) {
  requireInventoryPermission(actor, "VIEW_APPROVAL_CENTER");
  const accessibleSteps = [
    ...(actor.permissions.includes("INVENTORY_APPROVE_MAINTENANCE") ? ["MAINTENANCE_MANAGER"] : []),
    ...(actor.permissions.includes("INVENTORY_APPROVE_WAREHOUSE") ? ["WAREHOUSE_MANAGER"] : []),
    ...(actor.permissions.includes("INVENTORY_COUNT_REVIEW") ? ["PLANT_MANAGER"] : []),
  ];
  const tabStatus: Record<string, string[]> = { pending: ["PENDING"], "in-review": ["IN_REVIEW"], returned: ["RETURNED"], approved: ["APPROVED"], rejected: ["REJECTED"], all: [] };
  const approvals = await prisma.inventoryApproval.findMany({ where: { assignedRole: { in: accessibleSteps }, ...(tabStatus[query.tab ?? "pending"]?.length ? { status: { in: tabStatus[query.tab ?? "pending"] as never[] } } : {}) }, include: { document: true, stockCount: true } });
  const filtered = approvals.filter((approval) => {
    const number = approval.document?.documentNumber ?? approval.stockCount?.countNumber ?? ""; const title = approval.document ? `${approval.document.documentType} ${approval.document.purpose ?? ""}` : `Stock Count ${approval.stockCount?.countType ?? ""}`;
    return !query.q || `${number} ${title}`.toLowerCase().includes(query.q.toLowerCase());
  }).sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
  const people = await prisma.user.findMany({ where: { id: { in: [...new Set(filtered.map((approval) => approval.requestedBy))] } }, select: { id: true, fullName: true } });
  const peopleMap = new Map(people.map((person) => [person.id, person.fullName]));
  const page = query.page ?? 1; const pageSize = query.pageSize ?? 20; const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize).map((approval) => ({ id: approval.id, approvalType: "INVENTORY", referenceId: approval.document?.id ?? approval.stockCount?.id, referenceNumber: approval.document?.documentNumber ?? approval.stockCount?.countNumber ?? "—", title: approval.document ? `${approval.document.documentType} request` : `Stock Count · ${approval.stockCount?.countType ?? ""}`, status: approval.status, priority: null, requestedAt: approval.requestedAt, requestedByName: peopleMap.get(approval.requestedBy) ?? "Unknown user", assignedRole: approval.assignedRole, waitingMinutes: Math.max(0, Math.floor((Date.now() - approval.requestedAt.getTime()) / 60000)), approvalRound: approval.round, siteId: approval.document?.siteId ?? approval.stockCount?.siteId ?? null }));
  return { items, total: filtered.length, page, pageSize, pages: Math.max(1, Math.ceil(filtered.length / pageSize)), stats: { pending: filtered.filter((approval) => approval.status === "PENDING").length, inReview: filtered.filter((approval) => approval.status === "IN_REVIEW").length, overdue: filtered.filter((approval) => ["PENDING", "IN_REVIEW"].includes(approval.status) && Date.now() - approval.requestedAt.getTime() >= 86_400_000).length, approvedToday: filtered.filter((approval) => approval.status === "APPROVED" && approval.decidedAt && approval.decidedAt.toDateString() === new Date().toDateString()).length } };
}

export async function getInventoryApprovalDetail(id: string, actor: Actor) {
  requireInventoryPermission(actor, "VIEW_APPROVAL_CENTER");
  const approval = await prisma.inventoryApproval.findUnique({
    where: { id },
    include: {
      document: {
        include: {
          lines: { include: { stockItem: true, sourceLocation: true, destinationLocation: true, vendor: true } },
          approvals: { orderBy: [{ round: "asc" }, { sequence: "asc" }] },
        },
      },
      stockCount: { include: { lines: { include: { stockItem: true, location: true } }, approvals: true } },
    },
  });
  if (!approval) throw new HttpError(404, "Inventory approval not found", "INVENTORY_APPROVAL_NOT_FOUND");
  if (approval.document && !documentCanRead(actor, approval.document)) throw new HttpError(403, "This approval is outside your inventory scope", "SCOPE_FORBIDDEN");
  const requester = await prisma.user.findUnique({ where: { id: approval.requestedBy }, select: { fullName: true } });
  return { task: { id: approval.id, approvalType: "INVENTORY", referenceNumber: approval.document?.documentNumber ?? approval.stockCount?.countNumber ?? "—", title: approval.document ? `${approval.document.documentType} request` : `Stock Count · ${approval.stockCount?.countType ?? ""}`, status: approval.status, priority: null, requestedAt: approval.requestedAt, requestedByName: requester?.fullName ?? "Unknown user", assignedRole: approval.assignedRole, waitingMinutes: Math.max(0, Math.floor((Date.now() - approval.requestedAt.getTime()) / 60000)), approvalRound: approval.round, siteId: approval.document?.siteId ?? approval.stockCount?.siteId ?? null }, inventory: approval.document ? { kind: "DOCUMENT", document: { ...approval.document, lines: approval.document.lines.map((line) => ({ ...line, requestedQuantity: decimalString(line.requestedQuantity), approvedQuantity: line.approvedQuantity ? decimalString(line.approvedQuantity) : null, rejectedQuantity: decimalString(line.rejectedQuantity), unitCost: mapCost(line.unitCost, actor), totalAmount: mapCost(line.totalAmount, actor) })) } } : { kind: "STOCK_COUNT", stockCount: { ...approval.stockCount, lines: approval.stockCount?.lines.map((line) => ({ ...line, systemQuantity: decimalString(line.systemQuantity), countedQuantity: line.countedQuantity ? decimalString(line.countedQuantity) : null, varianceQuantity: line.varianceQuantity ? decimalString(line.varianceQuantity) : null, unitCost: mapCost(line.unitCost, actor), varianceAmount: line.varianceAmount ? mapCost(line.varianceAmount, actor) : null })) } }, notification: null, asset: null, attachments: [], history: [], timeline: [], audit: [] };
}

export async function createStockCount(input: z.infer<typeof stockCountMutationSchema>, actor: Actor, meta: RequestMeta) {
  requireInventoryPermission(actor, "INVENTORY_COUNT_MANAGE");
  const count = await prisma.$transaction(async (tx) => {
    const number = await nextDocumentNumber(tx, "TRANSFER", new Date(input.countDate));
    const countNumber = number.replace("TRF", "CNT");
    const cutoffAt = new Date(input.cutoffAt);
    const lines = [];
    for (const inputLine of input.lines) {
      const movements = await tx.inventoryMovement.findMany({ where: { stockItemId: inputLine.stockItemId, locationId: inputLine.locationId, postedAt: { lte: cutoffAt } }, orderBy: { postedAt: "asc" }, select: { quantityIn: true, quantityOut: true, unitCost: true } });
      const systemQuantity = movements.reduce((sum, movement) => sum.plus(movement.quantityIn).minus(movement.quantityOut), D(0));
      const latest = movements.at(-1); const current = await tx.inventoryBalance.findUnique({ where: { stockItemId_locationId: { stockItemId: inputLine.stockItemId, locationId: inputLine.locationId } } });
      lines.push({ id: randomUUID(), stockItemId: inputLine.stockItemId, locationId: inputLine.locationId, systemQuantity, countedQuantity: inputLine.countedQuantity ? D(inputLine.countedQuantity) : null, varianceQuantity: inputLine.countedQuantity ? D(inputLine.countedQuantity).minus(systemQuantity) : null, unitCost: latest?.unitCost ?? current?.movingAverageCost ?? D(0), varianceAmount: inputLine.countedQuantity ? D(inputLine.countedQuantity).minus(systemQuantity).times(latest?.unitCost ?? current?.movingAverageCost ?? D(0)) : null, remark: optionalString(inputLine.remark) });
    }
    const record = await tx.stockCount.create({ data: { id: randomUUID(), countNumber, countDate: new Date(input.countDate), cutoffAt, siteId: input.siteId ?? null, locationId: input.locationId ?? null, countType: input.countType, responsiblePersonId: input.responsiblePersonId ?? null, status: "COUNTING", remark: optionalString(input.remark), createdBy: actor.id, updatedBy: actor.id, lines: { create: lines } } });
    await writeAudit(tx, { action: "STOCK_COUNT_CREATED", category: "INVENTORY", targetType: "STOCK_COUNT", targetId: record.id, targetName: record.countNumber, description: `Created stock count ${record.countNumber}`, newValues: input }, actor, meta);
    return record;
  });
  return { id: count.id, countNumber: count.countNumber, status: count.status };
}

function requireStockCountRead(actor: Actor) {
  if (!actor.permissions.includes("INVENTORY_COUNT_MANAGE") && !actor.permissions.includes("INVENTORY_COUNT_REVIEW")) throw new HttpError(403, "Missing stock count permission", "FORBIDDEN");
}

function mapStockCount<T extends { lines: Array<{ systemQuantity: Decimal; countedQuantity: Decimal | null; varianceQuantity: Decimal | null; unitCost: Decimal; varianceAmount: Decimal | null }> }>(count: T, actor: Actor) {
  return { ...count, lines: count.lines.map((line) => ({ ...line, systemQuantity: decimalString(line.systemQuantity), countedQuantity: line.countedQuantity ? decimalString(line.countedQuantity) : null, varianceQuantity: line.varianceQuantity ? decimalString(line.varianceQuantity) : null, unitCost: mapCost(line.unitCost, actor), varianceAmount: line.varianceAmount ? mapCost(line.varianceAmount, actor) : null })) };
}

export async function getStockCount(id: string, actor: Actor) {
  requireStockCountRead(actor);
  const count = await prisma.stockCount.findUnique({ where: { id }, include: { lines: { include: { stockItem: true, location: true } }, approvals: true } });
  if (!count) throw new HttpError(404, "Stock count not found", "STOCK_COUNT_NOT_FOUND");
  return mapStockCount(count, actor);
}

export async function listStockCounts(actor: Actor) {
  requireStockCountRead(actor);
  const counts = await prisma.stockCount.findMany({ include: { lines: { include: { stockItem: true, location: true } }, approvals: true }, orderBy: { createdAt: "desc" }, take: 100 });
  return { counts: counts.map((count) => mapStockCount(count, actor)) };
}

export async function updateStockCount(id: string, input: z.infer<typeof stockCountUpdateSchema>, actor: Actor, meta: RequestMeta) {
  requireInventoryPermission(actor, "INVENTORY_COUNT_MANAGE");
  return prisma.$transaction(async (tx) => {
    const count = await tx.stockCount.findUnique({ where: { id }, include: { lines: true } });
    if (!count) throw new HttpError(404, "Stock count not found", "STOCK_COUNT_NOT_FOUND");
    if (!["COUNTING", "RETURNED"].includes(count.status)) throw new HttpError(409, "This stock count is locked", "STOCK_COUNT_LOCKED");
    for (const line of input.lines) {
      const existing = count.lines.find((candidate) => candidate.id === line.id); if (!existing) throw new HttpError(400, "Invalid stock count line", "INVALID_STOCK_COUNT_LINE");
      const counted = line.countedQuantity ? D(line.countedQuantity) : null; const variance = counted ? counted.minus(existing.systemQuantity) : null;
      await tx.stockCountLine.update({ where: { id: line.id }, data: { countedQuantity: counted, varianceQuantity: variance, varianceAmount: variance ? variance.times(existing.unitCost) : null, remark: optionalString(line.remark) } });
    }
    const updated = await tx.stockCount.update({ where: { id }, data: { status: "COUNTING", remark: optionalString(input.remark), updatedBy: actor.id } });
    await writeAudit(tx, { action: "STOCK_COUNT_UPDATED", category: "INVENTORY", targetType: "STOCK_COUNT", targetId: id, targetName: count.countNumber, description: `Updated stock count ${count.countNumber}`, newValues: input }, actor, meta);
    return updated;
  });
}

export async function submitStockCount(id: string, actor: Actor, meta: RequestMeta) {
  requireInventoryPermission(actor, "INVENTORY_COUNT_MANAGE");
  const result = await prisma.$transaction(async (tx) => {
    const count = await tx.stockCount.findUnique({ where: { id }, include: { lines: true } });
    if (!count) throw new HttpError(404, "Stock count not found", "STOCK_COUNT_NOT_FOUND");
    if (!["COUNTING", "RETURNED"].includes(count.status)) throw new HttpError(409, "Only a counting or returned count may be submitted", "INVALID_STOCK_COUNT_STATUS");
    if (count.lines.some((line) => line.countedQuantity === null)) throw new HttpError(400, "Every stock count line must have a counted quantity", "COUNTED_QUANTITY_REQUIRED");
    const round = (await tx.inventoryApproval.aggregate({ where: { stockCountId: id }, _max: { round: true } }))._max.round ?? 0;
    await tx.stockCount.update({ where: { id }, data: { status: "PENDING_PLANT_MANAGER", submittedAt: new Date(), updatedBy: actor.id } });
    await tx.inventoryApproval.create({ data: { id: randomUUID(), stockCountId: id, step: "PLANT_MANAGER", sequence: 1, status: "PENDING", assignedRole: "PLANT_MANAGER", requestedBy: actor.id, round: round + 1 } });
    await writeAudit(tx, { action: "STOCK_COUNT_SUBMITTED", category: "INVENTORY", targetType: "STOCK_COUNT", targetId: id, targetName: count.countNumber, description: `Submitted stock count ${count.countNumber}`, previousValues: { status: count.status }, newValues: { status: "PENDING_PLANT_MANAGER" } }, actor, meta);
    return count;
  });
  await notifyRoles(["PLANT_MANAGER", "ADMIN"], { type: "STOCK_COUNT_PENDING", title: `Stock count awaiting approval: ${result.countNumber}`, message: `A stock count submitted by ${actor.fullName} requires Plant Manager review.`, actionUrl: `/approvals?type=INVENTORY`, sourceType: "STOCK_COUNT", sourceId: id }, actor, meta).catch(() => undefined);
  return { id, status: "PENDING_PLANT_MANAGER" };
}

async function postStockCountTx(tx: Tx, countId: string, actor: Actor, meta: RequestMeta) {
  const count = await tx.stockCount.findUnique({ where: { id: countId }, include: { lines: true } });
  if (!count) throw new HttpError(404, "Stock count not found", "STOCK_COUNT_NOT_FOUND");
  if (count.status === "POSTED") return count;
  if (count.status !== "PENDING_PLANT_MANAGER") throw new HttpError(409, "Stock count is not ready for posting", "STOCK_COUNT_NOT_READY");
  const pairs = count.lines.map((line) => ({ itemId: line.stockItemId, locationId: line.locationId })).sort((a, b) => `${a.itemId}:${a.locationId}`.localeCompare(`${b.itemId}:${b.locationId}`)); const balances = new Map<string, Awaited<ReturnType<typeof lockBalance>>>();
  for (const pair of pairs) if (!balances.has(`${pair.itemId}:${pair.locationId}`)) balances.set(`${pair.itemId}:${pair.locationId}`, await lockBalance(tx, pair.itemId, pair.locationId));
  const postedAt = new Date();
  for (const line of count.lines) {
    const counted = D(line.countedQuantity); const balance = balances.get(`${line.stockItemId}:${line.locationId}`)!; const current = D(balance.quantityOnHand); const variance = counted.minus(current); const cost = D(balance.movingAverageCost);
    if (variance.gt(0)) await applyIn(tx, balance, variance, cost, "ADJUST_IN", { documentNumber: count.countNumber, stockCountId: countId, lineId: line.id, stockItemId: line.stockItemId, locationId: line.locationId, postedBy: actor.id, postedAt });
    if (variance.lt(0)) await applyOut(tx, balance, variance.abs(), "ADJUST_OUT", { documentNumber: count.countNumber, stockCountId: countId, lineId: line.id, stockItemId: line.stockItemId, locationId: line.locationId, postedBy: actor.id, postedAt }, false);
    await tx.inventoryBalance.update({ where: { id: balance.id }, data: { lastCountDate: postedAt } });
  }
  const posted = await tx.stockCount.update({ where: { id: countId }, data: { status: "POSTED", approvedAt: postedAt, postedAt, postedBy: actor.id, updatedBy: actor.id } });
  await writeAudit(tx, { action: "STOCK_COUNT_POSTED", category: "INVENTORY", targetType: "STOCK_COUNT", targetId: countId, targetName: count.countNumber, description: `Posted stock count ${count.countNumber}`, previousValues: { status: count.status }, newValues: { status: posted.status } }, actor, meta);
  return posted;
}

export async function listBalances(query: z.infer<typeof inventoryReportQuerySchema>, actor: Actor) {
  requireInventoryPermission(actor, "INVENTORY_REPORT_VIEW");
  const where: Prisma.InventoryBalanceWhereInput = { ...(query.stockItemId ? { stockItemId: query.stockItemId } : {}), ...(query.locationId ? { locationId: query.locationId } : {}) };
  const balances = await prisma.inventoryBalance.findMany({ where, include: { stockItem: true, location: true }, orderBy: [{ stockItem: { code: "asc" } }, { location: { code: "asc" } }], skip: (query.page - 1) * query.pageSize, take: query.pageSize });
  const total = await prisma.inventoryBalance.count({ where });
  return { balances: balances.map((balance) => ({ ...balance, quantityOnHand: decimalString(balance.quantityOnHand), reservedQuantity: decimalString(balance.reservedQuantity), availableQuantity: decimalString(D(balance.quantityOnHand).minus(balance.reservedQuantity)), movingAverageCost: mapCost(balance.movingAverageCost, actor), inventoryValue: mapCost(D(balance.quantityOnHand).times(balance.movingAverageCost), actor) })), total, page: query.page, pageSize: query.pageSize, pages: Math.max(1, Math.ceil(total / query.pageSize)) };
}

export async function listMovements(query: z.infer<typeof inventoryReportQuerySchema>, actor: Actor) {
  requireInventoryPermission(actor, "INVENTORY_REPORT_VIEW");
  const where: Prisma.InventoryMovementWhereInput = { ...(query.stockItemId ? { stockItemId: query.stockItemId } : {}), ...(query.locationId ? { locationId: query.locationId } : {}), ...(query.vendorId ? { vendorId: query.vendorId } : {}), ...(query.movementType ? { movementType: query.movementType as never } : {}), ...(query.documentNumber ? { documentNumber: { contains: query.documentNumber } } : {}), ...(query.from || query.to ? { postedAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) } } : {}) };
  const [movements, total] = await Promise.all([prisma.inventoryMovement.findMany({ where, include: { stockItem: true, location: true, sourceLocation: true, destinationLocation: true, vendor: true, sourceReceiptLine: { select: { id: true, document: { select: { id: true, documentNumber: true, documentDate: true, status: true } } } } }, orderBy: { postedAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }), prisma.inventoryMovement.count({ where })]);
  return { movements: movements.map((movement) => ({ ...movement, sourceReceiptDocumentNumber: movement.sourceReceiptLine?.document.documentNumber ?? null, quantityIn: decimalString(movement.quantityIn), quantityOut: decimalString(movement.quantityOut), quantityBefore: decimalString(movement.quantityBefore), quantityAfter: decimalString(movement.quantityAfter), unitCost: mapCost(movement.unitCost, actor), amountIn: mapCost(movement.amountIn, actor), amountOut: mapCost(movement.amountOut, actor), valueBefore: mapCost(movement.valueBefore, actor), valueAfter: mapCost(movement.valueAfter, actor), movingAverageCostBefore: mapCost(movement.movingAverageCostBefore, actor), movingAverageCostAfter: mapCost(movement.movingAverageCostAfter, actor) })), total, page: query.page, pageSize: query.pageSize, pages: Math.max(1, Math.ceil(total / query.pageSize)) };
}

export async function stockCard(query: z.infer<typeof inventoryReportQuerySchema>, actor: Actor) {
  requireInventoryPermission(actor, "INVENTORY_REPORT_VIEW");
  if (!query.stockItemId || !query.locationId) throw new HttpError(400, "Stock Card requires Stock Item and Location filters", "STOCK_CARD_FILTER_REQUIRED");
  const from = query.from ? new Date(query.from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1); const to = query.to ? new Date(query.to) : new Date();
  const where = { stockItemId: query.stockItemId, locationId: query.locationId, postedAt: { lte: to } } satisfies Prisma.InventoryMovementWhereInput;
  const movements = await prisma.inventoryMovement.findMany({ where, include: { stockItem: true, location: true, sourceReceiptLine: { select: { id: true, document: { select: { id: true, documentNumber: true, documentDate: true, status: true } } } } }, orderBy: { postedAt: "asc" } });
  const openingMovements = movements.filter((movement) => movement.postedAt < from); const periodMovements = movements.filter((movement) => movement.postedAt >= from && movement.postedAt <= to);
  const openingQuantity = openingMovements.at(-1)?.quantityAfter ?? D(0); const openingValue = openingMovements.reduce((sum, movement) => sum.plus(movement.amountIn).minus(movement.amountOut), D(0)); let runningQuantity = D(openingQuantity); let runningValue = D(openingValue); const rows = periodMovements.map((movement) => { runningQuantity = runningQuantity.plus(movement.quantityIn).minus(movement.quantityOut); runningValue = runningValue.plus(movement.amountIn).minus(movement.amountOut); return { ...movement, sourceReceiptDocumentNumber: movement.sourceReceiptLine?.document.documentNumber ?? null, runningQuantity: decimalString(runningQuantity), runningValue: mapCost(runningValue, actor), quantityIn: decimalString(movement.quantityIn), quantityOut: decimalString(movement.quantityOut), amountIn: mapCost(movement.amountIn, actor), amountOut: mapCost(movement.amountOut, actor), unitCost: mapCost(movement.unitCost, actor) }; });
  return { openingQuantity: decimalString(openingQuantity), openingValue: mapCost(openingValue, actor), closingQuantity: decimalString(runningQuantity), closingValue: mapCost(runningValue, actor), rows, from, to, stockItem: movements[0]?.stockItem ?? null, location: movements[0]?.location ?? null };
}

export async function inventoryDashboard(actor: Actor) {
  requireInventoryPermission(actor, "VIEW_INVENTORY");
  const [activeItems, locations, vendors, balanceAggregate, pendingApprovals, pendingCounts, items] = await Promise.all([
    prisma.stockItem.count({ where: { active: true } }), prisma.inventoryLocation.count({ where: { active: true } }), prisma.vendor.count({ where: { active: true } }), prisma.inventoryBalance.aggregate({ _sum: { quantityOnHand: true } }), prisma.inventoryApproval.count({ where: { status: { in: ["PENDING", "IN_REVIEW"] }, assignedRole: { in: ["MAINTENANCE_MANAGER", "WAREHOUSE_MANAGER", "PLANT_MANAGER"] } } }), prisma.stockCount.count({ where: { status: "PENDING_PLANT_MANAGER" } }), prisma.stockItem.findMany({ where: { active: true }, include: { balances: true }, orderBy: { code: "asc" } }),
  ]);
  const lowStock = items.map((item) => ({ item, quantity: item.balances.reduce((sum, balance) => sum.plus(balance.quantityOnHand), D(0)) })).filter(({ item, quantity }) => item.reorderPoint && quantity.lte(item.reorderPoint)).slice(0, 10).map(({ item, quantity }) => ({ id: item.id, code: item.code, name: item.name, quantityOnHand: decimalString(quantity), reorderPoint: decimalString(item.reorderPoint!) }));
  const balances = await prisma.inventoryBalance.findMany({ select: { quantityOnHand: true, movingAverageCost: true } }); const value = balances.reduce((sum, balance) => sum.plus(D(balance.quantityOnHand).times(balance.movingAverageCost)), D(0));
  return { metrics: { activeItems, locations, vendors, pendingApprovals, pendingCounts, inventoryValue: mapCost(value, actor), quantityOnHand: decimalString(balanceAggregate._sum.quantityOnHand) }, lowStock };
}

export async function getInventoryConfiguration(actor: Actor) {
  requireInventoryPermission(actor, "VIEW_INVENTORY");
  return { settings: await prisma.inventorySetting.findMany({ orderBy: { settingKey: "asc" } }), sequences: await prisma.inventoryDocumentSequence.findMany({ orderBy: { sequenceKey: "asc" } }) };
}

export async function updateInventorySetting(input: z.infer<typeof inventorySettingMutationSchema>, actor: Actor, meta: RequestMeta) {
  requireInventoryPermission(actor, "INVENTORY_CONFIG_MANAGE");
  return prisma.$transaction(async (tx) => {
    const existing = await tx.inventorySetting.findUnique({ where: { settingKey: input.settingKey } });
    const setting = await tx.inventorySetting.upsert({ where: { settingKey: input.settingKey }, create: { id: randomUUID(), settingKey: input.settingKey, value: input.value, description: optionalString(input.description), updatedBy: actor.id }, update: { value: input.value, description: optionalString(input.description), updatedBy: actor.id } });
    await writeAudit(tx, { action: "INVENTORY_CONFIGURATION_UPDATED", category: "INVENTORY", targetType: "INVENTORY_SETTING", targetId: setting.id, targetName: setting.settingKey, description: `Updated inventory setting ${setting.settingKey}`, previousValues: existing, newValues: setting }, actor, meta);
    return setting;
  });
}

export async function linkInventoryAttachment(documentId: string, attachmentId: string, actor: Actor, meta: RequestMeta) {
  requireInventoryPermission(actor, "VIEW_INVENTORY");
  return prisma.$transaction(async (tx) => {
    const document = await tx.inventoryDocument.findUnique({ where: { id: documentId } });
    if (!document || !documentCanRead(actor, document)) throw new HttpError(404, "Inventory document not found", "INVENTORY_DOCUMENT_NOT_FOUND");
    const attachment = await tx.attachment.findFirst({ where: { id: attachmentId, entityType: "INVENTORY_DOCUMENT", entityId: documentId, deletedAt: null } });
    if (!attachment) throw new HttpError(400, "Attachment is not registered for this document", "ATTACHMENT_NOT_LINKED");
    const link = await tx.inventoryDocumentAttachment.upsert({ where: { documentId_attachmentId: { documentId, attachmentId } }, create: { id: randomUUID(), documentId, attachmentId }, update: {} });
    await writeAudit(tx, { action: "INVENTORY_ATTACHMENT_LINKED", category: "INVENTORY", targetType: "INVENTORY_DOCUMENT", targetId: documentId, targetName: attachment.originalName, description: `Linked attachment to ${document.documentNumber}`, newValues: { attachmentId } }, actor, meta);
    return link;
  });
}

export const schemas = { inventoryDocumentLineSchema, inventoryDocumentMutationSchema, inventoryListQuerySchema, inventoryLocationMutationSchema, inventoryReceiptSourceQuerySchema, inventoryReportQuerySchema, inventorySettingMutationSchema, stockCountActionSchema, stockCountMutationSchema, stockCountUpdateSchema, stockItemMutationSchema, vendorContactMutationSchema, vendorMutationSchema, vendorRatingMutationSchema };
