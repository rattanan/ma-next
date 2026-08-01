# Work Order unknowns and confirmation register

No item below may be resolved by invention. “Owner” identifies the evidence needed, not an assigned individual.

| ID | Priority | Unknown / conflict | Evidence observed | Required confirmation / owner |
|---|---|---|---|---|
| WO-U01 | Blocker | Exact deployed status vocabulary and terminal semantics. | FDS: Open/Prepare/Execute/Record/approval/Complete. PHP: Open/Execute/Backlog/Completed; route/menu also Closed; import has Cancel/Canceled mappings. | Profile production distinct values and get process-owner decision on mapping, including cancellation. |
| WO-U02 | Blocker | Final completion approval and separation of duties. | FDS requires approve/reject; PHP completion directly sets Completed. | Maintenance governance owner confirms authoritative process, approver roles and self-approval rule. |
| WO-U03 | Blocker | Full authorization matrix and data scope. | No WO controller RBAC; API token only; `auth_assignment` exists. | Security owner supplies production RBAC exports, menu rules, site/org/department scope and API identities. |
| WO-U04 | High | Backlog scope/cardinality/resume. | Header has one required master reason; FDS says work-step reasons can be unlimited. | Process owner provides examples and resume target/aging/SLA rules. |
| WO-U05 | High | Manual create eligibility and required fields by type. | PHP model has common required fields; FDS lists broader fields. | Type-specific form/rule workshop plus real record samples. |
| WO-U06 | High | Source-state prerequisites and duplicate prevention for notification/PM/shutdown/import. | Conversion paths differ; API approve has defects; source uniqueness not universal. | Confirm source state machines and idempotency keys. |
| WO-U07 | High | Multiple technician/team/supervisor assignment and reassignment history. | Header has assignee/lead/department; FDS says team/person; target slice has one assignee. | Workforce owner confirms cardinality, effective dates, skill rules and notifications. |
| WO-U08 | High | Tool/equipment authoritative tables and loan lifecycle. | `woord021` tool relation; `woord060/addtool`; FDS has loan form/fields. | Store/tool custodian validates issue/return fields, quantities, approvals and source data. |
| WO-U09 | Blocker | Material issue and stock deduction. | Material expense calculated; stock deduction commented; `whinv020` relation exists. | Inventory owner identifies actual issuing workflow, transaction boundaries, reservation/reversal and negative-stock rules. |
| WO-U10 | High | Expense and contract calculations. | Completion subtracts `fnact020.amnt` from `ascnt010.avai`; material uses current item price. | Finance/contract owner confirms currency, price snapshot, tax, availability unit, concurrency and reversal. |
| WO-U11 | High | Man-hour/OT values and validation. | `woman010.othr` is raw text; UI suggests Normal/OT variants; current target assumes multipliers. | HR/payroll owner provides categories, multiplier mapping, rounding, limits and cross-midnight rules. |
| WO-U12 | High | Checklist answer types and template versioning. | `slsuv020/030` stores required questions, response strings (arrays joined by `|`) and notes. | Checklist owner supplies question types/options and historical template-version rules. |
| WO-U13 | High | Execute/Accept Execution information schema. | FDS mentions acceptance, LOTO, log, test and handover; `woord051/052` is generic stage data. | Safety/operations owner maps each field/category, required conditions and approvals. |
| WO-U14 | High | Attachment categories, duplication and retention. | `woord040`, `woord051`, `woord070`, `pimg`; limits and extensions differ. | Records/security owner defines canonical categories, legal retention, malware scanning, max sizes and video support. |
| WO-U15 | Medium | Image watermark requirement. | One upload path watermarks JPG/PNG with WO code. | Operations/legal confirms whether to reproduce and on originals or derivatives. |
| WO-U16 | High | Report layouts, numbering and signatures. | Multiple HTML templates and manual approval signatures; FDS names forms without exact samples. | Report owners approve golden samples and digital/manual signature policy. |
| WO-U17 | Blocker | Production schema objects and data quality. | ActiveRecord and old SQL dumps only; triggers/procedures/constraints not authoritative. | DBA supplies schema-only dump, triggers/routines, row counts, distinct values, orphan/duplicate reports. |
| WO-U18 | High | Tenant/organization/site isolation. | Existing MA Next platform is organization-aware, legacy WO query scope is not explicit. | Product/security owner defines tenancy keys and cross-site access. |
| WO-U19 | Medium | Timezone/date precision/locale. | PHP uses server `date()`, SQL `now()`, mixed Excel/date formats; target uses JS dates. | Platform owner confirms Asia/Bangkok storage/display, DST assumptions and import formats. |
| WO-U20 | Medium | Code generation concurrency and legacy preservation. | `SysCodes` running helper plus timestamp provisional codes/imported external codes. | DBA/process owner confirms prefixes, reset cadence, gaps and collision handling. |
| WO-U21 | High | Delete/archive/correction policy. | Web blocks Completed deletion; API deletes without guard; child rows have generic delete. | Records owner confirms hard delete, archive, correction/version and reversal rules by state. |
| WO-U22 | Medium | Notification recipient/event templates and delivery channels. | PHP sends selected in-app messages; FDS does not fully specify recipients. | Process owner approves event-recipient matrix, escalation and retry behavior. |
| WO-U23 | High | PM scheduled-job execution and missed-event handling. | PM generation exists in controller/command; exact production scheduler not found. | Operations/DevOps provides cron configuration, idempotency and catch-up rules. |
| WO-U24 | High | Legacy API compatibility/deprecation. | Mobile clients may rely on `/api/work` payload/status behavior. | Integration owner inventories clients and decides compatibility facade/cutover. |
| WO-U25 | High | Current MA Next corrective slice disposition. | Existing schema/routes/services/tests implement a narrower state model and omit many legacy fields. | Architecture/product decides extension/migration path; do not mark full WO complete from current checklist. |

## Suspected defects requiring disposition

- Wrong work-order/history IDs and model references in API notification approval.
- Possible uninitialized `$wonof010` on manual web creation.
- Duplicate man-hour save loop in completion.
- Non-transactional multi-entity completion and `die()` error handling.
- Inconsistent Completed/Closed/Complete labels.
- API create/update/delete authorization and direct status manipulation.
- Attachment size error text contradicting configured size.
- Imported WO assignee appears set from reporter while lead uses the resolved lead employee.

For each, choose: reproduce as required behavior, correct with approved migration/compatibility handling, or retire with evidence. Default is not to preserve a defect.

## Exit criteria for Phase 3 design

Block schema/workflow approval until WO-U01, U02, U03, U09 and U17 are resolved. Other high items may be staged only if their fields and raw legacy values are preserved losslessly and the missing behavior is not falsely marked complete.
