# Corrective Maintenance vertical slice baseline

Baseline captured before implementation on 2026-08-01. Legacy fields are retained; target sections reorganize them without deleting source meaning.

## 1. Legacy PHP references

- Notification: `controllers/Wonof010Controller.php`, `models/Wonof010.php`, `views/wonof010/*`; severity `Wonof011`, priority `Woord012`, review `Wonof020`.
- Work order: `controllers/Woord010Controller.php`, `models/Woord010.php`, `views/woord010/*`; conversion, Open/Backlog/Execute/Closed and assigned lists.
- Job steps/checklist: `Woord020`; tools `Woord021`; completion `Woord030`; files `Woord040`/`Woord070`; stage/history `Woord050`; typed work information `Woord051`/`Woord052`; spare parts `Woord060`; labor/OT `Woman010`.
- Diagnostic masters: `Wocau010`, `Woprm010`, `Wosol010`, `Woesc010`.
- Notifications/audit: `SysNotifications`, `SysLogs`, `SysLogDetails` and their controllers/views.

## 2. Business rules

- New notification defaults to `New`, source OP and non-breakdown; asset duplicates produce a warning but are not blocked.
- Asset, subject, type, status, notification time, responsible department/person, creator and timestamps are retained from `wonof010`.
- Approval maps to `APPROVED` and conversion; rejection maps legacy `Not Approved` to `REJECTED`; backlog conversion retains a mandatory reason in the target.
- Authorized work requires an assigned technician. Work starts from Open or Backlog only.
- Completion is prohibited while any required job step/checklist item is incomplete; an empty task list remains allowed for legacy parity.
- Completion retains result, problem, cause, solution, escalation, notes, duration and photographic evidence.
- Verification must be performed by a permitted supervisor other than the completing technician. Only verified work can close.
- Every lifecycle command writes append-only work-order history and an audit event. Status is never accepted as an editable command field.
- Labor retains department/person/date/type/description, normal time and legacy OT multiplier semantics (`Normal`, 1, 1.5, 2, 3).
- Used spare parts retain sequence/item/enabled/quantity/note meaning; this slice records actual quantity and note against the work order.

## 3. Database mappings

| Legacy | Target |
|---|---|
| `wonof010` | `maintenance_notifications` |
| `wonof020` | `notification_reviews` |
| `woord010` | `work_orders` |
| `woord020` | `work_order_tasks` (`kind=JOB_STEP/CHECKLIST`) |
| `woord050` | `work_order_events` |
| `woord030`, `wocau010`, `woprm010`, `wosol010`, `woesc010` | `work_order_completions` |
| `woman010` | `work_execution_entries` |
| `woord060` | `work_order_spare_parts` + `spare_parts` |
| `woord040`, `woord070`, `pimg` | `attachments` plus attachment-ID evidence fields |
| `sys_logs/details` | `audit_logs` |
| `sys_notifications` | `notifications`, `notification_recipients` |

## 4. Prisma entities

`MaintenanceNotification`, `NotificationReview`, `WorkOrder`, `WorkOrderTask`, `WorkExecutionEntry`, `WorkOrderSparePart`, `WorkOrderCompletion`, `WorkOrderVerification`, `WorkOrderEvent`, `Attachment`, `Notification`, `NotificationRecipient`, `Asset`, `SparePart`, `Department`, `User`, `AuditLog`.

## 5. Routes

- UI: `/maintenance`.
- Intake/read: `GET /api/maintenance/overview`, `POST /api/maintenance/notifications`, `POST /api/maintenance/notifications/:id/review`, `GET /api/maintenance/work-orders/:id`.
- Commands only: `POST /api/maintenance/work-orders/:id/{start,tasks,task-status,execution,spare-parts,completion,verification,close}`.
- Evidence: `POST /api/attachments/upload`, `GET /api/attachments/:id/content`.
- Notifications/audit: `/api/notifications`, `/api/notifications/:id/read`, `/api/admin/audit-logs`.

## 6. Permissions

`VIEW_MAINTENANCE`, `CREATE_MAINTENANCE_NOTIFICATION`, `REVIEW_MAINTENANCE_NOTIFICATION`, `MANAGE_WORK_ORDERS`, `EXECUTE_WORK_ORDERS`, `VERIFY_WORK_ORDERS`, `CLOSE_WORK_ORDERS`, `VIEW_ATTACHMENTS`, `MANAGE_ATTACHMENTS`, `VIEW_AUDIT_LOGS`, `VIEW_NOTIFICATIONS`.

Route authorization is defense in depth. The centralized workflow validates the required permission again for every transition.

## 7. Acceptance tests / checklist

- [x] Reporter creates corrective notification with asset, subject/description, priority, severity, operating state, department/person, due date and photos.
- [x] Reviewer can approve-and-convert, backlog with reason, or reject; a second decision fails.
- [x] Work cannot start without current state, permission and technician assignment.
- [x] Job steps and checklist items block completion when required and incomplete.
- [x] Technician records notes, regular minutes, OT minutes/multiplier and used spare parts.
- [x] Completion records diagnostics, duration and before/after photos.
- [x] Supervisor verification/return enforces permission, state, note, completion ownership separation and completion existence.
- [x] Only verified work closes; source notification becomes completed through the workflow domain.
- [x] History timeline, audit log and in-app assignment notification are produced.
- [x] Loading, empty, error and permission-controlled actions remain responsive on mobile.
- [x] Unit workflow, service integration, permission and complete-flow E2E tests exist.
- [x] Applied migrations `0001`–`0003` and deterministic seed data to `DEV_DATABASE_URL` on 2026-08-01 using the MariaDB 5.5 compatibility runner.
