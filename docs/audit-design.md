# MA Next audit design

## Objective

MA Next must produce a trustworthy, searchable and privacy-aware record of important changes. Auditing is application infrastructure called by use cases, not ad hoc model hooks or prose concatenation. An important domain change and its audit record commit in the same MariaDB transaction.

Audit history is not the same as structured application logs, login events, workflow history, or inventory ledger. They may share correlation IDs but serve different purposes.

## Event model

Proposed `audit_events` fields:

| Field | Purpose |
|---|---|
| `id`, `tenant_id` | immutable identity and tenant boundary |
| `occurred_at` | server UTC timestamp |
| `actor_type`, `actor_id` | user, service principal, migration or system job |
| `acting_employee_id` | optional business identity |
| `impersonator_id` | support/elevation actor when applicable |
| `action` | stable verb such as `work_order.completed` |
| `target_type`, `target_id`, `target_label` | allow-listed affected resource reference |
| `result` | `SUCCESS`, `DENIED`, or approved failure categories |
| `before`, `after`, `changes` | redacted/versioned JSON snapshots or diff |
| `reason` | optional user-provided business reason, size-limited |
| `request_id`, `correlation_id`, `trace_id` | operational correlation |
| `source` | web, API, worker, migration, scheduled job |
| `ip_hash_or_address`, `user_agent_summary` | privacy policy dependent |
| `schema_version` | event payload evolution |
| `integrity_hash`, `previous_hash` | optional tamper-evidence pending approval |

Target labels must not be relied on as current entity names. JSON fields use allow-listed serializers per event type, not automatic serialization of arbitrary ORM models.

## Events that must be audited

- authentication success/failure, logout, lock/unlock, credential/session revocation;
- user, role, permission, scope and security-setting changes;
- organization/site/department and governed master-data mutations;
- asset create/update/archive, hierarchy and custom-field changes;
- notification create/update/review/convert;
- all work-order workflow transitions and important execution/completion edits;
- PM/CBM definition changes and generated/failed occurrences;
- inventory document decisions, posting, reversal and adjustment;
- vendor/contract/warranty changes;
- attachment upload completion, link/unlink, download of sensitive content, quarantine/delete;
- approval configuration and every approval decision;
- report/export actions designated sensitive or official;
- migration batches, rejected records, reconciliation approvals and cutover actions;
- high-risk denied operations and support elevation.

Routine list/page reads are not all audited by default. Sensitive record views, exports and attachment downloads are controlled by an approved access-audit policy.

## Atomic write pattern

1. Use case authorizes and validates command.
2. Load/redact the approved `before` representation.
3. Perform domain mutation and workflow transition in a Prisma transaction.
4. Build the approved `after` representation and semantic diff.
5. Append audit event and outbox message in the same transaction.
6. Commit; structured operational log records outcome and audit ID.

If mandatory audit creation fails, the important domain mutation fails. External delivery failure never removes or changes the committed audit event.

Denied authorization attempts are recorded outside a domain transaction using a minimal security-event path. Validation failures are aggregated operationally unless security policy designates them auditable.

## Redaction and classification

Never store passwords, password hashes, session/API tokens, Auth.js secrets, S3 credentials, raw authorization headers, encryption keys, full file content, sensitive network configuration passwords, or malware payloads.

Field serializers classify values as:

- `PUBLIC_OPERATIONAL`: safe identifiers/codes;
- `INTERNAL`: names, work content, costs, workflow notes;
- `PERSONAL`: contact, employee and device/network data;
- `SECRET`: never captured;
- `LARGE_OR_BINARY`: store metadata/hash only.

Audit viewers receive fields according to explicit permission and masking level. Free-text reason/note fields need content guidance and size limits because automated redaction is not sufficient.

## Immutability and access

- Application roles receive INSERT/SELECT as needed but no UPDATE/DELETE on audit records.
- Corrections append annotation events that reference prior events.
- Retention/deletion jobs use a separately controlled operational role and produce their own evidence.
- Exports are authorized, watermarked/identified if required, bounded, and audited.
- Tenant administrators do not automatically receive audit access; `audit.read` and scope are explicit.
- Optional hash chaining, signed checkpoints or external immutable archive requires performance and legal approval.

## Retention and privacy

Retention periods are not present in discovery. Define policies by event class, jurisdiction and tenant contract. Policy must address legal holds, employee privacy, IP/user-agent treatment, pseudonymization after account erasure, object-reference survival, backup expiration and audit export.

The legacy 30/90-day alarm deletion behavior is not adopted as an audit retention rule.

## Query and reporting

Authorized audit queries filter by time range, actor, action, target, result, source and correlation ID with tenant scope always applied. Index these fields and use cursor pagination. Do not offer arbitrary SQL or unbounded exports.

Workflow timelines may join workflow history and selected audit events in a read model; inventory history uses the ledger as source of truth and displays audit actor/context alongside it.

## Verification

- unit tests for every serializer/redaction rule;
- integration tests proving mutation and audit atomicity on success/failure;
- permission and tenant-isolation tests for query/export;
- immutability tests under the application database role;
- event completeness checks for every important use case;
- migration audit counts and batch reconciliation;
- optional integrity-chain validation and restore tests if approved.

## Audit decisions requiring approval

Approve ADR-012 and ADR-021 in the [architecture decision register](./target-architecture.md#architecture-decisions-requiring-approval), the authoritative event catalog, read/export roles, sensitive-read coverage, retention periods, legal holds, IP/device storage, masking policy, correction/annotation procedure, and whether tamper-evident chaining or immutable external archive is required.
