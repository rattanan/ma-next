# Work Order target domain model

The target extends the existing corrective-maintenance aggregate without discarding its data. `WorkOrder` remains the aggregate root; state changes are commands, never generic field patches.

## Aggregate

- `WorkOrder`: identity/code, source type and source record, work type, primary asset, title/description, priority/severity/equipment state, department/crew, assignee/lead/supervisor, vendor/customer, reported/planned/due/actual dates, estimates, checklist/template references, notes, current state and audit metadata.
- `WorkOrderAsset`: ordered primary/related/sub-assets when more than the header asset is required.
- `WorkOrderAssignment`: append-only assignment/reassignment history with department/team/user/position, effective dates and actor.
- `WorkOrderTask`: ordered Job Step or Checklist item. It retains sub-asset, assignee, dates, estimate/actual duration, result, response type/value, remarks, evidence and status.
- `WorkOrderBacklogEvent`: append-only WO or task waiting period, reason/category, entered/resumed actors and dates, expected resume and resolution.
- `WorkOrderTimeEntry`: employee/department/position/work type, work interval or minutes, OT type/minutes/multiplier and note.
- `WorkOrderMaterialTransaction`: plan/request/reserve/issue/consume/return boundary. Inventory remains an adapter; WO does not mutate stock in UI code.
- `WorkOrderToolLoan`: tool/equipment, quantity, condition, issue/return dates/status and note.
- `WorkOrderAcceptance`: operations acceptance and safety/LOTO/log/test/handover evidence.
- `WorkOrderCompletion` and `WorkOrderVerification`: immutable submitted completion and supervisor decisions.
- `WorkOrderEvent`: append-only domain timeline. `AuditLog` remains the cross-application security/compliance record.
- `Attachment`: shared file metadata/content service; WO tables store references/categories, never binaries or local paths.

## Invariants

- Work-order code and source identity are unique. Source is nullable only for manual creation.
- Current status is changed only inside the workflow service with a conditional current-state update.
- Required Job Steps/Checklist items must be complete before submission.
- Every backlog interval has a reason and is retained after resume.
- Closed work accepts no new execution, time, material, tool or attachment mutation unless an approved reopen command exists.
- Completion submitter cannot verify their own completion.
- Every command appends a domain event and audit record atomically; notification delivery is retryable.
- Legacy IDs/raw values remain available for lossless migration.

## Existing entities retained

The current `MaintenanceNotification`, `NotificationReview`, `WorkOrder`, `WorkOrderTask`, `WorkExecutionEntry`, `WorkOrderSparePart`, `WorkOrderCompletion`, `WorkOrderVerification` and `WorkOrderEvent` data are retained and extended. New tables are introduced only for concepts that cannot be represented losslessly by those entities.
