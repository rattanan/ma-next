# Workflow inventory

## 1. Maintenance notification to work order

1. User creates a `wonof010` notification, optionally against an asset and with an uploaded image.
2. Defaults are applied (`New`, timestamp code/dates, `OP`, non-breakdown), and the responsible manager is notified.
3. Manager approves or rejects. Approval marks the notification `Approved`.
4. Browser flow redirects to work-order creation; API flow creates the work order directly.
5. Work order is `Open` (or inherited `Backlog`), an initial `woord050` stage/history row is created, and the assignee is notified.
6. Work is planned/executed through steps, tools, labor, parts, stages, and attachments.
7. Completion is allowed only when all job steps are completed; completion details record cause/problem/solution/escalation and close data.

Actors: reporter, responsible manager, planner/dispatcher, assignee/technician. Unclear: exact authorization and whether approval is mandatory in every entry channel.

## 2. Preventive/condition event to work order

1. Asset/PM configuration defines future events or telemetry conditions.
2. Scheduled `genevent/index` selects due unacknowledged events of configured types.
3. It creates an open work order, child process/stage data, and user notification, then acknowledges the event.
4. Scheduled `cbm/index` independently reads telemetry and creates condition events when thresholds are met and no equivalent open event exists.

Operational dependency: external scheduler frequency and timezone are missing.

## 3. Alarm detection and recovery

1. Scheduled alarm command loads enabled, approved, in-window issue definitions without an active problem trigger.
2. It reads current telemetry and evaluates issue conditions.
3. On detection it creates a `Problem` trigger, derives likely causes/corrective actions/limits/effects, and writes an alarm log.
4. Portal monitor/summary surfaces active alarms; operators may acknowledge them.
5. Later scans re-evaluate active triggers. Cleared conditions become `OK` and create another log snapshot.

Actors: alarm administrator, operator, maintenance engineer. Integration: `dbx` telemetry.

## 4. Issue-definition import

1. User uploads/imports issue rows into `amimp010/020`.
2. Import derives missing tag/config records.
3. Existing issue definitions with matching names are deleted.
4. Issue, conditions, causes, derivatives, actions, limits, and affected tags are rebuilt.
5. New issue starts `New` and follows approval before runtime use.

Risk: destructive replacement, raw SQL interpolation, and partial updates without a visible transaction.

## 5. Inventory issue

1. User creates `whitm030` issue header and `whitm032` lines for a location.
2. Releasing builds approval steps.
3. Final approval calls `inventory::issue`.
4. All lines are checked for sufficient on-hand.
5. Each line consumes inbound lots oldest first, posts outbound ledger transactions, adjusts on-hand/value, and updates used quantity on source receipts/PO lines.
6. Success marks document `Completed`; shortage returns an error and approval logic marks it `Returned`.

## 6. Inventory receipt and PO completion

1. User creates `whitm040` receipt with `whitm042` lines, optionally referencing a PO number.
2. Final approval calls `inventory::receive`.
3. Receipt lines post inbound ledger movements using receipt price × PO currency rate when linked.
4. PO line received quantities are incremented.
5. PO becomes `Received` when every line is fully received, otherwise `Partial Received`.
6. Open work-order assignees waiting for received items are notified.
7. On-hand, value, reorder/excess state, and total item availability are updated.

## 7. Inventory transfer

1. User creates `whitm050` with source/destination locations and lines.
2. Final approval checks source stock.
3. Oldest available inbound lots are consumed.
4. Matching `ย้ายออก` and `ย้ายเข้า` ledger entries move quantity/value between locations.
5. Document becomes `Completed`, or `Returned` on insufficient stock.

## 8. Purchase request to purchase order

1. User creates a PR and lines; totals are recalculated in base currency.
2. Purchase rules and selected-budget balance are validated.
3. PR starts `New`; release changes it to `Released` and creates sequential approvals.
4. Approvers act in order (`Waiting` → next step; later steps initially `On Hold`).
5. Final approval completes/approves the PR depending on entry path.
6. A PO can be copied from the PR, preserving lines and linking `puprd010_id`.
7. PO total must not exceed PR amount; item last purchase prices are updated.
8. PO follows release/approval, then inventory receipts drive `Partial Received`/`Received`.
9. Completed linked PR may be set `Closed` when PO completes.

## 9. Generic sequential approval

1. Source document is released.
2. `sys_approves` rules for its table are evaluated in sequence, including optional SQL conditions.
3. Live `sys_approve_details` are recreated; first applicable approver waits and receives notification.
4. Approve advances; return/reject ends or resets relevant steps and notifies submitter/approvers.
5. Each decision is copied to `sys_approve_history`.
6. On final approval, a domain callback may post inventory/HR effects before the source becomes `Completed`.

## 10. Work-order CSV import

1. A file is queued through `woimp010`/system import.
2. Console `import/wo` parses the external format.
3. It maps/creates related assets and master values and converts source statuses.
4. It creates work-order rows and reports success/error counts.

Risk: the console command contains an assignment in a success check, so recorded success may not reflect actual import result.

## 11. Authentication lifecycle

1. User submits browser credentials.
2. Profile enablement is checked, then password is validated through mdm admin.
3. Failures are audited and counted; threshold disables the profile.
4. Success is audited, failure count reset, and password age checked.
5. Expired password forces change; logout is POST-only and audited.
6. Mobile/API sign-in separately validates API key then credentials and issues an expiring DB token; sign-out disables it.

## 12. Configurable dashboard/report flow

1. Administrators define tags, groups, charts, dashboards/graphics/trends, and report parameters.
2. Portal data/stream actions provide lookup and live-series endpoints.
3. Dashboard/presentation views render configured components.
4. Reports execute stored definitions with parameters and support print/export/PDF variants.

Missing: database-resident report SQL, dashboard definitions, access grants, refresh intervals, and representative outputs.

## 13. Project planning

1. Create project with status/priority/owner and optional parent.
2. Add activities or subtasks with dates/assignees; add milestones/comments/attachments.
3. Update activity status directly or through board/Gantt interfaces.
4. Portal/calendar feeds expose project/event data.

## 14. Sales order via mobile API

1. Authenticated client creates customer/order and order details.
2. New order receives timestamp code and initial status master value.
3. Line create/update/delete recalculates order price.
4. Client can change status and generate a Thai-font PDF.

