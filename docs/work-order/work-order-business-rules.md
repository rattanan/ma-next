# Work Order business rules

Status labels: **Confirmed** means directly supported by PHP/FDS; **FDS** means specified but not fully enforced in the inspected PHP; **Observed** means current PHP behavior that may include defects; **NEEDS_CONFIRMATION** means evidence conflicts or is incomplete.

## Creation and identity

1. **Confirmed:** A WO can originate manually, from an approved maintenance notification, a PM event, a shutdown/project task, or spreadsheet import.
2. **Confirmed:** Work types include Preventive, Corrective, Shutdown/`SD Work`, and Other Assignment/`Other Assign`; spelling variants must be mapped without losing the original value.
3. **Confirmed:** `code`, title, creator/updater identities and timestamps, status and priority are mandatory at the legacy model layer; a configured `SysCodes` record replaces provisional timestamp codes.
4. **Confirmed:** Manual WOs default to Open and initialize reporter/contact and dates from the signed-in profile/current time.
5. **Confirmed:** Notification conversion carries source notification, asset, title, priority, required date, reporter/contact/date, work type, department and assignee; source notification receives the created WO link.
6. **FDS:** Only an approved notification converts to a WO. The web `actionCreate?id=` itself does not independently prove the approval precondition; enforce it in the target command and idempotently prevent duplicate conversion.
7. **Confirmed:** PM generation copies event/template steps and documents and creates Open history/notification.
8. **Observed:** Import creates missing assets/departments and defaults missing reporter/priority/status values. This is permissive data-loading behavior, not approved interactive-create behavior (`NEEDS_CONFIRMATION`).

## Header and planning

9. **Confirmed:** No legacy field may be removed. Preserve source, primary/related asset, title/description, priority, type, equipment state where present upstream, department/crew, responsible/lead/assigned users, supervisor where specified, vendor/manufacturer/customer, requested/reported/scheduled/due/completion dates, estimated/actual duration, checklist, expense and notes.
10. **FDS:** One WO has a primary asset and may have sub-assets through job steps.
11. **FDS:** Department/crew, responsible person, vendor/manufacturer, notes and checklist are planning inputs.
12. **Confirmed:** Search supports exact/partial header filters and created/scheduled date ranges; overdue means due before database `now()` and status Open or Execute; high priority means priority ID 1 and status Open or Execute.
13. **Confirmed:** Assigned list includes WOs assigned to the current user. Mobile API list includes records created by or assigned to the supplied user.

## Workflow and backlog

14. **FDS:** Canonical process is Open → Prepare → Execute → Record → approval → Complete. Rejection returns the creator to Record/edit.
15. **Confirmed:** Legacy UI separately lists Open, Execute, Backlog and Closed; completion code sets `Completed`. Exact normalization of Closed/Completed is `NEEDS_CONFIRMATION`.
16. **Confirmed:** Every creation and recorded stage appends a process/history row containing stage, actor, timestamp and result/note.
17. **Confirmed:** Backlog status requires `woord011_id` at model validation time. The master holds name and description.
18. **FDS:** Backlog can be recorded per work step with multiple/unlimited reasons. The PHP header supports one current reason. Required cardinality and resume behavior are `NEEDS_CONFIRMATION`.
19. **Target requirement:** Status is command-only. A transition validates current state, permission, mandatory data and transition rules, then atomically writes status, history, audit and notifications. Direct status editing is forbidden even though legacy allows it.
20. **Confirmed:** Completed WOs cannot be deleted through the web controller. API and child CRUD are less restrictive; target deletion/archive policy is `NEEDS_CONFIRMATION`.

## Assignment and job steps

21. **Confirmed:** WO stores department, primary assignee and lead. FDS calls for responsible team/person and sub-work assignees.
22. **FDS:** Job step stores parent WO, sub-asset, instruction/action, assignee, due date, estimated and actual duration, result, note and attachment.
23. **Confirmed:** A new job step defaults Open and inherits WO asset, estimate, assignee and due date in the single-create path.
24. **Confirmed:** Job-step create/copy/update notifies its assignee.
25. **Confirmed:** WO completion UI is disabled when any job step is not Completed; an empty job-step set does not block completion.
26. **NEEDS_CONFIRMATION:** Multiple WO-level technicians, reassignment history, assignment date and skill enforcement are called for by Phase 2 but are not represented cleanly in inspected `woord010`.

## Checklist, labor, material and tools

27. **Confirmed:** Required checklist questions must have non-empty responses before completion; response and per-question note are saved.
28. **Confirmed:** Labor requires department, action date, work type, employee, position, execution time and audit identity; WO and asset may be inherited. OT is stored as a raw category/value (`othr`).
29. **NEEDS_CONFIRMATION:** Valid OT categories/multipliers and maximum/rounding rules must be profiled from master/UI/data; current target assumptions must not replace legacy values silently.
30. **Confirmed:** Material lines require WO, item, enabled flag and numeric quantity; completion includes only enabled lines when calculating material expense as current item price × quantity.
31. **Observed:** Stock deduction is commented out in completion. Determine whether inventory is issued elsewhere (`whinv020`) before implementing stock mutation.
32. **Confirmed:** FDS requires equipment loan and goods/material issue records and printable forms. Tool relations exist in both `woord021` and the `woord060/addtool` UI; authoritative storage is `NEEDS_CONFIRMATION`.
33. **Confirmed:** Other WO expenses are loaded for categories ≥4. Completion creates material expense category 3 and reduces referenced contract availability by expense amount.
34. **NEEDS_CONFIRMATION:** Currency, tax, negative availability, concurrency and reversal rules for expense/contract updates.

## Execution acceptance and completion

35. **FDS:** Prepare captures materials, tools/equipment, expenses, labor and attachments.
36. **FDS:** Execute includes acceptance details/date/note and, as applicable, LOTO/Fast Tag, Log Sheet, Job Steps, Test Run/Result and Hand Over.
37. **FDS:** Record includes breakdown event, damage detail, expense and work procedure, then requires approval.
38. **Confirmed:** Completion record requires WO, completed-by/date, result and duration; optional diagnostic masters include problem, cause, solution and escalation, with note.
39. **Confirmed:** Completion also saves attachments, checklist responses, man-hour, enabled material and expenses, copies duration/completer/date to the header, appends Completed history and completes the source notification.
40. **Confirmed:** Shutdown task completion advances its task and may roll up the parent project when no unfinished/non-cancelled tasks remain.
41. **FDS:** Supervisor approval is mandatory before final Complete; rejected completion returns to Record. The inspected completion controller bypasses this gate, so the target must implement the FDS rule unless business owners explicitly supersede it.

## Attachments, audit, notifications and reports

42. **Confirmed:** Preserve document name/description, category/type, information/document date, file name/path and WO association. Supported legacy extensions vary by table; max sizes are 5 MB or 30 MB depending on path.
43. **Observed:** Some JPG/PNG uploads are watermarked with the WO code. Confirm whether watermarking is legally/operationally required.
44. **Confirmed:** Model CRUD audit occurs only when that model is enabled in `sys_logs`; process history is separate. Import adds a summary audit record.
45. **Target requirement:** Domain commands always create immutable audit and workflow events even when migrating legacy rows whose model logging was disabled.
46. **Confirmed:** WO creation/update/completion and job-step creation/update generate in-app notifications to assignee/reporter as applicable.
47. **Confirmed:** Preserve register/detail printing, equipment/tool loan form and material/stock issue form, including approval signature areas where present.
48. **NEEDS_CONFIRMATION:** Exact authorization, notification recipients/templates, report numbering/layout, timezone, locale and retention behavior.
