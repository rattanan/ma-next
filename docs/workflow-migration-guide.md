# Governed workflow migration guide

Migration `0005_governed_maintenance_workflow` is additive. Back up and rehearse it against a recent non-production copy before deployment.

## Mapping

| Legacy value | Governed value | Rationale |
|---|---|---|
| Notification `NEW` | `SUBMITTED` | Existing reports were already sent to the review queue |
| Notification `APPROVED`/`BACKLOG` | `IN_MAINTENANCE` | Existing authorization or deferral already created execution responsibility |
| Notification `COMPLETED` | `READY_TO_CLOSE` | Never infer that the Operator already closed it |
| Work Order `OPEN` | `CREATED` or `ASSIGNED` | Based on whether `assigned_to` exists |
| Work Order `BACKLOG` | `WAITING_FOR_PARTS` | Safest available waiting state; review ambiguous reasons manually |
| `IN_PROGRESS` | `IN_PROGRESS` | Direct mapping |
| `COMPLETION_PENDING` | `TECHNICIAN_COMPLETED` | Technical submission is not approval or closure |
| `VERIFIED` | `WAITING_FOR_OPERATOR_ACCEPTANCE` | Existing supervisor verification is treated as manager approval |
| `CLOSED` | `CLOSED` | Preserved as a historical terminal record |

Legacy enum values remain temporarily accepted by the database so compatible deployment can occur before cleanup. New HTTP commands never create them. Follow-up migration may remove them only after production reports confirm zero legacy rows.

Organization and site are backfilled from `department_id` where available. Null-scope records require administrative classification and are restricted to global administrators. The migration creates a baseline Notification event; existing Work Order events are retained.

Run `npm run db:deploy:compatible` according to the existing deployment process, then `npm run db:seed` to upsert permission definitions. Demo data is opt-in via `npm run db:seed:workflow` and is blocked in production.

