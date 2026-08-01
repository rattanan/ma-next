# Work Order workflow

Work Orders are authorized by a Maintenance Manager from an approved Notification. A Notification may link to multiple Work Orders.

`CREATED → ASSIGNED → TECHNICIAN_ACCEPTED → IN_PROGRESS → TECHNICIAN_COMPLETED → UNDER_MANAGER_REVIEW → MANAGER_APPROVED → WAITING_FOR_OPERATOR_ACCEPTANCE → OPERATOR_ACCEPTED → CLOSED`

Execution can temporarily move from `IN_PROGRESS` to `WAITING_FOR_PARTS`, `WAITING_FOR_VENDOR`, `WAITING_FOR_ACCESS`, or `ON_HOLD`; each requires a reason and resumes to `IN_PROGRESS`.

A manager return moves `UNDER_MANAGER_REVIEW → RETURNED_TO_TECHNICIAN`. The assigned technician restarts work and submits a new immutable completion revision. An Operator rejection moves `WAITING_FOR_OPERATOR_ACCEPTANCE → OPERATOR_REJECTED`; the manager records required actions and assignment before moving it to `RETURNED_TO_TECHNICIAN`.

## Invariants

- Only an active user with the Technician role can be assigned.
- Only the current Technician can accept, start, wait/resume, or submit completion.
- Reassignment after work starts requires a reason and ends the previous history row.
- Required tasks must be complete before submission.
- Completion rows use a unique `(work_order_id, revision_number)` and have no update endpoint for technician content.
- A manager cannot review a revision they submitted.
- Manager approval does not close the Work Order.
- Operator acceptance is required before manager closure.
- Active rechecks block closure.
- Closed and cancelled states have no outgoing transitions.

The legacy `work_order_verifications` and execution acceptance records are preserved for compatibility. Governed manager decisions live on their associated completion revision; Operator decisions and rechecks are append-only records.

