# Work Order database mapping

Status: logical mapping reconstructed from Yii ActiveRecord, relations, views and SQL references. Column types not expressed by ActiveRecord are `NEEDS_CONFIRMATION` against the production schema.

## Core tables

| Legacy table | Purpose and confirmed fields | Relationships / target mapping |
|---|---|---|
| `woord010` | WO header: `id`, `code`, `wonof010_id`, `asast010_id`, `dsca`, `stat`, `type`, `nfnm`, `teln`, `nfdt`, `dudt`, `estm`, `sptm`, `asto`, `leadby`, `hrdpt010_id`, `cldt`, `clby`, `whvnd010_id`, `slcus010_id`, `woord011_id`, `woord012_id`, `slsuv010_id`, `expn`, `note`, `crby/lmby/crdt/lmdt` plus model-observed vendor/crew fields. | Asset, notification, priority, backlog master, department, assigned/lead/completing users, vendor/customer, checklist. Target: extend `WorkOrder`; do not drop legacy fields. |
| `woord011` | Backlog/status-reason master: `id`, unique `name`, `dsca`. | Referenced by `woord010.woord011_id`; target configurable backlog/status reason entity. |
| `woord012` | Priority master: `id`, unique `name`, `dsca`. | Notification and WO priority; target should not lose source master IDs/labels. Current target enum is insufficient for lossless migration unless legacy-value mapping is stored. |
| `woord020` | Job step/sub-work: `id`, `code`, `woord010_id`, `asast010_id`, `name`, `asto`, `dudt`, `estm`, `sptm`, `resl`, `note`, `type`, `stat`, `pimg`. | Target `WorkOrderTask` lacks sub-asset, due date, estimates/actuals, result, note and attachment linkage. |
| `woord021` | WO tool relation: `id`, `woord010_id`, `asast010_id`, `note`. | Target `WorkOrderTool/EquipmentLoan`; no current target entity. |
| `woord030` | Completion: `id`, `woord010_id`, `woprm010_id`, `wocau010_id`, `wosol010_id`, `woesc010_id`, `sptm`, `clby`, `cldt`, `name`, `stat`, `note`. | Target `WorkOrderCompletion`; retain master-data foreign keys as well as display text/snapshots. |
| `woord040` | Generic file: `id`, `name`, `pimg`, `woord010_id`, `note`. | Target `Attachment` plus WO association/category. Overlap with `woord051/070` requires migration discrimination. |
| `woord050` | Process/history: `id`, `woord010_id`, `stat`, `clby`, `cldt`, `name`, `note`. | Append-only target `WorkOrderEvent`; legacy rows may be mutable/deletable, so migration provenance is required. |
| `woord051` | Typed information/document: `id`, `name`, `dsca`, `acdt`, `woord052_id`, `woord010_id`, `pimg`. | Target execution information/document value. Current `Attachment` alone cannot represent text values and stage type. |
| `woord052` | Information type master: `id`, unique `name`, `dsca`, `stat`. | Stage-specific configurable field/document category; target master entity needed. |
| `woord060` | WO item/tool: `id`, `seqn`, `woord010_id`, `whitm010_id`, `enbl`, `qnty`, `note`. | Target `WorkOrderMaterial`/`WorkOrderSparePart`; preserve planned/enabled semantics and distinguish alternate tool UI. |
| `woord070` | Attachment/image: `id`, `woord010_id`, `name`, `pimg`, `note`. | Target `Attachment` association; preserve source table and legacy path. |
| `woman010` | Labor: `id`, `hrdpt010_id`, `acdt`, `type`, `woord010_id`, `asast010_id`, `dsca`, `asto`, `hrpos010_id`, `othr`, `amount`, `note`, `crby/lmby/crdt/lmdt`. | Target `WorkExecutionEntry` currently lacks department, asset, work type, position and raw legacy OT value. |

## Source and integration tables

| Legacy table/entity | WO relationship | Target requirement |
|---|---|---|
| `wonof010`, `wonof020` | Source notification, approval/review and reverse WO link. | `MaintenanceNotification`, `NotificationReview`; preserve source code/status/reviewer history and conversion idempotency. |
| `wopvm010/020/021/022/023` and event records | PM templates, generated events, steps and documents copied into WO. | PM source reference and snapshots of generated instructions/documents. Current corrective-only entities do not cover this. |
| `pjprj010`, `pjprj020` | Shutdown/outage project/task; task links to WO and completion rolls up project state. | Source polymorphism or explicit shutdown-task link plus completion side effect. |
| `asast010` | Primary and job-step sub-assets; asset owner may become assignee. | `Asset`; preserve legacy ID/code and relationship cardinality. |
| `whitm010` | Inventory/spare item, price and unit. | `SparePart`/inventory adapter; price snapshot and stock transaction behavior must be confirmed. |
| `whinv020` | Inventory transactions related to WO in model relations. | Material issue adapter and immutable issue transaction. Exact legacy write path is `NEEDS_CONFIRMATION`. |
| `fnact020`, `fnact021`, `fnact010` | WO expenses, material expense category 3, other expenses category ≥4 and asset account. | WO expense entity/integration; retain category/operator/amount/contract reference. |
| `ascnt010` | Contract availability reduced by completion expenses referencing a contract. | Contract adapter plus atomic availability update; calculation/unit requires confirmation. |
| `slsuv010/020/030` | Checklist master/questions/responses tied to completion. | Checklist template, question snapshot and response entities. Current generic tasks cannot losslessly migrate answer types/notes. |
| `user_profiles`, `hrdpt010`, `hrpos010` | Reporter, assigned person, lead, department, position, completer and auditors. | User/Department plus employee/position snapshot and legacy identifiers. |
| `sys_codes` | Generates sequential WO/job-step codes. | Central code allocator preserving configured prefix/sequence and concurrency rules. |
| `sys_notifications` | In-app event recipient/message/read status. | `Notification` and `NotificationRecipient`. |
| `sys_logs`, `sys_log_details` | Per-model audit enable switch and CRUD/import log. | `AuditLog`, legacy audit migration and always-on domain event policy. |

## Completion diagnostics masters

`woprm010` (problem), `wocau010` (cause), `wosol010` (solution), and `woesc010` (escalation) are configurable legacy master entities referenced by foreign key. Target text-only completion columns cannot preserve master identity; add master references or a stable legacy-key mapping in Phase 3.

## Current Prisma entities found

`MaintenanceNotification`, `NotificationReview`, `WorkOrder`, `WorkOrderTask`, `WorkExecutionEntry`, `WorkOrderCompletion`, `WorkOrderSparePart`, `WorkOrderVerification`, `WorkOrderEvent`, `Attachment`, `Notification`, `NotificationRecipient`, `Asset`, `SparePart`, `Department`, `User`, `AuditLog`.

They cover the corrective slice but not the full Phase 2 baseline. Missing or incomplete concepts include manual/PM/shutdown source polymorphism, legacy type/priority masters, multiple assignments/history, job-step sub-assets and timing/results, checklist question responses, backlog history/reasons, stage-specific information, equipment loan, material issue, expenses/contracts, execution acceptance/LOTO/log/test/handover, report metadata and lossless legacy attachment provenance.

## Migration requirements

- Add `legacy_id`, `legacy_source_table`, legacy code and raw-value columns/mapping tables where normalization would otherwise lose information.
- Migrate header and child records in referential order; quarantine or report orphan foreign keys rather than silently discarding them.
- Map both `Completed` and `Closed` only after production value profiling and owner approval.
- Preserve timestamps and actors exactly; do not synthesize current user for historical rows.
- Store file hash, original path/name, MIME, size, category and migration outcome; never treat the legacy public path as the target storage design.
- Reconcile duplicate attachment representations and distinguish planned versus actually issued material.
- Use idempotent source keys and an auditable reconciliation report.
- Current Prisma migration state is pre-existing application work, not proof that the complete legacy WO data model is migrated.

## Database objects not confirmed

Application source and bundled dumps did not establish authoritative production triggers, stored procedures, constraints, collations or row counts. Obtain a schema-only production-compatible dump and metadata queries before approving a migration design (`NEEDS_CONFIRMATION`).
