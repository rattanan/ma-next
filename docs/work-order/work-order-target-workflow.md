# Work Order target workflow

The implementation preserves the existing corrective statuses while adding explicit planning/recording semantics through commands and events. This avoids destructive enum remapping of existing records.

| Command | Current state | Target | Permission | Mandatory data |
|---|---|---|---|---|
| Create manual/source WO | none | OPEN or BACKLOG | `MANAGE_WORK_ORDERS` | Asset, type, title, description, priority; backlog reason when applicable |
| Plan/update assignment | OPEN/BACKLOG | unchanged | `MANAGE_WORK_ORDERS` | Department/assignee as applicable; change note |
| Start | OPEN/BACKLOG | IN_PROGRESS | `EXECUTE_WORK_ORDERS` | Assigned technician |
| Move to backlog | OPEN/IN_PROGRESS | BACKLOG | `EXECUTE_WORK_ORDERS` or manager | Reason, optional expected resume; previous status retained in event |
| Resume | BACKLOG | OPEN or IN_PROGRESS | `EXECUTE_WORK_ORDERS` | Open backlog event and resolution note |
| Submit completion | IN_PROGRESS | COMPLETION_PENDING | `EXECUTE_WORK_ORDERS` | Required tasks/checklist complete; result, solution, duration and evidence rules |
| Return completion | COMPLETION_PENDING | IN_PROGRESS | `VERIFY_WORK_ORDERS` | Completion, independent reviewer, reason |
| Verify | COMPLETION_PENDING | VERIFIED | `VERIFY_WORK_ORDERS` | Completion, independent reviewer, note |
| Close | VERIFIED | CLOSED | `CLOSE_WORK_ORDERS` | Closure note and no unreturned tools |

All commands validate state, permission, mandatory information and action-specific rules before writes. A request containing `status` in a generic update is rejected.

FDS stages map operationally as Open=`OPEN`; Prepare=planning events while OPEN; Execute=`IN_PROGRESS`; Record=completion preparation while IN_PROGRESS; Approval=`COMPLETION_PENDING`; Complete=`VERIFIED` then controlled `CLOSED`. The mapping is explicit in history and can be revised when WO-U01/U02 are confirmed.
