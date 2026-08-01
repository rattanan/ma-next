# Legacy Work Order analysis

Status: Phase 1 evidence baseline, 2026-08-01. No legacy source was changed.

## Sources and method

- Functional specification: `docs/NEXIF_FDS_MA_v1.docx`, especially §§2.2.3–2.2.5 and flowcharts §§4.3–4.5 (rendered and visually checked, 56 pages).
- Legacy application: `aes02` (the physical repository corresponding to the specification's logical `legacy-php` path).
- Source inspected: Yii controllers, ActiveRecord models/search models, views, API controllers, import component, PM generator, print templates, notification/audit models, inventory/expense links, and bundled SQL dumps.
- Search vocabulary included Work Order/WO, Sub Work/Job Step, checklist, backlog, completion, man-hour/OT, spare parts, tool/equipment, LOTO, log sheet, test result, handover, PM/CM/shutdown/other assignment.
- The legacy repository was clean before analysis. Database triggers and stored procedures could not be established from application source; see `work-order-unknowns.md`.

## Functional surface discovered

| Area | Principal evidence | Observed behavior |
|---|---|---|
| Work-order register | `Woord010Controller`, `Woord010`, `Woord010Search`, `views/woord010/*` | Lists all, Open, Execute, Backlog, Closed and assigned-to-current-user records; supports filter/search, view, create, copy, update, delete and bulk delete. Completed records cannot be deleted through the web controller. |
| Creation sources | `Woord010Controller::actionCreate/actionConvert`, `NotificationController::actionApprove`, `Wopvm010Controller`, `components/importwo.php` | Manual; notification conversion; PM event generation; shutdown/project task conversion; spreadsheet import. FDS also states approved notifications convert to WO. |
| Header/planning | `Woord010`, `_form.php` | Code, source notification, asset, title, status, type, reporter/contact/date, scheduled start, estimate/actual time, responsible employee/lead/department, completion identity/date, vendor/customer, priority, checklist, expense and note. |
| Job steps | `Woord020Controller`, `Woord020`, `views/woord020/*` | Per-WO sub-work with sub-asset, action, assignee, due date, estimate, actual time, result, note, status and attachment; create/update emits assignee notification. |
| Related tools/assets | `Woord021` and views; `Woord060Controller::actionAddtool` | A legacy tool relation exists in `woord021`; another UI path reuses `woord060` for tools. The authoritative split is unclear. |
| Spare parts/material | `Woord060`, `Woord060Controller`, `Woord010Controller::actionPrintstock`, completion controller | Sequence, inventory item, enabled flag, quantity and note. Completion calculates material expense from price × quantity. Actual inventory deduction code is commented out. |
| Man-hour/OT | `Woman010`, `Woman010Controller`, work-order and completion views | Department, action date, type, WO, asset, description, employee, position, OT type, execution time, note and audit fields. Bulk entry can pre-populate active employees. |
| Stage/history | `Woord050Controller`, `Woord050`, `_woord050.php` | Appends stage/result, actor and date. Stage submission also writes the WO status directly and replaces typed stage information in `woord051`. |
| Stage-specific information | `Woord051`, `Woord052` | Configurable information categories by stage; name, description/value, information date, type and optional file. |
| Completion | `Woord030Controller`, `Woord030`, checklist responses | Requires WO, completed by/date, result and duration. Captures problem/cause/solution/escalation/note, checklist answers, attachments, labor, material and expense; then directly sets WO and source notification to Completed. |
| Files/images | `Woord040`, `Woord051`, `Woord070` controllers/models/views | Several overlapping attachment models. Files are stored under `web/images/uploads`; common limits are 5 MB, while `Woord051` accepts media up to 30 MB despite a stale 5 MB error string. JPG/PNG uploads in one path are watermarked with WO code. |
| Audit/notifications | ActiveRecord hooks, `SysLogDetails`, `SysNotifications` | CRUD hooks write insert/update/delete audit records only when the model's `SysLogs.enbl` is Yes. Creation/update/completion/job-step actions create in-app notifications. Import writes a summary audit row. |
| Print/report | `print.php`, `printview.php`, `printtool.php`, `printstock.php` | Register and detail printing, equipment/tool loan form and material issue form. No confirmed CSV/PDF export service was found for WO. |
| Mobile API | `modules/api/controllers/WorkController.php`, `NotificationController.php` | Token-protected list/view/create/update/delete and upload. API list restricts WO to creator or assignee, but create/update trusts actor IDs supplied in payload after token validation. |

## Confirmed creation mappings

### Manual

`woord010/create` defaults status Open, reporter/contact from current profile, reported and scheduled timestamps to now, checklist ID to 1, and audit identity to current user. The model replaces the timestamp-style provisional code with a `SysCodes` running number when configured. Creation appends an Open process row and notifies the assigned employee.

### Approved notification

Web conversion copies asset, notification ID, title, priority, due date, reporter/contact/date, work type, department and the first reviewer/assignee row; an incoming Backlog notification creates a Backlog WO, otherwise Open. The notification receives the WO foreign key. The API has a second conversion implementation with materially different defaults and apparent wrong-ID references; it is recorded as a defect candidate, not a rule.

### Preventive event

`Wopvm010Controller` creates an Open Preventive WO from event asset/name/priority/event dates/description, derives estimate from the event interval, uses the asset assignee, department and PM checklist, copies job steps and stage information, appends Open history and notifies the assignee.

### Shutdown/project

`woord010/convert` maps a project task to an Open `SD Work` WO, copies title/description/asset/assignee, and links the task back to the WO. WO completion advances the linked project task and may complete its parent project when no unfinished/non-cancelled tasks remain.

### Spreadsheet import

`components/importwo.php` imports Sheet1 columns Work Order, Location Description, Title, Work Type, Crew, Lead Name, Location, Status, Scheduled Start, Reported By, Reported Date, Highlight, Priority and Remark. It upserts by WO code, creates missing assets and departments, maps CM/PM/other types, defaults unknown priority to ID 3, maps high-numbered status masters to Backlog, and writes an import log. Missing reporter defaults to user ID 1. These permissive fallbacks require confirmation before migration.

## Workflow evidence and contradictions

The FDS defines Open → Prepare → Execute → Record → approval → Complete, with rejection returning to Record. The PHP exposes Open/Execute/Backlog/Closed list routes, but uses both `Completed` and `Closed` values. `Woord050Controller` accepts an arbitrary posted stage and directly copies it to `woord010.stat`; `Woord030Controller` directly completes the WO without a confirmed supervisor approval gate. Thus the FDS is the stronger evidence for the required approval stage, while exact deployed status values and permissions remain unresolved.

## Legacy defects and risky behavior (do not preserve blindly)

- Status can be directly edited or copied into the header, bypassing transition validation.
- Completion is a multi-record operation without an encompassing transaction and uses `die()` on some failures.
- `Woord030Controller` saves man-hour rows twice.
- Completion reduces contract availability and creates material expense, but stock deduction is commented out.
- `NotificationController::actionApprove` appears to use the notification-review ID where the newly created WO ID is required and references fields on the wrong model.
- `Woord010Controller::actionCreate` may reference `$wonof010` when manual creation did not initialize it.
- Stage submission calls `Woord051::deleteall` (case/implementation requires runtime confirmation), replacing information rather than retaining history.
- API token validation is not equivalent to per-action permission and actor IDs are supplied by the client.
- File validation messages and actual limits disagree; files are stored in a public application directory.

## Phase 2 functional baseline

The replacement must retain every confirmed field and behavior while reorganizing UX. It must support all five creation sources, configurable WO types, header/planning fields, multiple assignments where FDS requires them, job steps/checklists, backlog reasons, tools/loans, materials/issues, labor/OT, stage-specific execution records, LOTO/log/test/handover evidence, completion diagnostics, approval/rework, audit/history, notifications and legacy print outputs. Status mutations must be centralized; observed direct-write behavior is evidence of intent, not an implementation pattern.

Items with conflicting or incomplete evidence are explicitly listed in `work-order-unknowns.md` and tagged `NEEDS_CONFIRMATION` in traceability.
