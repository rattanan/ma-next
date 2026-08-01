import { describe, expect, it } from "vitest";
import { completionSchema, executionEntrySchema, notificationReviewSchema, notificationSchema, taskSchema, verificationSchema } from "../../lib/maintenance/validation";
import { completeNotification, convertNotificationToWorkOrder, transitionNotification, transitionTask, transitionWorkOrder } from "../../lib/maintenance/workflow";

describe("E2E corrective maintenance flow", () => {
  it("reports, approves/converts, executes, verifies, and closes through commands", () => {
    const reporter = { id: "reporter", permissions: ["CREATE_MAINTENANCE_NOTIFICATION"] as never[] };
    const technician = { id: "technician", permissions: ["EXECUTE_WORK_ORDERS"] as never[] };
    const supervisor = { id: "supervisor", permissions: ["REVIEW_MAINTENANCE_NOTIFICATION", "MANAGE_WORK_ORDERS", "VERIFY_WORK_ORDERS", "CLOSE_WORK_ORDERS"] as never[] };
    const notification = notificationSchema.parse({ assetId: "11111111-1111-4111-8111-111111111111", title: "Pump seal leak", description: "Seal leak observed while pump remains degraded", priority: "HIGH", severity: "MAJOR", equipmentOperatingStatus: "DEGRADED", photoAttachmentIds: [] });
    expect(notification.type).toBe("CORRECTIVE"); expect(reporter.permissions).toContain("CREATE_MAINTENANCE_NOTIFICATION");
    const review = notificationReviewSchema.parse({ decision: "APPROVED", note: "Repair during current shift", assignedTo: "22222222-2222-4222-8222-222222222222" });
    const notificationStatus = transitionNotification("NEW", "APPROVE", { actor: supervisor, assignedTo: review.assignedTo, note: review.note });
    let orderStatus = convertNotificationToWorkOrder(notificationStatus, supervisor, { assignedTo: review.assignedTo });
    orderStatus = transitionWorkOrder(orderStatus, "START", { actor: technician, assignedTo: review.assignedTo });
    const jobStep = taskSchema.parse({ title: "Isolate and replace seal", kind: "JOB_STEP", required: true });
    const checklist = taskSchema.parse({ title: "Confirm guards fitted", kind: "CHECKLIST", required: true });
    const taskStates = [transitionTask("OPEN", "COMPLETED", technician), transitionTask("OPEN", "COMPLETED", technician)];
    expect([jobStep.kind, checklist.kind]).toEqual(["JOB_STEP", "CHECKLIST"]);
    expect(executionEntrySchema.parse({ description: "Seal replaced and aligned", minutesSpent: 90, overtimeMinutes: 30, overtimeMultiplier: 1.5, actionAt: new Date().toISOString() }).overtimeMinutes).toBe(30);
    const completion = completionSchema.parse({ result: "Restored", solution: "Replaced mechanical seal", durationMinutes: 120, beforePhotoAttachmentIds: [], afterPhotoAttachmentIds: [] });
    orderStatus = transitionWorkOrder(orderStatus, "SUBMIT_COMPLETION", { actor: technician, requiredTasks: taskStates.map((status) => ({ required: true, status })) });
    const verification = verificationSchema.parse({ completionId: "33333333-3333-4333-8333-333333333333", decision: "VERIFIED", note: "Stable after operational test" });
    orderStatus = transitionWorkOrder(orderStatus, "VERIFY", { actor: supervisor, completionExists: Boolean(completion), completionOwnerId: technician.id, note: verification.note });
    orderStatus = transitionWorkOrder(orderStatus, "CLOSE", { actor: supervisor, note: "Closed after supervisor verification" });
    expect({ notification: completeNotification(notificationStatus, supervisor), workOrder: orderStatus }).toEqual({ notification: "COMPLETED", workOrder: "CLOSED" });
  });
});
