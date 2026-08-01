import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import {
  assetCategories, assetCustomFieldDefinitions, assetCustomFieldGroups, assetCustomFieldValues,
  assetDocumentMetadata, assetHierarchyLinks, assets, assetSpareParts, assetTypes, attachments,
  auditLogs, contracts, spareParts, users, workOrders,
} from "@/lib/db/schema";
import { HttpError } from "@/lib/http";
import { auditData } from "@/lib/audit/service";
import type { AuthenticatedUser } from "@/lib/auth/session";
import type { RequestMeta } from "@/lib/auth/request";
import { createNotification } from "@/lib/notifications/service";
import { logger } from "@/lib/logger";
import type { z } from "zod";
import type { assetHierarchyLinkSchema, assetListQuerySchema, assetMutationSchema, assetSparePartLinkSchema } from "./validation";
import { assertNoHierarchyCycle } from "./validation";

type AssetFilters = z.infer<typeof assetListQuerySchema>;
type AssetMutation = z.infer<typeof assetMutationSchema>;
type HierarchyLinkMutation = z.infer<typeof assetHierarchyLinkSchema>;
type SparePartLinkMutation = z.infer<typeof assetSparePartLinkSchema>;

const assetSelection = {
  id: assets.id, code: assets.code, name: assets.name, description: assets.description,
  parentAssetId: assets.parentAssetId, structureLevel: assets.structureLevel, location: assets.location,
  criticality: assets.criticality, status: assets.status, assetTypeId: assets.assetTypeId,
  assetCategoryId: assets.assetCategoryId, typeCode: assetTypes.code, typeName: assetTypes.name,
  categoryCode: assetCategories.code, categoryName: assetCategories.name, primaryImagePath: assets.primaryImagePath,
  serialNumber: assets.serialNumber, inventoryLocationName: assets.inventoryLocationName,
};

function contains(value: unknown, query: string) { return String(value ?? "").toLocaleLowerCase().includes(query); }

export async function listAssets(filters: AssetFilters) {
  const [rows, customRows, types, categories, parts] = await Promise.all([
    db.select(assetSelection).from(assets).innerJoin(assetTypes, eq(assets.assetTypeId, assetTypes.id)).leftJoin(assetCategories, eq(assets.assetCategoryId, assetCategories.id)).orderBy(asc(assets.code)),
    filters.q ? db.select({ assetId: assetCustomFieldValues.assetId, value: assetCustomFieldValues.value }).from(assetCustomFieldValues) : Promise.resolve([]),
    db.select({ id: assetTypes.id, code: assetTypes.code, name: assetTypes.name }).from(assetTypes).where(eq(assetTypes.active, true)).orderBy(asc(assetTypes.name)),
    db.select({ id: assetCategories.id, code: assetCategories.code, name: assetCategories.name }).from(assetCategories).where(eq(assetCategories.active, true)).orderBy(asc(assetCategories.name)),
    db.select({ id: spareParts.id, code: spareParts.code, name: spareParts.name, unit: spareParts.unit, availableQuantity: spareParts.availableQuantity }).from(spareParts).orderBy(asc(spareParts.code)),
  ]);
  const q = filters.q.toLocaleLowerCase();
  const customMatches = new Set(customRows.filter((row) => contains(row.value, q)).map((row) => row.assetId));
  const resultIds = rows.filter((row) =>
    (!filters.status || row.status === filters.status) && (!filters.type || row.assetTypeId === filters.type) &&
    (!filters.category || row.assetCategoryId === filters.category) && (!filters.level || row.structureLevel === filters.level) &&
    (!filters.parentId || row.parentAssetId === filters.parentId) &&
    (!q || [row.code, row.name, row.description, row.serialNumber, row.location, row.inventoryLocationName].some((value) => contains(value, q)) || customMatches.has(row.id))
  ).map((row) => row.id);

  const visibleIds = new Set(resultIds);
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const resultId of resultIds) {
    let cursor = byId.get(resultId)?.parentAssetId;
    const visited = new Set<string>();
    while (cursor && !visited.has(cursor)) { visited.add(cursor); visibleIds.add(cursor); cursor = byId.get(cursor)?.parentAssetId; }
  }
  return { assets: rows, resultIds, visibleIds: [...visibleIds], assetTypes: types, assetCategories: categories, spareParts: parts };
}

export async function getAssetDetail(id: string) {
  const asset = (await db.select({
    ...assetSelection,
    ownerUserId: assets.ownerUserId, contractId: assets.contractId, unit: assets.unit,
    maintenanceInterval: assets.maintenanceInterval, runningHourCode: assets.runningHourCode,
    budgetId: assets.budgetId, gpsCoordinates: assets.gpsCoordinates,
    costCenterLegacyId: assets.costCenterLegacyId, budgetReferenceLegacyId: assets.budgetReferenceLegacyId,
    inventoryLocationLegacyId: assets.inventoryLocationLegacyId, legacySourceId: assets.legacySourceId,
    createdAt: assets.createdAt, updatedAt: assets.updatedAt, createdBy: assets.createdBy, updatedBy: assets.updatedBy,
  }).from(assets).innerJoin(assetTypes, eq(assets.assetTypeId, assetTypes.id)).leftJoin(assetCategories, eq(assets.assetCategoryId, assetCategories.id)).where(eq(assets.id, id)).limit(1))[0];
  if (!asset) throw new HttpError(404, "Asset not found", "ASSET_NOT_FOUND");

  const [people, parent, children, hierarchyLinks, partRows, customRows, documentRows, history, orders, contract] = await Promise.all([
    db.select({ id: users.id, name: users.fullName }).from(users).where(inArray(users.id, [asset.ownerUserId, asset.createdBy, asset.updatedBy].filter(Boolean) as string[])),
    asset.parentAssetId ? db.select(assetSelection).from(assets).innerJoin(assetTypes, eq(assets.assetTypeId, assetTypes.id)).leftJoin(assetCategories, eq(assets.assetCategoryId, assetCategories.id)).where(eq(assets.id, asset.parentAssetId)).limit(1) : Promise.resolve([]),
    db.select(assetSelection).from(assets).innerJoin(assetTypes, eq(assets.assetTypeId, assetTypes.id)).leftJoin(assetCategories, eq(assets.assetCategoryId, assetCategories.id)).where(eq(assets.parentAssetId, id)).orderBy(asc(assets.code)),
    db.select().from(assetHierarchyLinks).where(eq(assetHierarchyLinks.parentAssetId, id)).orderBy(asc(assetHierarchyLinks.sequence)),
    db.select({ id: assetSpareParts.id, sparePartId: assetSpareParts.sparePartId, sequence: assetSpareParts.sequence, enabled: assetSpareParts.enabled, requiredQuantity: assetSpareParts.requiredQuantity, note: assetSpareParts.note, code: spareParts.code, name: spareParts.name, description: spareParts.description, unit: spareParts.unit, availableQuantity: spareParts.availableQuantity }).from(assetSpareParts).innerJoin(spareParts, eq(assetSpareParts.sparePartId, spareParts.id)).where(eq(assetSpareParts.assetId, id)).orderBy(asc(assetSpareParts.sequence)),
    db.select({ id: assetCustomFieldValues.id, value: assetCustomFieldValues.value, definitionId: assetCustomFieldDefinitions.id, name: assetCustomFieldDefinitions.name, label: assetCustomFieldDefinitions.label, description: assetCustomFieldDefinitions.description, fieldType: assetCustomFieldDefinitions.fieldType, unit: assetCustomFieldDefinitions.unit, defaultValue: assetCustomFieldDefinitions.defaultValue, availableValues: assetCustomFieldDefinitions.availableValues, sortOrder: assetCustomFieldDefinitions.sortOrder, groupId: assetCustomFieldGroups.id, groupName: assetCustomFieldGroups.name, groupSortOrder: assetCustomFieldGroups.sortOrder }).from(assetCustomFieldDefinitions).innerJoin(assetCustomFieldGroups, eq(assetCustomFieldDefinitions.groupId, assetCustomFieldGroups.id)).leftJoin(assetCustomFieldValues, and(eq(assetCustomFieldValues.definitionId, assetCustomFieldDefinitions.id), eq(assetCustomFieldValues.assetId, id))).where(asset.assetCategoryId ? or(isNull(assetCustomFieldDefinitions.assetCategoryId), eq(assetCustomFieldDefinitions.assetCategoryId, asset.assetCategoryId)) : isNull(assetCustomFieldDefinitions.assetCategoryId)).orderBy(asc(assetCustomFieldGroups.sortOrder), asc(assetCustomFieldDefinitions.sortOrder)),
    db.select({ id: attachments.id, originalName: attachments.originalName, contentType: attachments.contentType, byteSize: attachments.byteSize, storageKey: attachments.storageKey, driver: attachments.driver, createdAt: attachments.createdAt, note: assetDocumentMetadata.note }).from(attachments).leftJoin(assetDocumentMetadata, eq(attachments.id, assetDocumentMetadata.attachmentId)).where(and(eq(attachments.entityType, "ASSET"), eq(attachments.entityId, id), isNull(attachments.deletedAt))).orderBy(desc(attachments.createdAt)),
    db.select({ id: auditLogs.id, action: auditLogs.action, description: auditLogs.description, actorName: auditLogs.actorName, result: auditLogs.result, previousValues: auditLogs.previousValues, newValues: auditLogs.newValues, createdAt: auditLogs.createdAt }).from(auditLogs).where(and(eq(auditLogs.targetType, "ASSET"), eq(auditLogs.targetId, id))).orderBy(desc(auditLogs.createdAt)),
    db.select({ id: workOrders.id, code: workOrders.code, title: workOrders.title, description: workOrders.description, priority: workOrders.priority, status: workOrders.status, assignedTo: workOrders.assignedTo, dueAt: workOrders.dueAt, updatedAt: workOrders.updatedAt }).from(workOrders).where(eq(workOrders.assetId, id)).orderBy(desc(workOrders.updatedAt)),
    asset.contractId ? db.select().from(contracts).where(eq(contracts.id, asset.contractId)).limit(1) : Promise.resolve([]),
  ]);

  const hierarchyAssetIds = hierarchyLinks.map((link) => link.assetId);
  const hierarchyAssets = hierarchyAssetIds.length ? await db.select(assetSelection).from(assets).innerJoin(assetTypes, eq(assets.assetTypeId, assetTypes.id)).leftJoin(assetCategories, eq(assets.assetCategoryId, assetCategories.id)).where(inArray(assets.id, hierarchyAssetIds)) : [];
  const names = new Map(people.map((person) => [person.id, person.name]));
  const assigneeIds = orders.map((order) => order.assignedTo).filter(Boolean) as string[];
  const assignees = assigneeIds.length ? await db.select({ id: users.id, name: users.fullName }).from(users).where(inArray(users.id, assigneeIds)) : [];
  const assigneeNames = new Map(assignees.map((person) => [person.id, person.name]));

  return {
    asset: { ...asset, ownerName: asset.ownerUserId ? names.get(asset.ownerUserId) ?? null : null, createdByName: names.get(asset.createdBy) ?? null, updatedByName: names.get(asset.updatedBy) ?? null },
    parent: parent[0] ?? null, children,
    hierarchyLinks: hierarchyLinks.map((link) => ({ ...link, asset: hierarchyAssets.find((item) => item.id === link.assetId) ?? null })),
    spareParts: partRows, customFields: customRows, documents: documentRows.map((document) => ({ ...document, contentUrl: document.driver === "LOCAL" ? `/api/attachments/${document.id}/content` : document.storageKey })), history,
    workOrders: orders.map((order) => ({ ...order, assignedToName: order.assignedTo ? assigneeNames.get(order.assignedTo) ?? null : null })),
    contract: contract[0] ?? null,
  };
}

export async function getAssetFormReferences() {
  const [types, categories, assets, users, contracts, groups, definitions, parts] = await Promise.all([
    prisma.assetType.findMany({ where: { active: true }, select: { id: true, code: true, name: true }, orderBy: { name: "asc" } }),
    prisma.assetCategory.findMany({ where: { active: true }, select: { id: true, code: true, name: true }, orderBy: { name: "asc" } }),
    prisma.asset.findMany({ select: { id: true, code: true, name: true, parentAssetId: true, structureLevel: true, status: true }, orderBy: { code: "asc" } }),
    prisma.user.findMany({ where: { status: "ACTIVE" }, select: { id: true, fullName: true }, orderBy: { fullName: "asc" } }),
    prisma.contract.findMany({ select: { id: true, code: true, name: true }, orderBy: { code: "asc" } }),
    prisma.assetCustomFieldGroup.findMany({ select: { id: true, name: true, sortOrder: true }, orderBy: { sortOrder: "asc" } }),
    prisma.assetCustomFieldDefinition.findMany({ select: { id: true, assetCategoryId: true, groupId: true, name: true, label: true, description: true, fieldType: true, placeholder: true, defaultValue: true, availableValues: true, unit: true, sortOrder: true, active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.sparePart.findMany({ select: { id: true, code: true, name: true, unit: true, availableQuantity: true }, orderBy: { code: "asc" } }),
  ]);
  const groupNames = new Map(groups.map((group) => [group.id, group.name]));
  return { types, categories, assets, users, contracts, spareParts: parts, customFields: definitions.map((definition) => ({ ...definition, groupName: groupNames.get(definition.groupId) ?? "Additional information" })) };
}

export async function createAssetHierarchyLink(parentAssetId: string, input: HierarchyLinkMutation, actor: AuthenticatedUser, meta: RequestMeta) {
  if (parentAssetId === input.assetId) throw new HttpError(400, "An asset cannot link to itself", "INVALID_ASSET_HIERARCHY_LINK");
  return prisma.$transaction(async (tx) => {
    const [parent, child, duplicate] = await Promise.all([
      tx.asset.findUnique({ where: { id: parentAssetId }, select: { code: true } }),
      tx.asset.findUnique({ where: { id: input.assetId }, select: { code: true } }),
      tx.assetHierarchyLink.findFirst({ where: { parentAssetId, assetId: input.assetId } }),
    ]);
    if (!parent || !child) throw new HttpError(404, "Asset not found", "ASSET_NOT_FOUND");
    if (duplicate) throw new HttpError(409, "This asset BOM link already exists", "ASSET_HIERARCHY_LINK_EXISTS");
    const link = await tx.assetHierarchyLink.create({ data: { id: randomUUID(), parentAssetId, rootAssetId: parentAssetId, assetId: input.assetId, sequence: input.sequence, enabled: input.enabled, quantity: String(input.quantity), note: emptyToNull(input.note) } });
    await tx.auditLog.create({ data: auditData({ action: "ASSET_HIERARCHY_LINK_CREATED", category: "ASSETS", targetType: "ASSET", targetId: parentAssetId, targetName: parent.code, description: `Linked asset ${child.code}`, newValues: input }, actor, meta) });
    return link;
  });
}

export async function updateAssetHierarchyLink(parentAssetId: string, linkId: string, input: HierarchyLinkMutation, actor: AuthenticatedUser, meta: RequestMeta) {
  if (parentAssetId === input.assetId) throw new HttpError(400, "An asset cannot link to itself", "INVALID_ASSET_HIERARCHY_LINK");
  return prisma.$transaction(async (tx) => {
    const existing = await tx.assetHierarchyLink.findFirst({ where: { id: linkId, parentAssetId } });
    if (!existing) throw new HttpError(404, "Asset BOM link not found", "ASSET_HIERARCHY_LINK_NOT_FOUND");
    const child = await tx.asset.findUnique({ where: { id: input.assetId }, select: { id: true } });
    if (!child) throw new HttpError(404, "Linked asset not found", "ASSET_NOT_FOUND");
    const duplicate = await tx.assetHierarchyLink.findFirst({ where: { parentAssetId, assetId: input.assetId, id: { not: linkId } } });
    if (duplicate) throw new HttpError(409, "This asset BOM link already exists", "ASSET_HIERARCHY_LINK_EXISTS");
    const link = await tx.assetHierarchyLink.update({ where: { id: linkId }, data: { assetId: input.assetId, sequence: input.sequence, enabled: input.enabled, quantity: String(input.quantity), note: emptyToNull(input.note) } });
    await tx.auditLog.create({ data: auditData({ action: "ASSET_HIERARCHY_LINK_UPDATED", category: "ASSETS", targetType: "ASSET", targetId: parentAssetId, description: "Updated asset BOM link", previousValues: existing, newValues: input }, actor, meta) });
    return link;
  });
}

export async function deleteAssetHierarchyLink(parentAssetId: string, linkId: string, actor: AuthenticatedUser, meta: RequestMeta) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.assetHierarchyLink.findFirst({ where: { id: linkId, parentAssetId } });
    if (!existing) throw new HttpError(404, "Asset BOM link not found", "ASSET_HIERARCHY_LINK_NOT_FOUND");
    await tx.assetHierarchyLink.delete({ where: { id: linkId } });
    await tx.auditLog.create({ data: auditData({ action: "ASSET_HIERARCHY_LINK_DELETED", category: "ASSETS", targetType: "ASSET", targetId: parentAssetId, description: "Removed asset BOM link", previousValues: existing }, actor, meta) });
    return { id: linkId };
  });
}

export async function createAssetSparePartLink(assetId: string, input: SparePartLinkMutation, actor: AuthenticatedUser, meta: RequestMeta) {
  return prisma.$transaction(async (tx) => {
    const [asset, part, duplicate] = await Promise.all([tx.asset.findUnique({ where: { id: assetId }, select: { code: true } }), tx.sparePart.findUnique({ where: { id: input.sparePartId }, select: { code: true } }), tx.assetSparePart.findFirst({ where: { assetId, sparePartId: input.sparePartId } })]);
    if (!asset || !part) throw new HttpError(404, "Asset or spare part not found", "ASSET_SPARE_PART_REFERENCE_NOT_FOUND");
    if (duplicate) throw new HttpError(409, "This spare part is already linked", "ASSET_SPARE_PART_EXISTS");
    const link = await tx.assetSparePart.create({ data: { id: randomUUID(), assetId, sparePartId: input.sparePartId, sequence: input.sequence, enabled: input.enabled, requiredQuantity: String(input.requiredQuantity), note: emptyToNull(input.note) } });
    await tx.auditLog.create({ data: auditData({ action: "ASSET_SPARE_PART_CREATED", category: "ASSETS", targetType: "ASSET", targetId: assetId, targetName: asset.code, description: `Linked spare part ${part.code}`, newValues: input }, actor, meta) });
    return link;
  });
}

export async function updateAssetSparePartLink(assetId: string, linkId: string, input: SparePartLinkMutation, actor: AuthenticatedUser, meta: RequestMeta) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.assetSparePart.findFirst({ where: { id: linkId, assetId } });
    if (!existing) throw new HttpError(404, "Spare-part link not found", "ASSET_SPARE_PART_NOT_FOUND");
    const part = await tx.sparePart.findUnique({ where: { id: input.sparePartId }, select: { id: true } });
    if (!part) throw new HttpError(404, "Spare part not found", "SPARE_PART_NOT_FOUND");
    const duplicate = await tx.assetSparePart.findFirst({ where: { assetId, sparePartId: input.sparePartId, id: { not: linkId } } });
    if (duplicate) throw new HttpError(409, "This spare part is already linked", "ASSET_SPARE_PART_EXISTS");
    const link = await tx.assetSparePart.update({ where: { id: linkId }, data: { sparePartId: input.sparePartId, sequence: input.sequence, enabled: input.enabled, requiredQuantity: String(input.requiredQuantity), note: emptyToNull(input.note) } });
    await tx.auditLog.create({ data: auditData({ action: "ASSET_SPARE_PART_UPDATED", category: "ASSETS", targetType: "ASSET", targetId: assetId, description: "Updated spare-part link", previousValues: existing, newValues: input }, actor, meta) });
    return link;
  });
}

export async function deleteAssetSparePartLink(assetId: string, linkId: string, actor: AuthenticatedUser, meta: RequestMeta) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.assetSparePart.findFirst({ where: { id: linkId, assetId } });
    if (!existing) throw new HttpError(404, "Spare-part link not found", "ASSET_SPARE_PART_NOT_FOUND");
    await tx.assetSparePart.delete({ where: { id: linkId } });
    await tx.auditLog.create({ data: auditData({ action: "ASSET_SPARE_PART_DELETED", category: "ASSETS", targetType: "ASSET", targetId: assetId, description: "Removed spare-part link", previousValues: existing }, actor, meta) });
    return { id: linkId };
  });
}

const emptyToNull = (value?: string | null) => value?.trim() ? value.trim() : null;
function persistenceData(input: AssetMutation) {
  const { customFields, ...fields } = input; void customFields;
  return {
    ...fields,
    description: emptyToNull(fields.description), assetCategoryId: fields.assetCategoryId ?? null, parentAssetId: fields.parentAssetId ?? null,
    ownerUserId: fields.ownerUserId ?? null, contractId: fields.contractId ?? null, primaryImagePath: emptyToNull(fields.primaryImagePath),
    unit: emptyToNull(fields.unit), serialNumber: emptyToNull(fields.serialNumber), runningHourCode: emptyToNull(fields.runningHourCode),
    budgetId: emptyToNull(fields.budgetId), gpsCoordinates: emptyToNull(fields.gpsCoordinates), inventoryLocationName: emptyToNull(fields.inventoryLocationName),
  };
}

async function validateAssetReferences(tx: Prisma.TransactionClient, input: AssetMutation, currentId?: string) {
  const [type, category, parent, owner, contract, hierarchy] = await Promise.all([
    tx.assetType.findUnique({ where: { id: input.assetTypeId }, select: { id: true } }),
    input.assetCategoryId ? tx.assetCategory.findUnique({ where: { id: input.assetCategoryId }, select: { id: true } }) : null,
    input.parentAssetId ? tx.asset.findUnique({ where: { id: input.parentAssetId }, select: { id: true } }) : null,
    input.ownerUserId ? tx.user.findUnique({ where: { id: input.ownerUserId }, select: { id: true, status: true } }) : null,
    input.contractId ? tx.contract.findUnique({ where: { id: input.contractId }, select: { id: true } }) : null,
    tx.asset.findMany({ select: { id: true, parentAssetId: true } }),
  ]);
  if (!type) throw new HttpError(400, "Asset type does not exist", "INVALID_ASSET_TYPE");
  if (input.assetCategoryId && !category) throw new HttpError(400, "Asset category does not exist", "INVALID_ASSET_CATEGORY");
  if (input.parentAssetId && !parent) throw new HttpError(400, "Parent asset does not exist", "INVALID_PARENT_ASSET");
  if (input.ownerUserId && (!owner || owner.status !== "ACTIVE")) throw new HttpError(400, "Assigned owner must be an active user", "INVALID_ASSET_OWNER");
  if (input.contractId && !contract) throw new HttpError(400, "Contract does not exist", "INVALID_ASSET_CONTRACT");
  if (currentId) assertNoHierarchyCycle(currentId, input.parentAssetId ?? null, new Map(hierarchy.map((item) => [item.id, item.parentAssetId])));
}

function allowedOptions(value?: string | null) {
  if (!value) return [];
  try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed.map(String); } catch { /* legacy values can be comma-delimited */ }
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

async function customValueRows(tx: Prisma.TransactionClient, assetId: string, input: AssetMutation) {
  const submitted = Object.entries(input.customFields).filter(([, value]) => value.trim());
  if (!submitted.length) return [];
  const definitions = await tx.assetCustomFieldDefinition.findMany({ where: { id: { in: submitted.map(([id]) => id) } } });
  const byId = new Map(definitions.map((definition) => [definition.id, definition]));
  return submitted.map(([definitionId, rawValue]) => {
    const definition = byId.get(definitionId); const value = rawValue.trim();
    if (!definition || (definition.assetCategoryId && definition.assetCategoryId !== input.assetCategoryId)) throw new HttpError(400, "Custom field does not apply to the selected category", "INVALID_ASSET_CUSTOM_FIELD");
    if (definition.fieldType === "NUMBER" && !Number.isFinite(Number(value))) throw new HttpError(400, `${definition.label} must be numeric`, "INVALID_ASSET_CUSTOM_VALUE");
    if (definition.fieldType === "DATE" && Number.isNaN(Date.parse(value))) throw new HttpError(400, `${definition.label} must be a valid date`, "INVALID_ASSET_CUSTOM_VALUE");
    const options = definition.fieldType === "ARRAY" ? allowedOptions(definition.availableValues) : [];
    if (options.length && !options.includes(value)) throw new HttpError(400, `${definition.label} must use an available option`, "INVALID_ASSET_CUSTOM_VALUE");
    return { id: randomUUID(), assetId, definitionId, value };
  });
}

export async function createAssetRecord(input: AssetMutation, actor: AuthenticatedUser, meta: RequestMeta) {
  const id = randomUUID(); const now = new Date();
  await prisma.$transaction(async (tx) => {
    await validateAssetReferences(tx, input);
    const values = await customValueRows(tx, id, input);
    await tx.asset.create({ data: { id, ...persistenceData(input), createdAt: now, updatedAt: now, createdBy: actor.id, updatedBy: actor.id } });
    if (values.length) await tx.assetCustomFieldValue.createMany({ data: values });
    await tx.auditLog.create({ data: auditData({ action: "ASSET_CREATED", category: "ASSETS", targetType: "ASSET", targetId: id, targetName: input.code, description: `Created asset ${input.code}`, newValues: input }, actor, meta) });
  });
  if (input.ownerUserId) await notifyAssetOwner(id, input.code, input.name, input.ownerUserId, actor, meta);
  return { id, code: input.code };
}

export async function updateAssetRecord(id: string, input: AssetMutation, actor: AuthenticatedUser, meta: RequestMeta) {
  const now = new Date();
  const previous = await prisma.$transaction(async (tx) => {
    const existing = await tx.asset.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Asset not found", "ASSET_NOT_FOUND");
    if (existing.parentAssetId !== input.parentAssetId && !actor.permissions.includes("ASSET_HIERARCHY_MANAGE")) throw new HttpError(403, "Asset hierarchy permission is required to change the parent", "ASSET_HIERARCHY_FORBIDDEN");
    if (Object.keys(input.customFields).length && !actor.permissions.includes("ASSET_CUSTOM_FIELDS_MANAGE")) throw new HttpError(403, "Custom-field permission is required", "ASSET_CUSTOM_FIELDS_FORBIDDEN");
    await validateAssetReferences(tx, input, id);
    const values = await customValueRows(tx, id, input);
    await tx.asset.update({ where: { id }, data: { ...persistenceData(input), updatedAt: now, updatedBy: actor.id } });
    await tx.assetCustomFieldValue.deleteMany({ where: { assetId: id } });
    if (values.length) await tx.assetCustomFieldValue.createMany({ data: values });
    await tx.auditLog.create({ data: auditData({ action: "ASSET_UPDATED", category: "ASSETS", targetType: "ASSET", targetId: id, targetName: input.code, description: `Updated asset ${input.code}`, previousValues: existing, newValues: input }, actor, meta) });
    return existing;
  });
  if (input.ownerUserId && input.ownerUserId !== previous.ownerUserId) await notifyAssetOwner(id, input.code, input.name, input.ownerUserId, actor, meta);
  return { id, code: input.code };
}

export async function archiveAssetRecord(id: string, reason: string, actor: AuthenticatedUser, meta: RequestMeta) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.asset.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Asset not found", "ASSET_NOT_FOUND");
    if (existing.status === "RETIRED") return { id, status: "RETIRED" as const };
    const children = await tx.asset.count({ where: { parentAssetId: id, status: { not: "RETIRED" } } });
    if (children) throw new HttpError(409, "Archive active child assets first or move them to another parent", "ASSET_HAS_ACTIVE_CHILDREN");
    await tx.asset.update({ where: { id }, data: { status: "RETIRED", updatedAt: new Date(), updatedBy: actor.id } });
    await tx.auditLog.create({ data: auditData({ action: "ASSET_ARCHIVED", category: "ASSETS", targetType: "ASSET", targetId: id, targetName: existing.code, description: reason, previousValues: { status: existing.status }, newValues: { status: "RETIRED", reason } }, actor, meta) });
    return { id, status: "RETIRED" as const };
  });
}

async function notifyAssetOwner(id: string, code: string, name: string, ownerUserId: string, actor: AuthenticatedUser, meta: RequestMeta) {
  try { await createNotification({ type: "ASSET_ASSIGNED", title: `Asset ${code} assigned to you`, message: name, actionUrl: `/assets/${id}`, sourceType: "ASSET", sourceId: id, recipientIds: [ownerUserId] }, actor, meta); }
  catch (error) { logger.error("Asset assignment notification failed", { id, error: error instanceof Error ? error.message : "Unknown error" }); }
}
