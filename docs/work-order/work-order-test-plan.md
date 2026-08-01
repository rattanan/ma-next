# Work Order test plan

## Unit

- State table for every command and invalid source state.
- Permission denial for create/plan/execute/verify/close.
- Mandatory assignment, backlog reason, checklist/task completion, independent reviewer and closure note.
- Zod validation for filters, header, task/checklist response, labor/OT, material, tool and acceptance.
- Direct `status` manipulation rejected.

## Integration

- Manual create and approved-notification conversion are idempotent and auditable.
- Assignment/start/backlog/resume/steps/checklist/labor/material/tool/acceptance/completion/verify/close persist atomically with ordered history.
- Invalid commands leave no partial rows.
- Organization/site scope and attachment permissions.
- Inventory adapter records immutable usage without inventing stock consistency.

## End to end

- Desktop list filters, sort, pagination, board and calendar.
- Manual creation to detail.
- Complete corrective flow through closure, including return for correction.
- Technician mobile critical flow and connection-required message.
- Loading, empty, error and permission states.
- Print detail and history.

Quality gates: lint, TypeScript strict check, unit/integration suites, production build, compatible migration and deterministic seed.
