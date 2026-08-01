import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  assetCategories, assetCustomFieldDefinitions, assetCustomFieldGroups, assetCustomFieldValues,
  assetDocumentMetadata, assetHierarchyLinks, assets, assetSpareParts, assetTypes, attachments,
  auditLogs, contracts, spareParts, users, workOrders,
} from "@/lib/db/schema";
import { HttpError } from "@/lib/http";
import type { z } from "zod";
import type { assetListQuerySchema } from "./validation";

type AssetFilters = z.infer<typeof assetListQuerySchema>;

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
  const [rows, customRows, types, categories] = await Promise.all([
    db.select(assetSelection).from(assets).innerJoin(assetTypes, eq(assets.assetTypeId, assetTypes.id)).leftJoin(assetCategories, eq(assets.assetCategoryId, assetCategories.id)).orderBy(asc(assets.code)),
    filters.q ? db.select({ assetId: assetCustomFieldValues.assetId, value: assetCustomFieldValues.value }).from(assetCustomFieldValues) : Promise.resolve([]),
    db.select({ id: assetTypes.id, code: assetTypes.code, name: assetTypes.name }).from(assetTypes).where(eq(assetTypes.active, true)).orderBy(asc(assetTypes.name)),
    db.select({ id: assetCategories.id, code: assetCategories.code, name: assetCategories.name }).from(assetCategories).where(eq(assetCategories.active, true)).orderBy(asc(assetCategories.name)),
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
  return { assets: rows, resultIds, visibleIds: [...visibleIds], assetTypes: types, assetCategories: categories };
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
    db.select({ id: assetSpareParts.id, sequence: assetSpareParts.sequence, enabled: assetSpareParts.enabled, requiredQuantity: assetSpareParts.requiredQuantity, note: assetSpareParts.note, code: spareParts.code, name: spareParts.name, description: spareParts.description, unit: spareParts.unit, availableQuantity: spareParts.availableQuantity }).from(assetSpareParts).innerJoin(spareParts, eq(assetSpareParts.sparePartId, spareParts.id)).where(eq(assetSpareParts.assetId, id)).orderBy(asc(assetSpareParts.sequence)),
    db.select({ id: assetCustomFieldValues.id, value: assetCustomFieldValues.value, definitionId: assetCustomFieldDefinitions.id, name: assetCustomFieldDefinitions.name, label: assetCustomFieldDefinitions.label, description: assetCustomFieldDefinitions.description, fieldType: assetCustomFieldDefinitions.fieldType, unit: assetCustomFieldDefinitions.unit, defaultValue: assetCustomFieldDefinitions.defaultValue, availableValues: assetCustomFieldDefinitions.availableValues, sortOrder: assetCustomFieldDefinitions.sortOrder, groupId: assetCustomFieldGroups.id, groupName: assetCustomFieldGroups.name, groupSortOrder: assetCustomFieldGroups.sortOrder }).from(assetCustomFieldDefinitions).innerJoin(assetCustomFieldGroups, eq(assetCustomFieldDefinitions.groupId, assetCustomFieldGroups.id)).leftJoin(assetCustomFieldValues, and(eq(assetCustomFieldValues.definitionId, assetCustomFieldDefinitions.id), eq(assetCustomFieldValues.assetId, id))).where(asset.assetCategoryId ? eq(assetCustomFieldDefinitions.assetCategoryId, asset.assetCategoryId) : isNull(assetCustomFieldDefinitions.assetCategoryId)).orderBy(asc(assetCustomFieldGroups.sortOrder), asc(assetCustomFieldDefinitions.sortOrder)),
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
    spareParts: partRows, customFields: customRows, documents: documentRows, history,
    workOrders: orders.map((order) => ({ ...order, assignedToName: order.assignedTo ? assigneeNames.get(order.assignedTo) ?? null : null })),
    contract: contract[0] ?? null,
  };
}
