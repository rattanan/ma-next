# Work Order API design

All mutation endpoints require same-origin protection, authenticated session permission and repeated service/workflow authorization.

| Method and route | Purpose |
|---|---|
| `GET /api/work-orders` | Search/filter/sort/paginate by code/title/asset/type/status/priority/department/assignee/date/overdue. |
| `POST /api/work-orders` | Manual/source creation; status is not accepted. |
| `GET /api/work-orders/:id` | Full aggregate for detail/execution/history. |
| `PATCH /api/work-orders/:id` | Editable header/planning fields only; rejects status. |
| `POST /api/work-orders/:id/commands/:command` | Assignment, start, backlog, resume, completion, verification and closure commands. |
| `POST /api/work-orders/:id/steps` | Add Job Step/Checklist item. |
| `POST /api/work-orders/:id/steps/:stepId/commands/:command` | Complete/reopen/backlog/resume a step. |
| `POST /api/work-orders/:id/time-entries` | Labor/OT record. |
| `POST /api/work-orders/:id/materials` | Material usage through inventory adapter boundary. |
| `POST /api/work-orders/:id/tool-loans` | Issue/return equipment commands. |
| `POST /api/work-orders/:id/acceptance` | Operations/safety acceptance record. |
| `GET /api/work-orders/:id/print` | Authorized print-friendly detail. |

Errors use platform `HttpError` codes: validation 400/422, forbidden 403, missing 404, invalid/concurrent state 409. Events and audit rows use the authenticated actor and request metadata. Pagination is bounded and filters are parsed by Zod.
