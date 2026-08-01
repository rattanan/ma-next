# Maintenance Notification workflow

A Notification is the Operator's report and is separate from every Work Order created to resolve it.

| Status | Responsible role | Allowed next action |
|---|---|---|
| `DRAFT` | Operator | Edit own draft or submit |
| `SUBMITTED` | Maintenance Manager | Start review |
| `UNDER_REVIEW` | Maintenance Manager | Request information, reject, or approve |
| `NEEDS_INFORMATION` | Operator | Add response/evidence and resubmit |
| `REJECTED` | — | Terminal |
| `APPROVED` | Maintenance Manager | Create one or more linked Work Orders |
| `IN_MAINTENANCE` | Maintenance | Complete all required Work Orders |
| `WAITING_FOR_OPERATOR_ACCEPTANCE` | Operator | Accept result or request recheck |
| `OPERATOR_REJECTED` | Maintenance Manager | Return a linked Work Order for recheck |
| `OPERATOR_ACCEPTED` | Maintenance Manager | Close all linked Work Orders |
| `READY_TO_CLOSE` | Operator | Close Notification |
| `CLOSED` | — | Read-only |

Information requests are append-only `notification_reviews` plus timeline events; responses are new timeline events and never overwrite the original request. All status changes use named server commands. Submitted or terminal Notifications have no hard-delete command.

The closure command validates Operator ownership/department scope, Operator acceptance, all linked Work Orders closed, and no active recheck. Every transition writes an entity event and audit row in the same database transaction.

