# Work Order acceptance checklist

Updated 2026-08-01. Automated means covered by a committed unit, permission, integration or E2E scenario; business acceptance still requires a representative migrated record in DEV.

## Automated and implementation acceptance

- [x] Search by WO number, title and asset; filter by type/status/priority/department/assignee/overdue; sort and paginate.
- [x] Responsive list cards plus board and calendar views with loading, empty, error and permission-aware actions.
- [x] Create a manual Work Order with legacy planning/header fields and create from an approved Notification.
- [x] Reject unapproved Notification conversion and reject direct status PATCH.
- [x] Assign/reassign a technician with append-only assignment history and server permission enforcement.
- [x] Central workflow validates current state, permission, mandatory data and transition rules.
- [x] Start, backlog with mandatory reason, resume with resolution, submit completion, verify/return and close through named commands.
- [x] Job Steps and Checklist items support required flags, response types, evidence references, result, actual duration and dedicated backlog history.
- [x] Labor records include department, employee, position/work type, normal minutes, overtime minutes/type and work date.
- [x] Material transactions include requested/reserved/issued/returned/consumed, warehouse, storage location, unit and reference document through a record-only Inventory adapter.
- [x] Equipment/tool planning, issue, return and close-time outstanding-tool validation.
- [x] Attachment service integration for documents and before/after completion photos; no binary data in WO tables.
- [x] Operations acceptance, Safety/LOTO, permit, isolation, test, log sheet and handover fields.
- [x] Completion mandatory checks, supervisor verification/rework, closure and append-only audit/timeline.
- [x] Mobile execution controls and truthful online-connection limitation message.
- [x] Prisma generation, strict typecheck, lint, unit/permission/E2E suite and production build pass.
- [x] Migration 0004 and deterministic seed applied using `.env` `DEV_DATABASE_URL`.

## Business acceptance / NEEDS_CONFIRMATION

- [ ] Confirm the exact legacy status-label mapping and whether reopen after closure is permitted.
- [ ] Confirm overlap, edit/delete and approval rules for labor and overtime records.
- [ ] Connect the adapter to the Inventory immutable ledger and confirm reservation/issue/return costing rules.
- [ ] Approve redesigned WO detail, tool-loan and material-issue print layouts/signature blocks against representative legacy outputs.
- [ ] Confirm authoritative legacy tool-loan storage and any borrower/clearance fields not present in the discovered tables.
- [ ] Confirm tenant/organization scope rules; the current schema follows the existing application scope model.
- [ ] Run opt-in service integration tests against a disposable migrated `TEST_DATABASE_URL`.
- [ ] Execute stakeholder mobile acceptance on a real camera-enabled device.
