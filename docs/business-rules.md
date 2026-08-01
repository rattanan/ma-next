# Business rules

Rules below are reconstructed from executable code. “Observed defect/ambiguity” flags behavior that should be confirmed, not reproduced automatically.

## Identity and security

1. A profile with `enbl = No` cannot log in.
2. Failed login attempts increment `user_profiles.pwic`; reaching configured `failedLoginAttempToDisable` disables the profile. Successful login resets the counter and records last sign-in.
3. If enabled, password complexity requires at least eight characters with uppercase, lowercase, numeric, and special characters.
4. Password reuse checks the current password plus a configurable number of MD5-stored historical values. The target system should not retain the legacy MD5 design.
5. Password age is configurable; an expired password redirects the user to change-password after login.
6. API keys must be unexpired. API tokens must be enabled and within `crdt + exin`; sign-out disables the token.
7. API registration assigns a default Maintenance role and default profile master IDs. Existing-user registration appears to use an uninitialized local user variable—confirm intended idempotency.

## Common record behavior

1. Most business records carry creator/modifier and created/modified timestamps.
2. Many create/copy actions default codes to `YmdHis` timestamps and default status to `New` or `Open`.
3. Many models log insert/update/delete only when a `sys_logs` row for the model is enabled.
4. Delete generally catches database exceptions and reports that related data prevents deletion; bulk delete concatenates selected IDs into SQL conditions.
5. Copy actions usually duplicate attributes, clear the ID, reset timestamps/status, and sometimes duplicate child rows/files.

## Maintenance notification and work order

1. A notification (`wonof010`) requires code, name, type, status, notification date, assignee/department context, creator/modifier, and timestamps. Defaults include `New`, notification source `OP`, and breakdown `No`.
2. Creating/updating a notification sends an in-app notification to the responsible manager derived from organizational relationships.
3. Creating from an asset warns if another `New` notification already exists for that asset, but does not block the duplicate.
4. Approving a notification sets it to `Approved` and redirects into work-order creation; rejecting sets `Not Approved`.
5. A work order defaults to `Open`; when created from a notification it inherits asset, priority, dates, reporter data, and uses `Backlog` if the notification was backlog.
6. Conversion/copy creates an open work order and an initial stage/history entry, and notifies the assignee.
7. Work-order list actions filter `Open`, `Backlog`, `Execute`, `Closed`, or current-user assignment.
8. Completion is disabled while any job step is not `Completed`. The controller also disables completion for already completed work.
9. Work order children include job steps, tools, stage/history, typed work information, labor, spare parts, completion/cause/problem/solution/escalation, and attachments.
10. Generated events can create open work orders and mark source events acknowledged.
11. Imported external status `CLOSE` is mapped through status descriptions; otherwise missing status becomes `Backlog`; `Canceled` is stored as `Cancel`.

## Alarm expert rules

1. Only enabled, `Approved` issues within their configured daily start/end time are evaluated.
2. Issues already represented by a `Problem` trigger are excluded from new-trigger selection.
3. Telemetry considered by the alarm process has status `GOOD` or `BAD`.
4. A detected condition creates/updates trigger records, inferred causes/actions/derivatives, and alarm-log snapshots; active trigger status is `Problem`.
5. When the problem condition clears, the trigger becomes `OK` and another log entry is written.
6. Operators can bulk acknowledge triggers; acknowledgment metadata is stored separately.
7. Issue creation starts as `New`; approval sends email/notifications and makes it eligible for alarm processing.
8. Issue import derives tags, issues, conditions, causes, derivatives, actions, action limits, and affected tags from staged rows. It deletes an existing issue with the same name before rebuilding it—this is destructive legacy behavior and must not be adopted without explicit product approval.
9. CBM reads current telemetry for configured asset conditions and avoids creating a duplicate unacknowledged condition event of a particular type.
10. The alarm job deletes trigger rows older than 30 days and alarm-log rows older than 90 days. Confirm whether this is approved retention policy or an implementation shortcut.

## Approval engine

1. Approval routes are configured per model name (`mdel`) as ordered `sys_approves` steps with sequence, approver, display name, and optional SQL condition.
2. Releasing a document rebuilds its live approval detail rows. The first applicable step is `Waiting`; later steps are `On Hold`.
3. Approving a waiting step advances the next on-hold step to waiting and notifies that approver.
4. When no step remains, the source document is set to `Completed`, except domain callbacks may return it if processing fails.
5. `Returned` or `Rejected` updates the approval chain and source document and notifies relevant users. Every action creates approval history.
6. Completing `whitm030`, `whitm040`, or `whitm050` invokes inventory issue, receipt, or transfer respectively; `hrreq010` invokes HR processing.
7. Completing a PO can close its linked PR if the PR is completed.
8. Approval configuration can use dynamic SQL conditions and dynamic table updates; this is a security/integrity boundary requiring redesign.

## Inventory

1. Inventory is maintained per item/location in `whinv010`; every movement is recorded in `whinv020` with quantity, unit cost, amount, source document, and original receipt/PO linkage.
2. Inbound types are `รับเข้า`, `ย้ายเข้า`, `ปรับเข้า`; outbound types are `เบิกออก`, `ย้ายออก`, `ปรับออก` and subtract quantity/value.
3. On-hand status is `REORDER` when quantity is at or below reorder level, `EXCESS` above maximum, otherwise `OK`.
4. Total item availability is the sum of on-hand quantities across locations.
5. Issue validates sufficient location on-hand before posting, then consumes available inbound lots in ascending acquisition-date order (FIFO-like costing) and increments used quantity on source lots/PO lines.
6. Transfer validates source availability, posts an outbound movement at source and an inbound movement at destination using the consumed lot cost.
7. Receipt posts each line, updates PO received quantity, and marks the PO `Received` only when every line's ordered and received quantities match; otherwise `Partial Received`.
8. Receipt notifies assignees of incomplete work orders that require the received part.
9. A scheduled classifier marks an otherwise-OK balance `SLOW MOVING` after 180 days without recent activity, `FAST MOVING` if more than 12 movements occurred in 90 days, or `EXPIRED` after the item's configured year lifetime. Precedence is effectively expired over fast/slow.
10. Observed ambiguity: receipt validation that prevents over-receipt or items absent from the PO is commented out.

## Procurement and budget

1. PR/PO line quantity, price, amount, and sequence are required/non-negative; controller logic further requires PR quantity and price greater than zero.
2. Line amount is quantity × price × currency rate; header amount is the line total, with PO discount/shipping adjustment logic applied afterward.
3. PR code is unique. New PR/PO records start `New`; `Released` starts the approval route.
4. Purchase method ID 1 permits at most THB 100,000; ID 2 requires more than THB 100,000 and at most THB 5,000,000; ID 3 requires more than THB 5,000,000; ID 4 requires at least THB 100,000. These hard-coded ID/threshold rules must be validated against current procurement policy.
5. If a PR selects a maintenance budget, its total cannot exceed `balancepending`; view also warns when total exceeds current balance.
6. A PO linked to a PR cannot exceed the PR amount (one path uses a 0.01 tolerance).
7. Creating/copying PO lines updates each item's last purchase price/date.
8. Bulk release sets `Released` and initializes approval; bulk approve sets `Approved`. The coexistence of the generic approval engine and direct bulk approval needs clarification.
9. PO receipt status is driven by inventory receipts. Completed PO approval may close the linked completed PR.
10. Observed ambiguity: PO `cancel` action sets status to `Released` and starts approval, suggesting “cancel request” rather than cancellation; the label and desired final state must be confirmed.

## Projects, sales, and supporting rules

1. Projects support hierarchical projects/tasks, board/Gantt feeds, subtasks, explicit status updates, comments, milestones, and attachments.
2. API sales orders default to status-master ID 1, timestamp codes, and zero price; line changes recalculate order price.
3. Location lookup uses province → district dependency.
4. Reports are data-driven through `sys_reports` and `sys_report_parameters`; SQL/report definitions likely live in database rows and are not fully discoverable from code.
5. System numbering can query a configured model/table and rightmost digit width; fallback stock numbering uses four digits. Concurrency handling is absent.

## HR request processing

1. Survey/form ID 100 is treated as leave and ID 108 as benefit; question IDs are also hard-coded.
2. Leave start date must be after today and end date cannot precede start date. Same-day full-day leave counts as 1 and other periods as 0.5; multi-day duration is raw day difference.
3. Leave/benefit usage cannot exceed the matching employee allowance target; final approval increments actual usage.
4. The reset job zeroes all actual usage and recalculates one leave category using profile carry-over/allowance fields. Its intended annual schedule and calculation order need confirmation.
