import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit/service";
import type { AuthenticatedUser } from "@/lib/auth/session";
import type { Permission } from "@/lib/auth/permissions";
import type { RequestMeta } from "@/lib/auth/request";
import { HttpError } from "@/lib/http";
import { purchaseApprovalActionSchema, type ApprovalWorkflowInput } from "./validation";
import type { z } from "zod";

type Tx = Prisma.TransactionClient;
type DecimalLike = Prisma.Decimal | string | number | null | undefined;
type PurchaseApprovalAction = z.infer<typeof purchaseApprovalActionSchema>;
type UserRecord = { id: string; username: string; fullName: string; status: string };

const D = (value: DecimalLike) => new Prisma.Decimal(String(value ?? "0"));
const decimalString = (value: DecimalLike) => D(value).toFixed(6).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
const isAdmin = (actor: AuthenticatedUser) => actor.role === "ADMIN" || actor.roleCodes?.includes("ADMIN");
const isActiveUser = (user: { status: string } | null | undefined) => user?.status === "ACTIVE";

export function amountInThb(amount: DecimalLike, currencyCode: string, exchangeRateToThb: DecimalLike) {
  const rate = currencyCode.toUpperCase() === "THB" ? D(1) : D(exchangeRateToThb);
  if (rate.lte(0)) throw new HttpError(400, "Exchange rate to THB must be greater than zero", "INVALID_EXCHANGE_RATE");
  return D(amount).times(rate).toDecimalPlaces(6);
}

export type ApprovalRouteRequest = {
  documentType: "PURCHASE_REQUEST" | "PURCHASE_ORDER";
  departmentId: string;
  amount: DecimalLike;
  currencyCode: string;
  exchangeRateToThb: DecimalLike;
  requesterId: string;
  at?: Date;
};

export type ApprovalRoutePreview = {
  workflowId: string;
  workflowName: string;
  workflowVersion: number;
  priority: number;
  documentAmount: string;
  documentAmountThb: string;
  currencyCode: string;
  exchangeRateToThb: string;
  steps: Array<{
    stepNumber: number;
    stepName: string;
    approverType: string;
    approverUserId: string;
    approverUsername: string;
    originalApproverUserId: string;
    originalApproverUsername: string;
    minAmountThb: string;
    maxAmountThb: string | null;
    allowSelfApproval: boolean;
    canReject: boolean;
    canReturnForRevision: boolean;
    canDelegate: boolean;
    dueAt: string | null;
  }>;
};

function amountMatches(amount: Prisma.Decimal, min: DecimalLike, max: DecimalLike) {
  return amount.gte(D(min)) && (max === null || max === undefined || amount.lte(D(max)));
}

function rangeOverlaps(minA: DecimalLike, maxA: DecimalLike, minB: DecimalLike, maxB: DecimalLike) {
  const aMax = maxA === null || maxA === undefined ? null : D(maxA);
  const bMax = maxB === null || maxB === undefined ? null : D(maxB);
  return (bMax === null || D(minA).lte(bMax)) && (aMax === null || D(minB).lte(aMax));
}

function dateRangesOverlap(fromA: Date, toA: Date | null | undefined, fromB: Date, toB: Date | null) {
  const latestFrom = fromA > fromB ? fromA : fromB;
  const earliestTo = toA && toB ? (toA < toB ? toA : toB) : toA ?? toB;
  return !earliestTo || latestFrom <= earliestTo;
}

function snapshotStep(step: ApprovalWorkflowInput["steps"][number], user: UserRecord, original: UserRecord, dueAt: Date | null) {
  return {
    id: randomUUID(),
    stepNumber: step.stepNumber,
    stepName: step.stepName,
    approverType: step.approverType,
    assignedUserId: user.id,
    assignedUsernameSnapshot: user.username,
    originalApproverUserId: original.id,
    originalApproverUsernameSnapshot: original.username,
    actualApproverUserId: null as string | null,
    alternateUserId: step.alternateUserId ?? null,
    alternateUsernameSnapshot: null as string | null,
    workflowStepId: null as string | null,
    minAmountThb: D(step.minAmountThb),
    maxAmountThb: step.maxAmountThb === null || step.maxAmountThb === undefined ? null : D(step.maxAmountThb),
    isRequired: step.isRequired,
    allowSelfApproval: step.allowSelfApproval,
    canReject: step.canReject,
    canReturnForRevision: step.canReturnForRevision,
    canDelegate: step.canDelegate,
    status: "WAITING" as "WAITING" | "PENDING",
    lastAction: null,
    comment: null,
    actionAt: null,
    dueAt,
  };
}

async function findUser(tx: Tx, id: string): Promise<UserRecord | null> {
  return tx.user.findUnique({ where: { id }, select: { id: true, username: true, fullName: true, status: true } });
}

async function resolveRoleApprover(tx: Tx, roleCode: string, departmentId: string) {
  const assignments = await tx.userRole.findMany({
    where: {
      role: { code: roleCode, active: true },
      user: { status: "ACTIVE" },
      OR: [{ departmentId }, { departmentId: null }],
    },
    include: { user: { select: { id: true, username: true, fullName: true, status: true } } },
    orderBy: { createdAt: "asc" },
  });
  return assignments[0]?.user ?? null;
}

async function resolveDynamicApprover(tx: Tx, type: ApprovalWorkflowInput["steps"][number]["approverType"], role: string | null, departmentId: string) {
  const roleCodes = type === "ROLE" && role ? [role] : type === "PURCHASE_MANAGER" ? ["PURCHASE_MANAGER", "PURCHASING_MANAGER"] : ["DEPARTMENT_MANAGER", "MAINTENANCE_MANAGER", "PURCHASE_MANAGER", "FINANCE_MANAGER"];
  for (const roleCode of roleCodes) {
    const user = await resolveRoleApprover(tx, roleCode, departmentId);
    if (user) return user;
  }
  return null;
}

async function resolveApprover(tx: Tx, step: ApprovalWorkflowInput["steps"][number], requesterId: string, departmentId: string, at: Date) {
  const primary = step.approverType === "SPECIFIC_USER" && step.approverUserId
    ? await findUser(tx, step.approverUserId)
    : await resolveDynamicApprover(tx, step.approverType, step.approverRole ?? null, departmentId);
  const alternate = step.alternateUserId ? await findUser(tx, step.alternateUserId) : null;
  let original = primary;
  let assigned = primary;

  if (!isActiveUser(primary) || (primary && primary.id === requesterId && !step.allowSelfApproval)) {
    if (!isActiveUser(alternate) || alternate?.id === requesterId) throw new HttpError(409, `Approval step ${step.stepNumber} has no valid alternate approver`, "SELF_APPROVAL_CONFIGURATION");
    original = primary ?? alternate;
    assigned = alternate;
  }
  if (!original || !assigned) throw new HttpError(409, `Approval step ${step.stepNumber} has no active approver`, "APPROVER_NOT_ACTIVE");
  const resolvedOriginal: UserRecord = original;
  let resolvedAssigned: UserRecord = assigned;

  const delegation = await tx.approvalDelegation.findFirst({
    where: { primaryApproverId: original.id, active: true, delegationStart: { lte: at }, delegationEnd: { gte: at } },
    orderBy: { delegationStart: "desc" },
  });
  if (delegation) {
    const delegate = await findUser(tx, delegation.delegateUserId);
    if (delegate?.status === "ACTIVE" && delegate.id !== requesterId) resolvedAssigned = delegate;
  }
  if (!step.allowSelfApproval && resolvedAssigned.id === requesterId) throw new HttpError(409, `Approval step ${step.stepNumber} would assign the document requester`, "SELF_APPROVAL_CONFIGURATION");
  return { original: resolvedOriginal, assigned: resolvedAssigned, alternate };
}

export async function validateWorkflowConfiguration(tx: Tx, input: ApprovalWorkflowInput, actorId: string, excludeWorkflowId?: string) {
  const warnings: string[] = [];
  if (input.departmentId) {
    const department = await tx.department.findUnique({ where: { id: input.departmentId }, select: { id: true, active: true } });
    if (!department?.active) throw new HttpError(400, "The selected department is not active", "DEPARTMENT_INACTIVE");
  }
  const approverIds = input.steps.flatMap((step) => [step.approverUserId, step.alternateUserId]).filter((id): id is string => Boolean(id));
  const users = approverIds.length ? await tx.user.findMany({ where: { id: { in: [...new Set(approverIds)] } }, select: { id: true, username: true, status: true } }) : [];
  const userMap = new Map(users.map((user) => [user.id, user]));
  for (const step of input.steps) {
    if (step.approverType === "SPECIFIC_USER") {
      const user = step.approverUserId ? userMap.get(step.approverUserId) : null;
      if (!user || user.status !== "ACTIVE") throw new HttpError(400, `Approver for step ${step.stepNumber} is not active`, "APPROVER_NOT_ACTIVE");
    }
    if (step.alternateUserId) {
      const alternate = userMap.get(step.alternateUserId);
      if (!alternate || alternate.status !== "ACTIVE") throw new HttpError(400, `Alternate approver for step ${step.stepNumber} is not active`, "ALTERNATE_APPROVER_NOT_ACTIVE");
    }
  }
  const usernames = input.steps.map((step) => step.approverUserId).filter((id): id is string => Boolean(id)).map((id) => userMap.get(id)?.username).filter((name): name is string => Boolean(name));
  for (let index = 1; index < usernames.length; index += 1) if (usernames[index] === usernames[index - 1]) warnings.push(`Username ${usernames[index]} is configured in consecutive approval steps`);

  if (input.isActive) {
    const activeWorkflows = await tx.approvalWorkflow.findMany({ where: { documentType: input.documentType, isActive: true, status: "ACTIVE", ...(excludeWorkflowId ? { id: { not: excludeWorkflowId } } : {}) }, select: { id: true, departmentId: true, minAmountThb: true, maxAmountThb: true, priority: true, effectiveFrom: true, effectiveTo: true } });
    const conflict = activeWorkflows.find((workflow) => {
      const sameDepartment = workflow.departmentId === input.departmentId || workflow.departmentId === null || input.departmentId === null;
      return sameDepartment && workflow.priority === input.priority && dateRangesOverlap(input.effectiveFrom, input.effectiveTo, workflow.effectiveFrom, workflow.effectiveTo) && rangeOverlaps(input.minAmountThb, input.maxAmountThb, workflow.minAmountThb, workflow.maxAmountThb);
    });
    if (conflict) throw new HttpError(409, "An active workflow overlaps this amount range with the same priority", "APPROVAL_WORKFLOW_OVERLAP");
  }
  return { warnings };
}

export async function selectApprovalRoute(tx: Tx, request: ApprovalRouteRequest, at = request.at ?? new Date()) {
  const amount = D(request.amount);
  const rate = request.currencyCode.toUpperCase() === "THB" ? D(1) : D(request.exchangeRateToThb);
  const amountThb = amountInThb(amount, request.currencyCode, request.exchangeRateToThb);
  const workflows = await tx.approvalWorkflow.findMany({ where: { documentType: request.documentType, isActive: true, status: "ACTIVE", effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }] } });
  const matching = workflows.filter((workflow) => (workflow.departmentId === null || workflow.departmentId === request.departmentId) && amountMatches(amountThb, workflow.minAmountThb, workflow.maxAmountThb));
  matching.sort((left, right) => right.priority - left.priority || Number(right.departmentId === request.departmentId) - Number(left.departmentId === request.departmentId) || right.effectiveFrom.getTime() - left.effectiveFrom.getTime());
  const workflow = matching[0];
  if (!workflow) throw new HttpError(409, `No approval route found for ${request.documentType}, department ${request.departmentId}, amount THB ${decimalString(amountThb)}`, "APPROVAL_ROUTE_NOT_FOUND");
  const version = await tx.approvalWorkflowVersion.findUnique({ where: { workflowId_version: { workflowId: workflow.id, version: workflow.version } }, include: { steps: { where: { isActive: true }, orderBy: { stepNumber: "asc" } } } });
  if (!version) throw new HttpError(409, "The selected workflow version is incomplete", "APPROVAL_WORKFLOW_VERSION_MISSING");
  const steps = version.steps.filter((step) => amountMatches(amountThb, step.minAmountThb, step.maxAmountThb));
  if (!steps.length) throw new HttpError(409, "The selected approval workflow has no step for this amount", "APPROVAL_WORKFLOW_STEPS_NOT_MATCHED");
  return { workflow, version, steps, amount, amountThb, rate };
}

export async function previewApprovalRoute(tx: Tx, request: ApprovalRouteRequest): Promise<ApprovalRoutePreview> {
  const route = await selectApprovalRoute(tx, request);
  const steps: ApprovalRoutePreview["steps"] = [];
  for (const source of route.steps) {
    const resolved = await resolveApprover(tx, { ...source, approverUserId: source.approverUserId, approverType: source.approverType, approverRole: source.approverRole, alternateUserId: source.alternateUserId, minAmountThb: decimalString(source.minAmountThb), maxAmountThb: source.maxAmountThb ? decimalString(source.maxAmountThb) : null, isRequired: source.isRequired, allowSelfApproval: source.allowSelfApproval, canReject: source.canReject, canReturnForRevision: source.canReturnForRevision, canDelegate: source.canDelegate, escalationDurationHours: source.escalationDurationHours, stepNumber: source.stepNumber, stepName: source.stepName, isActive: source.isActive }, request.requesterId ?? "", request.departmentId, new Date());
    steps.push({ stepNumber: source.stepNumber, stepName: source.stepName, approverType: source.approverType, approverUserId: resolved.assigned.id, approverUsername: resolved.assigned.username, originalApproverUserId: resolved.original.id, originalApproverUsername: resolved.original.username, minAmountThb: decimalString(source.minAmountThb), maxAmountThb: source.maxAmountThb ? decimalString(source.maxAmountThb) : null, allowSelfApproval: source.allowSelfApproval, canReject: source.canReject, canReturnForRevision: source.canReturnForRevision, canDelegate: source.canDelegate, dueAt: source.escalationDurationHours ? new Date(Date.now() + source.escalationDurationHours * 3600000).toISOString() : null });
  }
  return { workflowId: route.workflow.id, workflowName: route.workflow.workflowName, workflowVersion: route.workflow.version, priority: route.workflow.priority, documentAmount: decimalString(route.amount), documentAmountThb: decimalString(route.amountThb), currencyCode: request.currencyCode.toUpperCase(), exchangeRateToThb: decimalString(route.rate), steps };
}

async function createNotificationTx(tx: Tx, recipientIds: string[], title: string, message: string, sourceId: string, actorId: string, documentType: "PURCHASE_REQUEST" | "PURCHASE_ORDER") {
  const recipients = [...new Set(recipientIds)].filter(Boolean);
  if (!recipients.length) return;
  await tx.notification.create({ data: { id: randomUUID(), type: "PURCHASE_APPROVAL_PENDING", title, message, actionUrl: `/approvals?type=${documentType}`, sourceType: "APPROVAL_INSTANCE", sourceId, createdBy: actorId, recipients: { createMany: { data: recipients.map((userId) => ({ userId })) } } } });
}

export async function createApprovalInstanceTx(tx: Tx, request: ApprovalRouteRequest & { documentId: string; submittedBy: string; cycleNumber: number; actor: AuthenticatedUser; meta: RequestMeta }) {
  const submittedAt = request.at ?? new Date();
  const route = await selectApprovalRoute(tx, request);
  const instance = await tx.approvalInstance.create({ data: { id: randomUUID(), documentType: request.documentType, documentId: request.documentId, workflowId: route.workflow.id, workflowVersionId: route.version.id, workflowVersion: route.workflow.version, cycleNumber: request.cycleNumber, documentAmount: route.amount, currencyCode: request.currencyCode.toUpperCase(), exchangeRateToThb: route.rate, documentAmountThb: route.amountThb, departmentId: request.departmentId, currentStepNumber: route.steps[0].stepNumber, status: "PENDING", submittedBy: request.submittedBy, submittedAt } });
  const snapshotRows = [];
  for (let index = 0; index < route.steps.length; index += 1) {
    const source = route.steps[index];
    const resolved = await resolveApprover(tx, { ...source, approverUserId: source.approverUserId, approverType: source.approverType, approverRole: source.approverRole, alternateUserId: source.alternateUserId, minAmountThb: decimalString(source.minAmountThb), maxAmountThb: source.maxAmountThb ? decimalString(source.maxAmountThb) : null, isRequired: source.isRequired, allowSelfApproval: source.allowSelfApproval, canReject: source.canReject, canReturnForRevision: source.canReturnForRevision, canDelegate: source.canDelegate, escalationDurationHours: source.escalationDurationHours, stepNumber: source.stepNumber, stepName: source.stepName, isActive: source.isActive }, request.requesterId, request.departmentId, submittedAt);
    const dueAt = source.escalationDurationHours ? new Date(submittedAt.getTime() + source.escalationDurationHours * 3600000) : null;
    const row = snapshotStep({ ...source, approverUserId: source.approverUserId, approverType: source.approverType, approverRole: source.approverRole, alternateUserId: source.alternateUserId, minAmountThb: decimalString(source.minAmountThb), maxAmountThb: source.maxAmountThb ? decimalString(source.maxAmountThb) : null, isRequired: source.isRequired, allowSelfApproval: source.allowSelfApproval, canReject: source.canReject, canReturnForRevision: source.canReturnForRevision, canDelegate: source.canDelegate, escalationDurationHours: source.escalationDurationHours, stepNumber: source.stepNumber, stepName: source.stepName, isActive: source.isActive }, resolved.assigned, resolved.original, dueAt);
    row.workflowStepId = source.id;
    row.alternateUsernameSnapshot = resolved.alternate?.username ?? null;
    row.status = index === 0 ? "PENDING" : "WAITING";
    snapshotRows.push(row);
  }
  await tx.approvalInstanceStep.createMany({ data: snapshotRows.map((row) => ({ ...row, approvalInstanceId: instance.id })) });
  await tx.approvalAction.create({ data: { id: randomUUID(), approvalInstanceId: instance.id, action: "SUBMITTED", actorUserId: request.actor.id, actorUsernameSnapshot: request.actor.username, comment: null, actionAt: submittedAt } });
  const first = snapshotRows[0];
  await createNotificationTx(tx, [first.assignedUserId], `${request.documentType === "PURCHASE_REQUEST" ? "PR" : "PO"} awaiting your approval`, `Step ${first.stepNumber}: ${first.stepName}`, instance.id, request.actor.id, request.documentType);
  await writeAudit(tx, { action: "PURCHASE_APPROVAL_SUBMITTED", category: "PURCHASING", targetType: request.documentType, targetId: request.documentId, description: `Created approval cycle ${request.cycleNumber} using workflow ${route.workflow.workflowName} v${route.workflow.version}`, newValues: { workflowId: route.workflow.id, workflowVersion: route.workflow.version, documentAmount: decimalString(route.amount), documentAmountThb: decimalString(route.amountThb), stepCount: snapshotRows.length } }, request.actor, request.meta);
  return { instance, route, steps: snapshotRows };
}

async function updateDocumentStatusTx(tx: Tx, documentType: "PURCHASE_REQUEST" | "PURCHASE_ORDER", documentId: string, status: "APPROVED" | "REJECTED" | "RETURNED_FOR_REVISION", at: Date) {
  if (documentType === "PURCHASE_REQUEST") {
    await tx.purchaseRequest.update({ where: { id: documentId }, data: { status, ...(status === "APPROVED" ? { approvedAt: at } : status === "REJECTED" ? { rejectedAt: at } : { returnedAt: at }) } });
  } else {
    await tx.purchaseOrder.update({ where: { id: documentId }, data: { status, ...(status === "APPROVED" ? { approvedAt: at } : {}) } });
  }
}

function actionStatus(action: PurchaseApprovalAction["action"]) {
  return action === "APPROVE" ? "APPROVED" : action === "REJECT" ? "REJECTED" : "RETURNED";
}

function purchaseApprovalPermission(documentType: "PURCHASE_REQUEST" | "PURCHASE_ORDER", action: PurchaseApprovalAction["action"]): Permission | null {
  if (action === "OPEN") return "VIEW_APPROVAL_CENTER";
  if (action === "COMMENT") return "APPROVAL_VIEW_HISTORY";
  if (action === "DELEGATE") return "APPROVAL_DELEGATE";
  const prefix = documentType === "PURCHASE_REQUEST" ? "PURCHASE_REQUEST" : "PURCHASE_ORDER";
  return action === "APPROVE" ? `${prefix}_APPROVE` : action === "REJECT" ? `${prefix}_REJECT` : `${prefix}_RETURN`;
}

function requirePurchaseApprovalPermission(actor: AuthenticatedUser, documentType: "PURCHASE_REQUEST" | "PURCHASE_ORDER", action: PurchaseApprovalAction["action"]) {
  const permission = purchaseApprovalPermission(documentType, action);
  if (permission && !isAdmin(actor) && !actor.permissions.includes("APPROVAL_OVERRIDE") && !actor.permissions.includes(permission)) throw new HttpError(403, `Permission ${permission} is required`, "FORBIDDEN");
}

export async function actOnPurchaseApproval(id: string, input: PurchaseApprovalAction, actor: AuthenticatedUser, meta: RequestMeta) {
  return prisma.$transaction(async (tx) => {
    const first = await tx.approvalInstanceStep.findUnique({ where: { id }, include: { approvalInstance: true } });
    if (!first) throw new HttpError(404, "Approval step not found", "APPROVAL_STEP_NOT_FOUND");
    await tx.$queryRaw(Prisma.sql`SELECT id FROM approval_instances WHERE id = ${first.approvalInstanceId} FOR UPDATE`);
    const step = await tx.approvalInstanceStep.findUnique({ where: { id }, include: { approvalInstance: true } });
    if (!step || step.approvalInstance.status !== "PENDING" || step.status !== "PENDING") throw new HttpError(409, "This approval step is no longer pending", "APPROVAL_STEP_NOT_PENDING");
    requirePurchaseApprovalPermission(actor, step.approvalInstance.documentType, input.action);
    const authorized = step.assignedUserId === actor.id || isAdmin(actor) || actor.permissions.includes("APPROVAL_OVERRIDE");
    if (!authorized) throw new HttpError(403, "This approval step is not assigned to you", "APPROVAL_ASSIGNMENT_FORBIDDEN");
    const now = new Date();
    if (input.action === "OPEN") {
      await tx.approvalAction.create({ data: { id: randomUUID(), approvalInstanceId: step.approvalInstanceId, approvalInstanceStepId: step.id, action: "OPENED", actorUserId: actor.id, actorUsernameSnapshot: actor.username, originalApproverUserId: step.originalApproverUserId, actualApproverUserId: actor.id, comment: input.comment ?? null, actionAt: now } });
      await writeAudit(tx, { action: "PURCHASE_APPROVAL_OPENED", category: "PURCHASING", targetType: step.approvalInstance.documentType, targetId: step.approvalInstance.documentId, description: `Opened approval step ${step.stepNumber}`, newValues: { stepNumber: step.stepNumber, comment: input.comment ?? null } }, actor, meta);
      return { id, status: step.status };
    }
    if (input.action === "COMMENT") {
      await tx.approvalAction.create({ data: { id: randomUUID(), approvalInstanceId: step.approvalInstanceId, approvalInstanceStepId: step.id, action: "COMMENTED", actorUserId: actor.id, actorUsernameSnapshot: actor.username, originalApproverUserId: step.originalApproverUserId, actualApproverUserId: actor.id, comment: input.comment, actionAt: now } });
      await writeAudit(tx, { action: "PURCHASE_APPROVAL_COMMENTED", category: "PURCHASING", targetType: step.approvalInstance.documentType, targetId: step.approvalInstance.documentId, description: `Commented on approval step ${step.stepNumber}`, newValues: { stepNumber: step.stepNumber, comment: input.comment } }, actor, meta);
      return { id, status: step.status };
    }
    if (input.action === "DELEGATE") {
      if (!step.canDelegate && !isAdmin(actor) && !actor.permissions.includes("APPROVAL_OVERRIDE")) throw new HttpError(403, "Delegation is not allowed for this step", "DELEGATION_NOT_ALLOWED");
      const delegate = await findUser(tx, input.delegateUserId);
      if (delegate?.status !== "ACTIVE" || delegate.id === step.approvalInstance.submittedBy) throw new HttpError(400, "Delegate must be active and different from the requester", "INVALID_DELEGATE");
      const resolvedDelegate = delegate;
      await tx.approvalInstanceStep.update({ where: { id }, data: { assignedUserId: resolvedDelegate.id, assignedUsernameSnapshot: resolvedDelegate.username } });
      await tx.approvalAction.create({ data: { id: randomUUID(), approvalInstanceId: step.approvalInstanceId, approvalInstanceStepId: step.id, action: "DELEGATED", actorUserId: actor.id, actorUsernameSnapshot: actor.username, originalApproverUserId: step.originalApproverUserId, actualApproverUserId: resolvedDelegate.id, comment: input.comment, metadata: JSON.stringify({ delegateUserId: resolvedDelegate.id }), actionAt: now } });
      await createNotificationTx(tx, [resolvedDelegate.id], `Approval delegated to you`, `Step ${step.stepNumber}: ${step.stepName}`, step.approvalInstanceId, actor.id, step.approvalInstance.documentType);
      await writeAudit(tx, { action: "PURCHASE_APPROVAL_DELEGATED", category: "PURCHASING", targetType: step.approvalInstance.documentType, targetId: step.approvalInstance.documentId, description: `Delegated approval step ${step.stepNumber} to ${resolvedDelegate.username}`, newValues: { delegateUserId: resolvedDelegate.id } }, actor, meta);
      return { id, status: "PENDING", assignedUserId: resolvedDelegate.id };
    }
    const finalStatus = actionStatus(input.action);
    let instanceStatus: "PENDING" | "APPROVED" | "REJECTED" | "RETURNED_FOR_REVISION" = "PENDING";
    if (input.action === "REJECT" && !step.canReject && !isAdmin(actor) && !actor.permissions.includes("APPROVAL_OVERRIDE")) throw new HttpError(403, "Reject is not allowed for this step", "REJECT_NOT_ALLOWED");
    if (input.action === "RETURN" && !step.canReturnForRevision && !isAdmin(actor) && !actor.permissions.includes("APPROVAL_OVERRIDE")) throw new HttpError(403, "Return for revision is not allowed for this step", "RETURN_NOT_ALLOWED");
    await tx.approvalInstanceStep.update({ where: { id }, data: { status: finalStatus, lastAction: finalStatus === "APPROVED" ? "APPROVED" : finalStatus === "REJECTED" ? "REJECTED" : "RETURNED_FOR_REVISION", actualApproverUserId: actor.id, comment: input.comment, actionAt: now } });
    await tx.approvalAction.create({ data: { id: randomUUID(), approvalInstanceId: step.approvalInstanceId, approvalInstanceStepId: step.id, action: finalStatus === "APPROVED" ? "APPROVED" : finalStatus === "REJECTED" ? "REJECTED" : "RETURNED_FOR_REVISION", actorUserId: actor.id, actorUsernameSnapshot: actor.username, originalApproverUserId: step.originalApproverUserId, actualApproverUserId: actor.id, comment: input.comment, actionAt: now } });
    if (finalStatus !== "APPROVED") {
      await tx.approvalInstanceStep.updateMany({ where: { approvalInstanceId: step.approvalInstanceId, status: "WAITING" }, data: { status: "CANCELLED" } });
      instanceStatus = finalStatus === "REJECTED" ? "REJECTED" : "RETURNED_FOR_REVISION";
      await tx.approvalInstance.update({ where: { id: step.approvalInstanceId }, data: { status: instanceStatus, currentStepNumber: null, completedAt: now } });
      await updateDocumentStatusTx(tx, step.approvalInstance.documentType, step.approvalInstance.documentId, instanceStatus, now);
      await createNotificationTx(tx, [step.approvalInstance.submittedBy], `${step.approvalInstance.documentType === "PURCHASE_REQUEST" ? "PR" : "PO"} ${finalStatus === "REJECTED" ? "rejected" : "returned for revision"}`, input.comment, step.approvalInstance.id, actor.id, step.approvalInstance.documentType);
    } else {
      const next = await tx.approvalInstanceStep.findFirst({ where: { approvalInstanceId: step.approvalInstanceId, status: "WAITING" }, orderBy: { stepNumber: "asc" } });
      if (next) {
        await tx.approvalInstanceStep.update({ where: { id: next.id }, data: { status: "PENDING" } });
        await tx.approvalInstance.update({ where: { id: step.approvalInstanceId }, data: { currentStepNumber: next.stepNumber } });
        await createNotificationTx(tx, [next.assignedUserId], `${step.approvalInstance.documentType === "PURCHASE_REQUEST" ? "PR" : "PO"} awaiting your approval`, `Step ${next.stepNumber}: ${next.stepName}`, step.approvalInstance.id, actor.id, step.approvalInstance.documentType);
      } else {
        instanceStatus = "APPROVED";
        await tx.approvalInstance.update({ where: { id: step.approvalInstanceId }, data: { status: "APPROVED", currentStepNumber: null, completedAt: now } });
        await updateDocumentStatusTx(tx, step.approvalInstance.documentType, step.approvalInstance.documentId, "APPROVED", now);
        await createNotificationTx(tx, [step.approvalInstance.submittedBy], `${step.approvalInstance.documentType === "PURCHASE_REQUEST" ? "PR" : "PO"} approved`, "All approval steps are complete", step.approvalInstance.id, actor.id, step.approvalInstance.documentType);
      }
    }
    await writeAudit(tx, { action: `PURCHASE_APPROVAL_${finalStatus}`, category: "PURCHASING", targetType: step.approvalInstance.documentType, targetId: step.approvalInstance.documentId, description: `${finalStatus} approval step ${step.stepNumber}`, newValues: { stepNumber: step.stepNumber, comment: input.comment, actorUserId: actor.id } }, actor, meta);
    return { id, status: finalStatus, instanceStatus };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function cancelApprovalCycleTx(tx: Tx, documentType: "PURCHASE_REQUEST" | "PURCHASE_ORDER", documentId: string, actor: AuthenticatedUser, meta: RequestMeta, reason: string, includeApproved = false) {
  const instances = await tx.approvalInstance.findMany({ where: { documentType, documentId, status: includeApproved ? { in: ["PENDING", "APPROVED"] } : "PENDING" }, select: { id: true } });
  for (const instance of instances) {
    await tx.approvalInstanceStep.updateMany({ where: { approvalInstanceId: instance.id, status: { in: ["PENDING", "WAITING"] } }, data: { status: "CANCELLED" } });
    await tx.approvalInstance.update({ where: { id: instance.id }, data: { status: "CANCELLED", currentStepNumber: null, completedAt: new Date() } });
    await tx.approvalAction.create({ data: { id: randomUUID(), approvalInstanceId: instance.id, action: "CANCELLED", actorUserId: actor.id, actorUsernameSnapshot: actor.username, comment: reason, actionAt: new Date() } });
  }
  if (instances.length) await writeAudit(tx, { action: "PURCHASE_APPROVAL_CYCLE_CANCELLED", category: "PURCHASING", targetType: documentType, targetId: documentId, description: reason, newValues: { cancelledInstances: instances.length } }, actor, meta);
}

export async function createDelegation(input: { primaryApproverId: string; delegateUserId: string; delegationStart: Date; delegationEnd: Date; reason?: string | null }, actor: AuthenticatedUser, meta: RequestMeta) {
  if (!actor.permissions.includes("APPROVAL_DELEGATE") && !isAdmin(actor)) throw new HttpError(403, "Delegation permission is required", "FORBIDDEN");
  if (input.delegationEnd < input.delegationStart) throw new HttpError(400, "Delegation end must be on or after start", "INVALID_DELEGATION_DATES");
  if (input.primaryApproverId === input.delegateUserId) throw new HttpError(400, "Primary approver and delegate must be different users", "INVALID_DELEGATION_USERS");
  return prisma.$transaction(async (tx) => {
    const [primary, delegate] = await Promise.all([findUser(tx, input.primaryApproverId), findUser(tx, input.delegateUserId)]);
    if (primary?.status !== "ACTIVE" || delegate?.status !== "ACTIVE") throw new HttpError(400, "Primary approver and delegate must both be active", "INVALID_DELEGATION_USERS");
    const resolvedPrimary = primary;
    const resolvedDelegate = delegate;
    const overlapping = await tx.approvalDelegation.findFirst({ where: { primaryApproverId: resolvedPrimary.id, active: true, delegationStart: { lte: input.delegationEnd }, delegationEnd: { gte: input.delegationStart } }, select: { id: true } });
    if (overlapping) throw new HttpError(409, "The primary approver already has an overlapping active delegation", "DELEGATION_OVERLAP");
    const record = await tx.approvalDelegation.create({ data: { id: randomUUID(), primaryApproverId: resolvedPrimary.id, delegateUserId: resolvedDelegate.id, delegationStart: input.delegationStart, delegationEnd: input.delegationEnd, reason: input.reason ?? null, createdBy: actor.id } });
    await writeAudit(tx, { action: "APPROVAL_DELEGATION_CREATED", category: "PURCHASING", targetType: "APPROVAL_DELEGATION", targetId: record.id, description: `Delegated ${resolvedPrimary.username} to ${resolvedDelegate.username}`, newValues: input }, actor, meta);
    return record;
  });
}

export async function listDelegations(actor: AuthenticatedUser) {
  if (!actor.permissions.includes("APPROVAL_DELEGATE") && !isAdmin(actor)) throw new HttpError(403, "Delegation permission is required", "FORBIDDEN");
  const rows = await prisma.approvalDelegation.findMany({ where: isAdmin(actor) ? {} : { OR: [{ primaryApproverId: actor.id }, { delegateUserId: actor.id }] }, orderBy: { delegationStart: "desc" } });
  const userIds = [...new Set(rows.flatMap((row) => [row.primaryApproverId, row.delegateUserId, row.createdBy]))];
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true, fullName: true } }) : [];
  const userMap = new Map(users.map((user) => [user.id, user]));
  return { delegations: rows.map((row) => ({ ...row, primaryApprover: userMap.get(row.primaryApproverId) ?? null, delegateUser: userMap.get(row.delegateUserId) ?? null, createdByUser: userMap.get(row.createdBy) ?? null })) };
}

export async function getPurchaseApprovalTask(id: string, actor: AuthenticatedUser) {
  const step = await prisma.approvalInstanceStep.findUnique({ where: { id }, include: { approvalInstance: { include: { steps: true } } } });
  if (!step) return null;
  const authorized = step.assignedUserId === actor.id || isAdmin(actor) || actor.permissions.includes("APPROVAL_OVERRIDE");
  if (!authorized) throw new HttpError(403, "This approval step is not assigned to you", "APPROVAL_ASSIGNMENT_FORBIDDEN");
  return { id: step.id, approvalType: step.approvalInstance.documentType, referenceId: step.approvalInstance.documentId, referenceNumber: step.approvalInstance.documentId, title: step.stepName, requestedById: step.approvalInstance.submittedBy, requestedAt: step.approvalInstance.submittedAt, status: step.status === "PENDING" ? "PENDING" : step.status, assignedRole: step.stepName, approvalRound: step.approvalInstance.cycleNumber };
}

export async function listPurchaseApprovalItems(actor: AuthenticatedUser, query: { tab: string; search?: string; type?: string; page: number; pageSize: number }) {
  if (!actor.permissions.includes("VIEW_APPROVAL_CENTER") && !isAdmin(actor)) return { items: [], total: 0, page: query.page, pageSize: query.pageSize, pages: 1, stats: { pending: 0, inReview: 0, overdue: 0, approvedToday: 0 } };
  const statuses = query.tab === "pending" ? ["PENDING"] : query.tab === "approved" ? ["APPROVED"] : query.tab === "rejected" ? ["REJECTED"] : query.tab === "returned" ? ["RETURNED"] : ["PENDING", "APPROVED", "REJECTED", "RETURNED"];
  const steps = await prisma.approvalInstanceStep.findMany({ where: { assignedUserId: actor.id, status: { in: statuses as never[] }, ...(query.type ? { approvalInstance: { documentType: query.type as "PURCHASE_REQUEST" | "PURCHASE_ORDER" } } : {}) }, include: { approvalInstance: true }, orderBy: { actionAt: "asc" }, take: 1000 });
  const prIds = steps.filter((step) => step.approvalInstance.documentType === "PURCHASE_REQUEST").map((step) => step.approvalInstance.documentId);
  const poIds = steps.filter((step) => step.approvalInstance.documentType === "PURCHASE_ORDER").map((step) => step.approvalInstance.documentId);
  const [prs, pos] = await Promise.all([prIds.length ? prisma.purchaseRequest.findMany({ where: { id: { in: prIds } } }) : [], poIds.length ? prisma.purchaseOrder.findMany({ where: { id: { in: poIds } } }) : []]);
  const peopleIds = [...new Set([...prs.map((row) => row.requesterId), ...pos.map((row) => row.creatorId)])];
  const people = peopleIds.length ? await prisma.user.findMany({ where: { id: { in: peopleIds } }, select: { id: true, fullName: true } }) : [];
  const peopleMap = new Map(people.map((person) => [person.id, person.fullName]));
  const prMap = new Map(prs.map((row) => [row.id, row]));
  const poMap = new Map(pos.map((row) => [row.id, row]));
  const items = steps.map((step) => {
    const instance = step.approvalInstance;
    const pr = instance.documentType === "PURCHASE_REQUEST" ? prMap.get(instance.documentId) : null;
    const po = instance.documentType === "PURCHASE_ORDER" ? poMap.get(instance.documentId) : null;
    const referenceNumber = pr?.requestNumber ?? po?.orderNumber ?? instance.documentId;
    const requesterId = pr?.requesterId ?? po?.creatorId ?? instance.submittedBy;
    const haystack = `${referenceNumber} ${step.stepName} ${peopleMap.get(requesterId) ?? ""} ${po?.vendorNameSnapshot ?? ""}`.toLowerCase();
    if (query.search && !haystack.includes(query.search.toLowerCase())) return null;
    const status = step.status === "APPROVED" ? "APPROVED" : step.status === "REJECTED" ? "REJECTED" : step.status === "RETURNED" ? "RETURNED" : "PENDING";
    return { id: step.id, approvalType: instance.documentType, referenceId: instance.documentId, referenceNumber, title: `${instance.documentType === "PURCHASE_REQUEST" ? "Purchase Request" : "Purchase Order"} · ${referenceNumber}`, status, priority: null, requestedAt: instance.submittedAt.toISOString(), requestedByName: peopleMap.get(requesterId) ?? "Unknown user", assignedRole: step.stepName, waitingMinutes: Math.max(0, Math.floor((Date.now() - instance.submittedAt.getTime()) / 60000)), approvalRound: instance.cycleNumber, siteId: null, departmentId: instance.departmentId, currentStep: step.stepNumber, totalSteps: 0, stepName: step.stepName, amount: decimalString(instance.documentAmount), amountInThb: decimalString(instance.documentAmountThb), currencyCode: instance.currencyCode, vendor: po?.vendorNameSnapshot ?? null };
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const totalStepsMap = new Map<string, number>();
  const allStepCounts = await prisma.approvalInstanceStep.groupBy({ by: ["approvalInstanceId"], _count: { _all: true }, where: { approvalInstanceId: { in: steps.map((step) => step.approvalInstanceId) } } });
  allStepCounts.forEach((row) => totalStepsMap.set(row.approvalInstanceId, row._count._all));
  items.forEach((item) => { const source = steps.find((step) => step.id === item.id); item.totalSteps = source ? totalStepsMap.get(source.approvalInstanceId) ?? 0 : 0; });
  const start = (query.page - 1) * query.pageSize;
  const pending = items.filter((item) => item.status === "PENDING").length;
  const approvedToday = items.filter((item) => item.status === "APPROVED" && new Date(item.requestedAt).toDateString() === new Date().toDateString()).length;
  return { items: items.slice(start, start + query.pageSize), total: items.length, page: query.page, pageSize: query.pageSize, pages: Math.max(1, Math.ceil(items.length / query.pageSize)), stats: { pending, inReview: 0, overdue: items.filter((item) => item.status === "PENDING" && item.waitingMinutes >= 1440).length, approvedToday } };
}

export async function getPurchaseApprovalDetail(id: string, actor: AuthenticatedUser) {
  const step = await prisma.approvalInstanceStep.findUnique({ where: { id }, include: { approvalInstance: { include: { steps: true } } } });
  if (!step) return null;
  const authorized = step.assignedUserId === actor.id || isAdmin(actor) || actor.permissions.includes("APPROVAL_OVERRIDE");
  if (!authorized) throw new HttpError(403, "This approval step is not assigned to you", "APPROVAL_ASSIGNMENT_FORBIDDEN");
  const instance = step.approvalInstance;
  const [purchaseRequest, purchaseOrder, actions] = await Promise.all([
    instance.documentType === "PURCHASE_REQUEST" ? prisma.purchaseRequest.findUnique({ where: { id: instance.documentId }, include: { lines: true, candidateVendors: true } }) : null,
    instance.documentType === "PURCHASE_ORDER" ? prisma.purchaseOrder.findUnique({ where: { id: instance.documentId }, include: { lines: true } }) : null,
    prisma.approvalAction.findMany({ where: { approvalInstanceId: instance.id }, orderBy: { actionAt: "asc" } }),
  ]);
  const actorIds = [...new Set([instance.submittedBy, ...actions.map((action) => action.actorUserId), ...instance.steps.map((row) => row.assignedUserId)])];
  const people = actorIds.length ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, fullName: true, username: true } }) : [];
  const peopleMap = new Map(people.map((person) => [person.id, person]));
  const source = purchaseRequest ?? purchaseOrder;
  const referenceNumber = purchaseRequest?.requestNumber ?? purchaseOrder?.orderNumber ?? instance.documentId;
  return { task: { id: step.id, approvalType: instance.documentType, referenceId: instance.documentId, referenceNumber, title: `${instance.documentType === "PURCHASE_REQUEST" ? "Purchase Request" : "Purchase Order"} · ${referenceNumber}`, status: step.status === "PENDING" ? "PENDING" : step.status, priority: null, requestedAt: instance.submittedAt, requestedByName: peopleMap.get(instance.submittedBy)?.fullName ?? "Unknown user", assignedRole: step.stepName, waitingMinutes: Math.max(0, Math.floor((Date.now() - instance.submittedAt.getTime()) / 60000)), approvalRound: instance.cycleNumber, siteId: null, departmentId: instance.departmentId, currentStep: step.stepNumber, totalSteps: instance.steps.length, stepName: step.stepName, amount: decimalString(instance.documentAmount), amountInThb: decimalString(instance.documentAmountThb), currencyCode: instance.currencyCode, vendor: purchaseOrder?.vendorNameSnapshot ?? null }, purchase: { documentType: instance.documentType, instance, currentStep: step, purchaseRequest, purchaseOrder, requesterName: peopleMap.get(instance.submittedBy)?.fullName ?? "Unknown user", route: instance.steps.map((row) => ({ stepNumber: row.stepNumber, stepName: row.stepName, status: row.status, assignedUsernameSnapshot: row.assignedUsernameSnapshot, originalApproverUsernameSnapshot: row.originalApproverUsernameSnapshot, actualApproverUserId: row.actualApproverUserId })) }, notification: null, asset: null, attachments: [], history: actions.map((action) => ({ id: action.id, action: action.action, actionByName: peopleMap.get(action.actorUserId)?.fullName ?? "Unknown user", comment: action.comment, createdAt: action.actionAt })), timeline: [], audit: [], source };
}
