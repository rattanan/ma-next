import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit/service";
import type { AuthenticatedUser } from "@/lib/auth/session";
import type { Permission } from "@/lib/auth/permissions";
import type { RequestMeta } from "@/lib/auth/request";
import { HttpError } from "@/lib/http";
import {
  amountInThb,
  actOnPurchaseApproval,
  cancelApprovalCycleTx,
  createApprovalInstanceTx,
  getPurchaseApprovalDetail,
  listPurchaseApprovalItems,
  previewApprovalRoute,
  validateWorkflowConfiguration,
} from "./approval-engine";
import {
  approvalRouteSimulationSchema,
  approvalWorkflowMutationSchema,
  type ApprovalWorkflowInput,
  type PurchaseOrderInput,
  type PurchaseRequestInput,
} from "./validation";
import type { z } from "zod";

type Tx = Prisma.TransactionClient;
type DecimalLike = Prisma.Decimal | string | number | null | undefined;
type Actor = AuthenticatedUser;

const D = (value: DecimalLike) => new Prisma.Decimal(String(value ?? "0"));
const decimalString = (value: DecimalLike) => D(value).toFixed(6).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
const isAdmin = (actor: Actor) => actor.role === "ADMIN" || actor.roleCodes?.includes("ADMIN");

function requirePurchasePermission(actor: Actor, permission: Permission) {
  if (!isAdmin(actor) && !actor.permissions.includes(permission)) throw new HttpError(403, `Permission ${permission} is required`, "FORBIDDEN");
}

function canReadAllPurchasing(actor: Actor) {
  return isAdmin(actor) || actor.permissions.includes("PURCHASE_ORDER_CREATE") || actor.permissions.includes("APPROVAL_OVERRIDE");
}

function purchaseNumber(prefix: "PR" | "PO") {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `${prefix}-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function lineTotal(quantity: DecimalLike, unitPrice: DecimalLike, discount: DecimalLike) {
  const subtotal = D(quantity).times(D(unitPrice));
  const discountValue = D(discount);
  if (discountValue.gt(subtotal)) throw new HttpError(400, "Line discount cannot exceed line subtotal", "INVALID_DISCOUNT");
  return { subtotal, total: subtotal.minus(discountValue) };
}

async function validateDepartment(tx: Tx, departmentId: string) {
  const department = await tx.department.findUnique({ where: { id: departmentId }, select: { id: true, name: true, active: true } });
  if (!department?.active) throw new HttpError(400, "Department is not active", "DEPARTMENT_INACTIVE");
  return department;
}

async function validateStockItems(tx: Tx, ids: string[]) {
  const uniqueIds = [...new Set(ids)];
  const rows = uniqueIds.length ? await tx.stockItem.findMany({ where: { id: { in: uniqueIds }, active: true }, select: { id: true, code: true, name: true, unit: true } }) : [];
  const map = new Map(rows.map((row) => [row.id, row]));
  for (const id of uniqueIds) if (!map.has(id)) throw new HttpError(400, "One or more stock items are missing or inactive", "STOCK_ITEM_INACTIVE");
  return map;
}

async function validateVendors(tx: Tx, ids: string[]) {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length > 3) throw new HttpError(400, "A purchase request may contain at most three candidate vendors", "CANDIDATE_VENDOR_LIMIT");
  const rows = uniqueIds.length ? await tx.vendor.findMany({ where: { id: { in: uniqueIds }, active: true }, select: { id: true, code: true, name: true } }) : [];
  const map = new Map(rows.map((row) => [row.id, row]));
  for (const id of uniqueIds) if (!map.has(id)) throw new HttpError(400, "One or more vendors are missing or inactive", "VENDOR_INACTIVE");
  return map;
}

function calculatedRequestLines(input: PurchaseRequestInput["lines"], stockItems: Map<string, { id: string; code: string; name: string }>) {
  return input.map((line, index) => {
    const item = stockItems.get(line.stockItemId);
    if (!item) throw new HttpError(400, "Stock item not found", "STOCK_ITEM_NOT_FOUND");
    const values = lineTotal(line.quantity, line.estimatedUnitPrice, line.discountAmount);
    return { lineNumber: index + 1, stockItemId: item.id, stockCodeSnapshot: item.code, description: item.name, quantity: D(line.quantity), estimatedUnitPrice: D(line.estimatedUnitPrice), discountAmount: D(line.discountAmount), lineTotal: values.total, remark: line.remark ?? null };
  });
}

function calculateRequestTotal(lines: Array<{ lineTotal: DecimalLike }>) {
  return lines.reduce((total, line) => total.plus(D(line.lineTotal)), D(0));
}

function calculatedOrderLines(input: PurchaseOrderInput["lines"], stockItems: Map<string, { id: string; code: string; name: string }>) {
  return input.map((line, index) => {
    const item = stockItems.get(line.stockItemId);
    if (!item) throw new HttpError(400, "Stock item not found", "STOCK_ITEM_NOT_FOUND");
    const values = lineTotal(line.quantity, line.unitPrice, line.itemDiscountAmount);
    return { lineNumber: index + 1, stockItemId: item.id, stockCodeSnapshot: item.code, description: item.name, quantity: D(line.quantity), unitPrice: D(line.unitPrice), itemDiscountAmount: D(line.itemDiscountAmount), lineSubtotal: values.subtotal, lineTotal: values.total, receivedQuantity: D(0), remark: line.remark ?? null };
  });
}

function calculateOrderTotals(lines: Array<{ lineTotal: DecimalLike; lineSubtotal: DecimalLike }>, headerDiscount: DecimalLike, vat: DecimalLike) {
  const subtotal = lines.reduce((total, line) => total.plus(D(line.lineTotal).plus(D(0))), D(0));
  const itemDiscount = lines.reduce((total, line) => total.plus(D(line.lineSubtotal ?? 0).minus(D(line.lineTotal))), D(0));
  const header = D(headerDiscount);
  const vatValue = D(vat);
  const beforeHeader = subtotal;
  if (header.gt(beforeHeader)) throw new HttpError(400, "Header discount cannot exceed the amount after item discounts", "INVALID_HEADER_DISCOUNT");
  return { subtotal: lines.reduce((total, line) => total.plus(D(line.lineSubtotal ?? 0)), D(0)), itemDiscount, headerDiscount: header, vat: vatValue, grandTotal: beforeHeader.minus(header).plus(vatValue) };
}

function mapRequest(row: Awaited<ReturnType<typeof prisma.purchaseRequest.findUnique>> & { lines?: Array<Record<string, unknown>>; candidateVendors?: Array<Record<string, unknown>> }) {
  if (!row) return row;
  return { ...row, estimatedTotalAmount: decimalString(row.estimatedTotalAmount), estimatedTotalAmountThb: decimalString(row.estimatedTotalAmountThb), exchangeRateToThb: decimalString(row.exchangeRateToThb), lines: row.lines?.map((line) => ({ ...line, quantity: decimalString(line.quantity as DecimalLike), estimatedUnitPrice: decimalString(line.estimatedUnitPrice as DecimalLike), discountAmount: decimalString(line.discountAmount as DecimalLike), lineTotal: decimalString(line.lineTotal as DecimalLike) })), candidateVendors: row.candidateVendors };
}

function mapOrder(row: Awaited<ReturnType<typeof prisma.purchaseOrder.findUnique>> & { lines?: Array<Record<string, unknown>> }) {
  if (!row) return row;
  return { ...row, exchangeRateToThb: decimalString(row.exchangeRateToThb), subtotalAmount: decimalString(row.subtotalAmount), itemDiscountAmount: decimalString(row.itemDiscountAmount), headerDiscountAmount: decimalString(row.headerDiscountAmount), vatAmount: decimalString(row.vatAmount), grandTotalAmount: decimalString(row.grandTotalAmount), grandTotalAmountThb: decimalString(row.grandTotalAmountThb), lines: row.lines?.map((line) => ({ ...line, stockCodeSnapshot: String((line as { stockCodeSnapshot?: string }).stockCodeSnapshot ?? ""), description: String((line as { description?: string }).description ?? ""), quantity: decimalString(line.quantity as DecimalLike), unitPrice: decimalString(line.unitPrice as DecimalLike), itemDiscountAmount: decimalString(line.itemDiscountAmount as DecimalLike), lineSubtotal: decimalString(line.lineSubtotal as DecimalLike), lineTotal: decimalString(line.lineTotal as DecimalLike), receivedQuantity: decimalString(line.receivedQuantity as DecimalLike) })) };
}

export async function listApprovalWorkflows(actor: Actor) {
  requirePurchasePermission(actor, "APPROVAL_WORKFLOW_VIEW");
  const rows = await prisma.approvalWorkflow.findMany({ include: { versions: { orderBy: { version: "desc" }, take: 1, include: { steps: { orderBy: { stepNumber: "asc" } } } } }, orderBy: [{ documentType: "asc" }, { priority: "desc" }, { minAmountThb: "asc" }] });
  const departments = await prisma.department.findMany({ where: { active: true }, select: { id: true, code: true, name: true }, orderBy: { name: "asc" } });
  const users = await prisma.user.findMany({ where: { status: "ACTIVE" }, select: { id: true, username: true, fullName: true }, orderBy: { username: "asc" }, take: 2000 });
  return { workflows: rows.map((row) => ({ ...row, minAmountThb: decimalString(row.minAmountThb), maxAmountThb: row.maxAmountThb ? decimalString(row.maxAmountThb) : null, effectiveFrom: row.effectiveFrom.toISOString(), effectiveTo: row.effectiveTo?.toISOString() ?? null, versions: row.versions.map((version) => ({ ...version, minAmountThb: decimalString(version.minAmountThb), maxAmountThb: version.maxAmountThb ? decimalString(version.maxAmountThb) : null, effectiveFrom: version.effectiveFrom.toISOString(), effectiveTo: version.effectiveTo?.toISOString() ?? null, steps: version.steps.map((step) => ({ ...step, minAmountThb: decimalString(step.minAmountThb), maxAmountThb: step.maxAmountThb ? decimalString(step.maxAmountThb) : null })) })) })), departments, users };
}

async function createWorkflowVersion(tx: Tx, workflowId: string, version: number, input: ApprovalWorkflowInput, actorId: string, userMap: Map<string, { username: string }>) {
  const versionRecord = await tx.approvalWorkflowVersion.create({ data: { id: randomUUID(), workflowId, version, documentType: input.documentType, departmentId: input.departmentId ?? null, minAmountThb: D(input.minAmountThb), maxAmountThb: input.maxAmountThb === null || input.maxAmountThb === undefined ? null : D(input.maxAmountThb), currencyBasis: input.currencyBasis, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo ?? null, priority: input.priority, createdBy: actorId } });
  await tx.approvalWorkflowStep.createMany({ data: input.steps.map((step) => ({ id: randomUUID(), workflowVersionId: versionRecord.id, stepNumber: step.stepNumber, stepName: step.stepName, approverType: step.approverType, approverUserId: step.approverUserId ?? null, approverUsernameSnapshot: step.approverUserId ? userMap.get(step.approverUserId)?.username ?? null : null, approverRole: step.approverRole ?? null, alternateUserId: step.alternateUserId ?? null, alternateUsernameSnapshot: step.alternateUserId ? userMap.get(step.alternateUserId)?.username ?? null : null, minAmountThb: D(step.minAmountThb), maxAmountThb: step.maxAmountThb === null || step.maxAmountThb === undefined ? null : D(step.maxAmountThb), isRequired: step.isRequired, allowSelfApproval: step.allowSelfApproval, canReject: step.canReject, canReturnForRevision: step.canReturnForRevision, canDelegate: step.canDelegate, escalationDurationHours: step.escalationDurationHours ?? null, isActive: step.isActive })) });
  return versionRecord;
}

export async function createApprovalWorkflow(input: ApprovalWorkflowInput, actor: Actor, meta: RequestMeta) {
  requirePurchasePermission(actor, "APPROVAL_WORKFLOW_CREATE");
  return prisma.$transaction(async (tx) => {
    const validation = await validateWorkflowConfiguration(tx, input, actor.id);
    const userIds = input.steps.flatMap((step) => [step.approverUserId, step.alternateUserId]).filter((id): id is string => Boolean(id));
    const users = userIds.length ? await tx.user.findMany({ where: { id: { in: [...new Set(userIds)] } }, select: { id: true, username: true } }) : [];
    const userMap = new Map(users.map((user) => [user.id, user]));
    const workflow = await tx.approvalWorkflow.create({ data: { id: randomUUID(), workflowName: input.workflowName, documentType: input.documentType, departmentId: input.departmentId ?? null, minAmountThb: D(input.minAmountThb), maxAmountThb: input.maxAmountThb === null || input.maxAmountThb === undefined ? null : D(input.maxAmountThb), currencyBasis: input.currencyBasis, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo ?? null, status: input.isActive ? "ACTIVE" : "DRAFT", isActive: input.isActive, priority: input.priority, version: 1, createdBy: actor.id, updatedBy: actor.id } });
    await createWorkflowVersion(tx, workflow.id, 1, input, actor.id, userMap);
    await writeAudit(tx, { action: "APPROVAL_WORKFLOW_CREATED", category: "PURCHASING", targetType: "APPROVAL_WORKFLOW", targetId: workflow.id, targetName: workflow.workflowName, description: `Created ${workflow.documentType} approval workflow`, newValues: { ...input, warnings: validation.warnings } }, actor, meta);
    return { workflow, warnings: validation.warnings };
  });
}

export async function updateApprovalWorkflow(id: string, input: ApprovalWorkflowInput, actor: Actor, meta: RequestMeta) {
  requirePurchasePermission(actor, "APPROVAL_WORKFLOW_EDIT");
  return prisma.$transaction(async (tx) => {
    const existing = await tx.approvalWorkflow.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "Approval workflow not found", "APPROVAL_WORKFLOW_NOT_FOUND");
    const validation = await validateWorkflowConfiguration(tx, input, actor.id, id);
    const userIds = input.steps.flatMap((step) => [step.approverUserId, step.alternateUserId]).filter((value): value is string => Boolean(value));
    const users = userIds.length ? await tx.user.findMany({ where: { id: { in: [...new Set(userIds)] } }, select: { id: true, username: true } }) : [];
    const userMap = new Map(users.map((user) => [user.id, user]));
    const version = existing.version + 1;
    const workflow = await tx.approvalWorkflow.update({ where: { id }, data: { workflowName: input.workflowName, documentType: input.documentType, departmentId: input.departmentId ?? null, minAmountThb: D(input.minAmountThb), maxAmountThb: input.maxAmountThb === null || input.maxAmountThb === undefined ? null : D(input.maxAmountThb), currencyBasis: input.currencyBasis, effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo ?? null, status: input.isActive ? "ACTIVE" : "DRAFT", isActive: input.isActive, priority: input.priority, version, updatedBy: actor.id } });
    await createWorkflowVersion(tx, id, version, input, actor.id, userMap);
    await writeAudit(tx, { action: "APPROVAL_WORKFLOW_UPDATED", category: "PURCHASING", targetType: "APPROVAL_WORKFLOW", targetId: id, targetName: workflow.workflowName, description: `Created approval workflow version ${version}`, previousValues: { version: existing.version, isActive: existing.isActive }, newValues: { version, ...input, warnings: validation.warnings } }, actor, meta);
    return { workflow, warnings: validation.warnings };
  });
}

export async function activateApprovalWorkflow(id: string, active: boolean, actor: Actor, meta: RequestMeta) {
  requirePurchasePermission(actor, "APPROVAL_WORKFLOW_ACTIVATE");
  return prisma.$transaction(async (tx) => {
    const existing = await tx.approvalWorkflow.findUnique({ where: { id }, include: { versions: { where: { version: 1 }, include: { steps: true } } } });
    if (!existing) throw new HttpError(404, "Approval workflow not found", "APPROVAL_WORKFLOW_NOT_FOUND");
    const current = await tx.approvalWorkflowVersion.findUnique({ where: { workflowId_version: { workflowId: id, version: existing.version } }, include: { steps: true } });
    if (!current) throw new HttpError(409, "Approval workflow version is incomplete", "APPROVAL_WORKFLOW_VERSION_MISSING");
    const input = approvalWorkflowMutationSchema.parse({ workflowName: existing.workflowName, documentType: existing.documentType, departmentId: existing.departmentId, minAmountThb: decimalString(existing.minAmountThb), maxAmountThb: existing.maxAmountThb ? decimalString(existing.maxAmountThb) : null, currencyBasis: existing.currencyBasis, effectiveFrom: existing.effectiveFrom, effectiveTo: existing.effectiveTo, priority: existing.priority, isActive: active, steps: current.steps.map((step) => ({ stepNumber: step.stepNumber, stepName: step.stepName, approverType: step.approverType, approverUserId: step.approverUserId, approverRole: step.approverRole, alternateUserId: step.alternateUserId, minAmountThb: decimalString(step.minAmountThb), maxAmountThb: step.maxAmountThb ? decimalString(step.maxAmountThb) : null, isRequired: step.isRequired, allowSelfApproval: step.allowSelfApproval, canReject: step.canReject, canReturnForRevision: step.canReturnForRevision, canDelegate: step.canDelegate, escalationDurationHours: step.escalationDurationHours, isActive: step.isActive })) });
    const validation = await validateWorkflowConfiguration(tx, input, actor.id, id);
    const workflow = await tx.approvalWorkflow.update({ where: { id }, data: { isActive: active, status: active ? "ACTIVE" : "INACTIVE", updatedBy: actor.id } });
    await writeAudit(tx, { action: active ? "APPROVAL_WORKFLOW_ACTIVATED" : "APPROVAL_WORKFLOW_DEACTIVATED", category: "PURCHASING", targetType: "APPROVAL_WORKFLOW", targetId: id, targetName: workflow.workflowName, description: active ? "Activated approval workflow" : "Deactivated approval workflow", newValues: { isActive: active, warnings: validation.warnings } }, actor, meta);
    return { workflow, warnings: validation.warnings };
  });
}

export async function simulateApprovalRoute(input: z.infer<typeof approvalRouteSimulationSchema>, actor: Actor) {
  requirePurchasePermission(actor, "APPROVAL_WORKFLOW_SIMULATE");
  const parsed = approvalRouteSimulationSchema.parse(input);
  return prisma.$transaction((tx) => previewApprovalRoute(tx, { documentType: parsed.documentType, departmentId: parsed.departmentId ?? "", amount: parsed.amount, currencyCode: parsed.currencyCode, exchangeRateToThb: parsed.exchangeRateToThb, requesterId: parsed.requesterId ?? actor.id }));
}

export async function getPurchasingReferenceData(actor: Actor) {
  requirePurchasePermission(actor, "PURCHASE_REQUEST_VIEW");
  const [departments, vendors, stockItems, approvedRequests, users] = await Promise.all([
    prisma.department.findMany({ where: { active: true }, select: { id: true, code: true, name: true }, orderBy: { name: "asc" } }),
    prisma.vendor.findMany({ where: { active: true }, select: { id: true, code: true, name: true }, orderBy: { name: "asc" }, take: 1000 }),
    prisma.stockItem.findMany({ where: { active: true }, select: { id: true, code: true, name: true, unit: true, defaultUnitCost: true }, orderBy: { code: "asc" }, take: 2000 }),
    prisma.purchaseRequest.findMany({ where: { status: "APPROVED" }, select: { id: true, requestNumber: true, departmentId: true, estimatedTotalAmountThb: true }, orderBy: { approvedAt: "desc" }, take: 500 }),
    prisma.user.findMany({ where: { status: "ACTIVE" }, select: { id: true, username: true, fullName: true }, orderBy: { username: "asc" }, take: 2000 }),
  ]);
  return { departments, vendors, stockItems: stockItems.map((item) => ({ ...item, defaultUnitCost: decimalString(item.defaultUnitCost) })), approvedRequests: approvedRequests.map((row) => ({ ...row, estimatedTotalAmountThb: decimalString(row.estimatedTotalAmountThb) })), users };
}

export async function listPurchaseRequests(query: { q: string; status?: string; page: number; pageSize: number }, actor: Actor) {
  requirePurchasePermission(actor, "PURCHASE_REQUEST_VIEW");
  const where: Prisma.PurchaseRequestWhereInput = { ...(canReadAllPurchasing(actor) ? {} : { requesterId: actor.id }), ...(query.status ? { status: query.status as never } : {}) };
  if (query.q) where.OR = [{ requestNumber: { contains: query.q } }, { remark: { contains: query.q } }];
  const [rows, total] = await Promise.all([prisma.purchaseRequest.findMany({ where, include: { lines: true, candidateVendors: true }, orderBy: { createdAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }), prisma.purchaseRequest.count({ where })]);
  return { requests: rows.map(mapRequest), total, page: query.page, pageSize: query.pageSize, pages: Math.max(1, Math.ceil(total / query.pageSize)) };
}

export async function getPurchaseRequest(id: string, actor: Actor) {
  requirePurchasePermission(actor, "PURCHASE_REQUEST_VIEW");
  const row = await prisma.purchaseRequest.findUnique({ where: { id }, include: { lines: true, candidateVendors: true } });
  if (!row) throw new HttpError(404, "Purchase request not found", "PURCHASE_REQUEST_NOT_FOUND");
  if (!canReadAllPurchasing(actor) && row.requesterId !== actor.id) throw new HttpError(403, "This purchase request is outside your access", "SCOPE_FORBIDDEN");
  return mapRequest(row);
}

export async function createPurchaseRequest(input: PurchaseRequestInput, actor: Actor, meta: RequestMeta) {
  requirePurchasePermission(actor, "PURCHASE_REQUEST_CREATE");
  return prisma.$transaction(async (tx) => {
    await validateDepartment(tx, input.departmentId);
    const stockItems = await validateStockItems(tx, input.lines.map((line) => line.stockItemId));
    const vendors = await validateVendors(tx, input.candidateVendorIds);
    const lines = calculatedRequestLines(input.lines, stockItems);
    const total = calculateRequestTotal(lines);
    const totalThb = amountInThb(total, input.currencyCode, input.exchangeRateToThb);
    const now = new Date();
    const request = await tx.purchaseRequest.create({ data: { id: randomUUID(), requestNumber: purchaseNumber("PR"), requesterId: actor.id, departmentId: input.departmentId, status: "DRAFT", currencyCode: input.currencyCode.toUpperCase(), exchangeRateToThb: D(input.exchangeRateToThb), estimatedTotalAmount: total, estimatedTotalAmountThb: totalThb, remark: input.remark ?? null, createdBy: actor.id, updatedBy: actor.id, createdAt: now, lines: { create: lines }, candidateVendors: { create: input.candidateVendorIds.map((vendorId, index) => ({ id: randomUUID(), vendorId, vendorNameSnapshot: vendors.get(vendorId)!.name, rank: index + 1 })) } }, include: { lines: true, candidateVendors: true } });
    await writeAudit(tx, { action: "PURCHASE_REQUEST_CREATED", category: "PURCHASING", targetType: "PURCHASE_REQUEST", targetId: request.id, targetName: request.requestNumber, description: `Created purchase request ${request.requestNumber}`, newValues: { departmentId: input.departmentId, lineCount: lines.length, total: decimalString(total), totalThb: decimalString(totalThb) } }, actor, meta);
    return mapRequest(request);
  });
}

export async function updatePurchaseRequest(id: string, input: PurchaseRequestInput, actor: Actor, meta: RequestMeta) {
  requirePurchasePermission(actor, "PURCHASE_REQUEST_EDIT");
  return prisma.$transaction(async (tx) => {
    const existing = await tx.purchaseRequest.findUnique({ where: { id }, include: { lines: true, candidateVendors: true } });
    if (!existing) throw new HttpError(404, "Purchase request not found", "PURCHASE_REQUEST_NOT_FOUND");
    if (existing.requesterId !== actor.id && !canReadAllPurchasing(actor)) throw new HttpError(403, "Only the requester may edit this purchase request", "FORBIDDEN");
    if (!["DRAFT", "RETURNED_FOR_REVISION"].includes(existing.status)) throw new HttpError(409, "Only a draft or returned purchase request can be edited", "PURCHASE_REQUEST_LOCKED");
    await validateDepartment(tx, input.departmentId);
    const stockItems = await validateStockItems(tx, input.lines.map((line) => line.stockItemId));
    const vendors = await validateVendors(tx, input.candidateVendorIds);
    const lines = calculatedRequestLines(input.lines, stockItems);
    const total = calculateRequestTotal(lines);
    const totalThb = amountInThb(total, input.currencyCode, input.exchangeRateToThb);
    await tx.purchaseRequestLine.deleteMany({ where: { purchaseRequestId: id } });
    await tx.purchaseRequestVendor.deleteMany({ where: { purchaseRequestId: id } });
    const request = await tx.purchaseRequest.update({ where: { id }, data: { departmentId: input.departmentId, status: "DRAFT", currencyCode: input.currencyCode.toUpperCase(), exchangeRateToThb: D(input.exchangeRateToThb), estimatedTotalAmount: total, estimatedTotalAmountThb: totalThb, remark: input.remark ?? null, revisionNumber: existing.status === "RETURNED_FOR_REVISION" ? { increment: 1 } : undefined, updatedBy: actor.id, lines: { create: lines }, candidateVendors: { create: input.candidateVendorIds.map((vendorId, index) => ({ id: randomUUID(), vendorId, vendorNameSnapshot: vendors.get(vendorId)!.name, rank: index + 1 })) } }, include: { lines: true, candidateVendors: true } });
    await writeAudit(tx, { action: "PURCHASE_REQUEST_UPDATED", category: "PURCHASING", targetType: "PURCHASE_REQUEST", targetId: id, targetName: request.requestNumber, description: `Updated purchase request ${request.requestNumber}`, previousValues: { status: existing.status }, newValues: { status: request.status, totalThb: decimalString(totalThb) } }, actor, meta);
    return mapRequest(request);
  });
}

export async function submitPurchaseRequest(id: string, actor: Actor, meta: RequestMeta) {
  requirePurchasePermission(actor, "PURCHASE_REQUEST_SUBMIT");
  return prisma.$transaction(async (tx) => {
    const request = await tx.purchaseRequest.findUnique({ where: { id }, include: { lines: true } });
    if (!request) throw new HttpError(404, "Purchase request not found", "PURCHASE_REQUEST_NOT_FOUND");
    if (request.requesterId !== actor.id && !canReadAllPurchasing(actor)) throw new HttpError(403, "Only the requester may submit this purchase request", "FORBIDDEN");
    if (!["DRAFT", "RETURNED_FOR_REVISION"].includes(request.status)) throw new HttpError(409, "Only a draft or returned purchase request can be submitted", "PURCHASE_REQUEST_INVALID_STATUS");
    if (!request.lines.length) throw new HttpError(400, "Purchase request requires at least one item", "PURCHASE_REQUEST_LINES_REQUIRED");
    const now = new Date();
    const cycle = ((await tx.approvalInstance.aggregate({ where: { documentType: "PURCHASE_REQUEST", documentId: id }, _max: { cycleNumber: true } }))._max.cycleNumber ?? 0) + 1;
    await tx.purchaseRequest.update({ where: { id }, data: { status: "PENDING_APPROVAL", submittedAt: now, cycleNumber: cycle, updatedBy: actor.id } });
    const approval = await createApprovalInstanceTx(tx, { documentType: "PURCHASE_REQUEST", documentId: id, departmentId: request.departmentId, amount: request.estimatedTotalAmount, currencyCode: request.currencyCode, exchangeRateToThb: request.exchangeRateToThb, requesterId: request.requesterId, submittedBy: actor.id, cycleNumber: cycle, at: now, actor, meta });
    return { id, requestNumber: request.requestNumber, status: "PENDING_APPROVAL", cycleNumber: cycle, approvalInstanceId: approval.instance.id, documentAmountThb: decimalString(approval.route.amountThb) };
  });
}

export async function cancelPurchaseRequest(id: string, actor: Actor, meta: RequestMeta) {
  requirePurchasePermission(actor, "PURCHASE_REQUEST_EDIT");
  return prisma.$transaction(async (tx) => {
    const request = await tx.purchaseRequest.findUnique({ where: { id } });
    if (!request) throw new HttpError(404, "Purchase request not found", "PURCHASE_REQUEST_NOT_FOUND");
    if (request.requesterId !== actor.id && !canReadAllPurchasing(actor)) throw new HttpError(403, "Only the requester may cancel this purchase request", "FORBIDDEN");
    if (["APPROVED", "CONVERTED", "CANCELLED"].includes(request.status)) throw new HttpError(409, "This purchase request cannot be cancelled", "PURCHASE_REQUEST_CANCEL_FORBIDDEN");
    await cancelApprovalCycleTx(tx, "PURCHASE_REQUEST", id, actor, meta, "Purchase request cancelled by requester");
    const updated = await tx.purchaseRequest.update({ where: { id }, data: { status: "CANCELLED", updatedBy: actor.id } });
    await writeAudit(tx, { action: "PURCHASE_REQUEST_CANCELLED", category: "PURCHASING", targetType: "PURCHASE_REQUEST", targetId: id, targetName: updated.requestNumber, description: `Cancelled purchase request ${updated.requestNumber}` }, actor, meta);
    return { id, status: updated.status };
  });
}

export async function listPurchaseOrders(query: { q: string; status?: string; page: number; pageSize: number }, actor: Actor) {
  requirePurchasePermission(actor, "PURCHASE_ORDER_VIEW");
  const statuses = query.status?.split(",").map((status) => status.trim()).filter(Boolean);
  const where: Prisma.PurchaseOrderWhereInput = { ...(canReadAllPurchasing(actor) ? {} : { creatorId: actor.id }), ...(statuses?.length === 1 ? { status: statuses[0] as never } : statuses?.length ? { status: { in: statuses as never[] } } : {}) };
  if (query.q) where.OR = [{ orderNumber: { contains: query.q } }, { vendorNameSnapshot: { contains: query.q } }, { remark: { contains: query.q } }];
  const [rows, total] = await Promise.all([prisma.purchaseOrder.findMany({ where, include: { lines: true }, orderBy: { createdAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }), prisma.purchaseOrder.count({ where })]);
  return { orders: rows.map(mapOrder), total, page: query.page, pageSize: query.pageSize, pages: Math.max(1, Math.ceil(total / query.pageSize)) };
}

export async function getPurchaseOrder(id: string, actor: Actor) {
  requirePurchasePermission(actor, "PURCHASE_ORDER_VIEW");
  const row = await prisma.purchaseOrder.findUnique({ where: { id }, include: { lines: true } });
  if (!row) throw new HttpError(404, "Purchase order not found", "PURCHASE_ORDER_NOT_FOUND");
  if (!canReadAllPurchasing(actor) && row.creatorId !== actor.id) throw new HttpError(403, "This purchase order is outside your access", "SCOPE_FORBIDDEN");
  return mapOrder(row);
}

export async function createPurchaseOrder(input: PurchaseOrderInput, actor: Actor, meta: RequestMeta) {
  requirePurchasePermission(actor, "PURCHASE_ORDER_CREATE");
  return prisma.$transaction(async (tx) => {
    await validateDepartment(tx, input.departmentId);
    const vendor = await tx.vendor.findUnique({ where: { id: input.vendorId }, select: { id: true, name: true, active: true } });
    if (!vendor?.active) throw new HttpError(400, "Vendor is not active", "VENDOR_INACTIVE");
    if (input.purchaseRequestId) {
      const request = await tx.purchaseRequest.findUnique({ where: { id: input.purchaseRequestId }, select: { status: true } });
      if (!request || request.status !== "APPROVED") throw new HttpError(409, "Only an approved purchase request can be used to create a PO", "PURCHASE_REQUEST_NOT_APPROVED");
    }
    const stockItems = await validateStockItems(tx, input.lines.map((line) => line.stockItemId));
    const lines = calculatedOrderLines(input.lines, stockItems);
    const totals = calculateOrderTotals(lines, input.headerDiscountAmount, input.vatAmount);
    const totalThb = amountInThb(totals.grandTotal, input.currencyCode, input.exchangeRateToThb);
    const order = await tx.purchaseOrder.create({ data: { id: randomUUID(), orderNumber: purchaseNumber("PO"), purchaseRequestId: input.purchaseRequestId ?? null, vendorId: vendor.id, vendorNameSnapshot: vendor.name, creatorId: actor.id, departmentId: input.departmentId, status: "DRAFT", purchaseMethod: input.purchaseMethod ?? null, currencyCode: input.currencyCode.toUpperCase(), exchangeRateToThb: D(input.exchangeRateToThb), subtotalAmount: totals.subtotal, itemDiscountAmount: totals.itemDiscount, headerDiscountAmount: totals.headerDiscount, vatAmount: totals.vat, grandTotalAmount: totals.grandTotal, grandTotalAmountThb: totalThb, remark: input.remark ?? null, internalRemark: input.internalRemark ?? null, createdBy: actor.id, updatedBy: actor.id, lines: { create: lines } }, include: { lines: true } });
    await writeAudit(tx, { action: "PURCHASE_ORDER_CREATED", category: "PURCHASING", targetType: "PURCHASE_ORDER", targetId: order.id, targetName: order.orderNumber, description: `Created purchase order ${order.orderNumber}`, newValues: { vendorId: vendor.id, totalThb: decimalString(totalThb), lineCount: lines.length } }, actor, meta);
    return mapOrder(order);
  });
}

export async function updatePurchaseOrder(id: string, input: PurchaseOrderInput, actor: Actor, meta: RequestMeta) {
  requirePurchasePermission(actor, "PURCHASE_ORDER_EDIT");
  return prisma.$transaction(async (tx) => {
    const existing = await tx.purchaseOrder.findUnique({ where: { id }, include: { lines: true } });
    if (!existing) throw new HttpError(404, "Purchase order not found", "PURCHASE_ORDER_NOT_FOUND");
    if (existing.creatorId !== actor.id && !canReadAllPurchasing(actor)) throw new HttpError(403, "Only the PO creator may edit this purchase order", "FORBIDDEN");
    if (!["DRAFT", "RETURNED_FOR_REVISION", "APPROVED"].includes(existing.status)) throw new HttpError(409, "This purchase order cannot be edited in its current status", "PURCHASE_ORDER_LOCKED");
    await validateDepartment(tx, input.departmentId);
    const vendor = await tx.vendor.findUnique({ where: { id: input.vendorId }, select: { id: true, name: true, active: true } });
    if (!vendor?.active) throw new HttpError(400, "Vendor is not active", "VENDOR_INACTIVE");
    if (input.purchaseRequestId) {
      const request = await tx.purchaseRequest.findUnique({ where: { id: input.purchaseRequestId }, select: { status: true } });
      if (!request || request.status !== "APPROVED") throw new HttpError(409, "Only an approved purchase request can be used for a PO", "PURCHASE_REQUEST_NOT_APPROVED");
    }
    const stockItems = await validateStockItems(tx, input.lines.map((line) => line.stockItemId));
    const lines = calculatedOrderLines(input.lines, stockItems);
    const totals = calculateOrderTotals(lines, input.headerDiscountAmount, input.vatAmount);
    const totalThb = amountInThb(totals.grandTotal, input.currencyCode, input.exchangeRateToThb);
    const oldSignature = JSON.stringify({ purchaseRequestId: existing.purchaseRequestId, vendorId: existing.vendorId, departmentId: existing.departmentId, purchaseMethod: existing.purchaseMethod, currencyCode: existing.currencyCode, exchangeRateToThb: decimalString(existing.exchangeRateToThb), subtotal: decimalString(existing.subtotalAmount), itemDiscount: decimalString(existing.itemDiscountAmount), headerDiscount: decimalString(existing.headerDiscountAmount), vat: decimalString(existing.vatAmount), lines: existing.lines.map((line) => [line.stockItemId, decimalString(line.quantity), decimalString(line.unitPrice), decimalString(line.itemDiscountAmount)]) });
    const newSignature = JSON.stringify({ purchaseRequestId: input.purchaseRequestId ?? null, vendorId: input.vendorId, departmentId: input.departmentId, purchaseMethod: input.purchaseMethod ?? null, currencyCode: input.currencyCode.toUpperCase(), exchangeRateToThb: decimalString(input.exchangeRateToThb), subtotal: decimalString(totals.subtotal), itemDiscount: decimalString(totals.itemDiscount), headerDiscount: decimalString(totals.headerDiscount), vat: decimalString(totals.vat), lines: lines.map((line) => [line.stockItemId, decimalString(line.quantity), decimalString(line.unitPrice), decimalString(line.itemDiscountAmount)]) });
    const materialChanged = oldSignature !== newSignature;
    if (existing.status === "APPROVED" && materialChanged) await cancelApprovalCycleTx(tx, "PURCHASE_ORDER", id, actor, meta, "Approval cancelled because material PO fields changed", true);
    await tx.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: id } });
    const order = await tx.purchaseOrder.update({ where: { id }, data: { purchaseRequestId: input.purchaseRequestId ?? null, vendorId: vendor.id, vendorNameSnapshot: vendor.name, departmentId: input.departmentId, status: existing.status === "APPROVED" && materialChanged || existing.status === "RETURNED_FOR_REVISION" ? "DRAFT" : existing.status, purchaseMethod: input.purchaseMethod ?? null, currencyCode: input.currencyCode.toUpperCase(), exchangeRateToThb: D(input.exchangeRateToThb), subtotalAmount: totals.subtotal, itemDiscountAmount: totals.itemDiscount, headerDiscountAmount: totals.headerDiscount, vatAmount: totals.vat, grandTotalAmount: totals.grandTotal, grandTotalAmountThb: totalThb, remark: input.remark ?? null, internalRemark: input.internalRemark ?? null, revisionNumber: materialChanged ? { increment: 1 } : undefined, updatedBy: actor.id, lines: { create: lines } }, include: { lines: true } });
    await writeAudit(tx, { action: "PURCHASE_ORDER_UPDATED", category: "PURCHASING", targetType: "PURCHASE_ORDER", targetId: id, targetName: order.orderNumber, description: materialChanged ? "Updated material PO fields and reset approval" : "Updated non-material PO fields", previousValues: { status: existing.status }, newValues: { status: order.status, materialChanged, totalThb: decimalString(totalThb) } }, actor, meta);
    return mapOrder(order);
  });
}

export async function submitPurchaseOrder(id: string, actor: Actor, meta: RequestMeta) {
  requirePurchasePermission(actor, "PURCHASE_ORDER_SUBMIT");
  return prisma.$transaction(async (tx) => {
    const order = await tx.purchaseOrder.findUnique({ where: { id }, include: { lines: true } });
    if (!order) throw new HttpError(404, "Purchase order not found", "PURCHASE_ORDER_NOT_FOUND");
    if (order.creatorId !== actor.id && !canReadAllPurchasing(actor)) throw new HttpError(403, "Only the PO creator may submit this purchase order", "FORBIDDEN");
    if (!["DRAFT", "RETURNED_FOR_REVISION"].includes(order.status)) throw new HttpError(409, "Only a draft or returned PO can be submitted", "PURCHASE_ORDER_INVALID_STATUS");
    if (!order.lines.length) throw new HttpError(400, "Purchase order requires at least one item", "PURCHASE_ORDER_LINES_REQUIRED");
    const now = new Date();
    const cycle = ((await tx.approvalInstance.aggregate({ where: { documentType: "PURCHASE_ORDER", documentId: id }, _max: { cycleNumber: true } }))._max.cycleNumber ?? 0) + 1;
    await tx.purchaseOrder.update({ where: { id }, data: { status: "PENDING_APPROVAL", submittedAt: now, cycleNumber: cycle, updatedBy: actor.id } });
    const approval = await createApprovalInstanceTx(tx, { documentType: "PURCHASE_ORDER", documentId: id, departmentId: order.departmentId, amount: order.grandTotalAmount, currencyCode: order.currencyCode, exchangeRateToThb: order.exchangeRateToThb, requesterId: order.creatorId, submittedBy: actor.id, cycleNumber: cycle, at: now, actor, meta });
    return { id, orderNumber: order.orderNumber, status: "PENDING_APPROVAL", cycleNumber: cycle, approvalInstanceId: approval.instance.id, documentAmountThb: decimalString(approval.route.amountThb) };
  });
}

export async function issuePurchaseOrder(id: string, actor: Actor, meta: RequestMeta) {
  requirePurchasePermission(actor, "PURCHASE_ORDER_ISSUE");
  return prisma.$transaction(async (tx) => {
    const order = await tx.purchaseOrder.findUnique({ where: { id } });
    if (!order) throw new HttpError(404, "Purchase order not found", "PURCHASE_ORDER_NOT_FOUND");
    if (order.status !== "APPROVED") throw new HttpError(409, "Only an approved purchase order can be issued", "PURCHASE_ORDER_NOT_APPROVED");
    const pending = await tx.approvalInstance.findFirst({ where: { documentType: "PURCHASE_ORDER", documentId: id, status: "PENDING" } });
    if (pending) throw new HttpError(409, "Purchase order still has pending approvals", "PURCHASE_ORDER_APPROVAL_PENDING");
    const issued = await tx.purchaseOrder.update({ where: { id }, data: { status: "ISSUED", issuedAt: new Date(), issuedBy: actor.id, updatedBy: actor.id } });
    await writeAudit(tx, { action: "PURCHASE_ORDER_ISSUED", category: "PURCHASING", targetType: "PURCHASE_ORDER", targetId: id, targetName: issued.orderNumber, description: `Issued purchase order ${issued.orderNumber}` }, actor, meta);
    return { id, orderNumber: issued.orderNumber, status: issued.status };
  });
}

export async function cancelPurchaseOrder(id: string, actor: Actor, meta: RequestMeta) {
  requirePurchasePermission(actor, "PURCHASE_ORDER_EDIT");
  return prisma.$transaction(async (tx) => {
    const order = await tx.purchaseOrder.findUnique({ where: { id } });
    if (!order) throw new HttpError(404, "Purchase order not found", "PURCHASE_ORDER_NOT_FOUND");
    if (order.creatorId !== actor.id && !canReadAllPurchasing(actor)) throw new HttpError(403, "Only the PO creator may cancel this purchase order", "FORBIDDEN");
    if (["ISSUED", "RECEIVED", "CLOSED", "CANCELLED"].includes(order.status)) throw new HttpError(409, "This purchase order cannot be cancelled", "PURCHASE_ORDER_CANCEL_FORBIDDEN");
    await cancelApprovalCycleTx(tx, "PURCHASE_ORDER", id, actor, meta, "Purchase order cancelled by creator", true);
    const updated = await tx.purchaseOrder.update({ where: { id }, data: { status: "CANCELLED", updatedBy: actor.id } });
    await writeAudit(tx, { action: "PURCHASE_ORDER_CANCELLED", category: "PURCHASING", targetType: "PURCHASE_ORDER", targetId: id, targetName: updated.orderNumber, description: `Cancelled purchase order ${updated.orderNumber}` }, actor, meta);
    return { id, status: updated.status };
  });
}

export async function getPurchaseOrderPrint(id: string, actor: Actor) {
  requirePurchasePermission(actor, "PURCHASE_ORDER_PRINT");
  const order = await getPurchaseOrder(id, actor);
  return order;
}

export { actOnPurchaseApproval, getPurchaseApprovalDetail, listPurchaseApprovalItems };
