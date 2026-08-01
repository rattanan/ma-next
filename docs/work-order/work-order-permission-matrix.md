# Work Order permission matrix

## Legacy authorization evidence

- Standard Work Order web controllers define verb filters but no controller-level `AccessControl`/RBAC rules.
- Authentication appears global through the application shell/session. Menu visibility or Yii auth assignments may constrain navigation, but no reliable per-action permission mapping was found.
- Mobile API endpoints validate a token. They do not demonstrate action-specific roles, and some accept actor IDs from payload/query.
- Audit actors are usually the signed-in profile, except import defaults to user 1 and API payloads may nominate IDs.

Therefore all legacy roles below are inferred from workflow responsibility/FDS and are `NEEDS_CONFIRMATION`; absence of a PHP check is not authorization to grant access.

## Candidate role-to-function matrix

Legend: R = read, C = create/command, A = approve/verify, M = master/admin, — = no presumed access, ? = confirmation required.

| Function | Reporter/requester | Planner/maintenance engineer | Technician | Supervisor/approver | Storekeeper | Admin/import | System job |
|---|---:|---:|---:|---:|---:|---:|---:|
| List/view WO | R? | R | R assigned? | R | R material scope? | R | — |
| Manual create/copy | C? | C | C? | C? | — | C | — |
| Convert approved notification | — | C | — | C? | — | — | C? |
| Generate PM WO | — | C | — | — | — | — | C |
| Convert shutdown task | — | C | — | C? | — | — | C? |
| Import WOs | — | — | — | — | — | C | — |
| Edit header/planning | — | C | — | C? | — | M | — |
| Assign/reassign | — | C | — | C? | — | M | — |
| Move/resume backlog | — | C | C? | C? | — | M | — |
| Add/update job steps | — | C | C assigned? | C? | — | M | — |
| Record execution/checklist | — | R/C? | C | R | — | M? | — |
| Record man-hour/OT | — | C? | C own? | C? | — | M | — |
| Plan material/tool | — | C | R | R | C? | M | — |
| Issue material / equipment | — | R | R | R | C | M | — |
| Accept execution / LOTO | — | C? | C | C? | — | M? | — |
| Submit completion | — | R/C? | C | C? | — | M? | — |
| Approve/reject completion | — | — | — | A | — | M? | — |
| Delete non-completed WO | — | C? | — | C? | — | M | — |
| Print/export | R? | R | R assigned? | R | R material forms | R | — |
| Configure reasons/priorities/info types | — | — | — | — | — | M | — |
| View audit/history | R own? | R | R assigned? | R | R material scope? | R | — |

## Proposed atomic permissions

Names are design candidates for Phase 3, not confirmed legacy labels:

- `WORK_ORDER_READ`, `WORK_ORDER_READ_ALL`
- `WORK_ORDER_CREATE`, `WORK_ORDER_CREATE_FROM_NOTIFICATION`, `WORK_ORDER_GENERATE_PM`, `WORK_ORDER_CREATE_SHUTDOWN`, `WORK_ORDER_IMPORT`
- `WORK_ORDER_PLAN`, `WORK_ORDER_ASSIGN`, `WORK_ORDER_BACKLOG`
- `WORK_ORDER_STEP_MANAGE`, `WORK_ORDER_EXECUTE`, `WORK_ORDER_LABOR_RECORD`
- `WORK_ORDER_MATERIAL_PLAN`, `WORK_ORDER_MATERIAL_ISSUE`, `WORK_ORDER_TOOL_LOAN`
- `WORK_ORDER_COMPLETE`, `WORK_ORDER_VERIFY`, `WORK_ORDER_CLOSE`, `WORK_ORDER_CANCEL`
- `WORK_ORDER_DOCUMENT_MANAGE`, `WORK_ORDER_REPORT_PRINT`, `WORK_ORDER_AUDIT_READ`, `WORK_ORDER_MASTER_MANAGE`

## Current MA Next permissions found

`VIEW_MAINTENANCE`, `MANAGE_WORK_ORDERS`, `EXECUTE_WORK_ORDERS`, `VERIFY_WORK_ORDERS`, `CLOSE_WORK_ORDERS`, `CREATE_MAINTENANCE_NOTIFICATION`, `REVIEW_MAINTENANCE_NOTIFICATION`, `VIEW_ATTACHMENTS`, `MANAGE_ATTACHMENTS`, `VIEW_AUDIT_LOGS`, and notification permissions.

These are coarser than the full baseline. Existing API routes check a permission before service calls, and the corrective workflow repeats key checks. Phase 3 should retain defense in depth while expanding scope and organization/site/record ownership checks.

## Mandatory authorization rules

- Determine actor only from the authenticated session/token; ignore client-supplied actor IDs.
- Check permission server-side for every query and command, including reports/files.
- Enforce organization/site/department and assigned-record scope independently from UI visibility.
- Approval cannot be inferred from ability to edit. Separation of submitter and approver is `NEEDS_CONFIRMATION` but recommended and already present in the corrective slice.
- System jobs use a dedicated principal and idempotent source identity.
- Every denied command returns no domain changes; sensitive denial details are not leaked.

## Required confirmation evidence

Obtain production `auth_assignment`/role/item definitions, menu configuration, representative role accounts, department/site ownership rules, API-client identities, and signed approval limits. Until then no role row in this document should be treated as approved authorization policy.
