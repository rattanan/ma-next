# Work Order implementation plan

Status: phases 3–7 implemented on 2026-08-01. Migration 0004 and seed were applied to DEV; remaining items below are explicit parity decisions, not placeholder UI.

## Files and data

- Modify `prisma/schema.prisma`, `lib/db/schema.ts`, `prisma/seed.ts`, permissions, maintenance validation/workflow/service and shared navigation.
- Add migration `0004_work_order_module`, Work Order API routes, `/work-orders` pages/components, repository/inventory adapter, tests and status/traceability updates.
- Extend `WorkOrder` and `WorkOrderTask`; add assignment, related asset, backlog event, tool loan and acceptance entities. Retain existing completion, labor, material, verification and history entities.
- Index list/filter columns, source uniqueness, ordered child rows, open backlog records and event timelines. Use foreign keys and unique source/sequence constraints.

## Server behavior

- Repository provides bounded search/detail and transaction helpers.
- Service owns create/update/assignment and child records; workflow owns every state transition.
- API handlers enforce same origin for mutation and route-specific permissions.
- Audit events cover create/update/assignment/start/backlog/resume/task/checklist/time/material/tool/acceptance/completion/verification/close.
- Notifications cover assignment, backlog/resume, completion submission, return/verify and closure.

## UI and tests

- List/board/calendar, create, detail shell, planning, execution, completion, verification, history and print.
- Responsive card/table switching; loading/empty/error/permission states; no nonfunctional action.
- Extend unit, integration, permission and E2E coverage described in `work-order-test-plan.md`.

## Risks and unresolved decisions

- Do not destructively rename existing statuses until WO-U01/U02 are approved.
- Inventory remains an adapter and immutable WO transaction record until WO-U09 is confirmed.
- Preserve raw legacy OT, diagnostic and source values pending master-data decisions.
- Tool tables, execution pack fields, report signatures, tenancy and legacy API cutover remain tracked in `work-order-unknowns.md`.
