# Unknowns and risks

## Blocking discovery gaps

1. **Source path mismatch:** `legacy-php` is absent; analysis used `aes02`. Confirm this is the authoritative version/branch.
2. **No schema/DDL or migrations:** ActiveRecord gives names and validations but not authoritative types, constraints, indexes, triggers, views, collations, or volumes.
3. **Missing runtime configuration:** `config/` is absent, so database connections, URL rules, RBAC filters, mail/storage, locale/timezone, scheduler, and feature flags are unknown.
4. **Database-resident behavior:** menus, RBAC grants, system configs, numbering rules, approval routes/SQL conditions, report SQL/parameters, translations, and logging enablement live in data not source.
5. **No representative outputs:** PDFs, exports, dashboards, alarm outcomes, and analytics cannot be parity-tested from code alone.
6. **No usage evidence:** 189 screen families exist, but code does not reveal active modules, user counts, record volumes, or obsolete paths.

## High-risk technical behavior

| Risk | Evidence/impact | Migration response |
|---|---|---|
| Business logic fragmentation | Controllers, models, components, views, API and commands all mutate state | Define explicit domain services/use cases and one state-transition implementation per workflow |
| Non-atomic multi-row operations | PR/PO child writes, approval callbacks, inventory postings, imports lack visible transactions | Use DB transactions, idempotency keys, invariant checks, and retry-safe jobs |
| Dynamic SQL/table names | Approval and numbering update/query tables by configured `mdel`; analytics/imports concatenate SQL | Replace with allow-listed handlers and parameterized repositories |
| Weak HTTP mutation controls | Most browser `VerbFilter` action maps are empty; delete URLs may accept GET | Require authenticated POST/PUT/PATCH/DELETE plus CSRF/origin checks |
| Bulk ID interpolation | Multiple `deleteall`/approve/release actions concatenate posted IDs | Parse typed IDs and bind parameters; enforce per-record authorization |
| Free-text state machines | `New`, `Released`, `Waiting`, `On Hold`, `Approved`, `Completed`, `Returned`, `Rejected`, `Open`, `Execute`, etc. | Establish per-aggregate enums and allowed transition tables with legacy mappings |
| File upload surface | Uploads save under web paths; validation is inconsistent | Private/object storage, MIME sniffing, size limits, generated names, malware policy, authorization |
| Sensitive audit leakage | Model hooks concatenate all attribute values | Structured allow-listed diffs with redaction and retention policy |
| Legacy password history | Historical passwords stored as MD5 of plaintext input | Never migrate these hashes as usable credentials; force reset or use safe transition policy |
| Token design | API tokens are MD5 of username+timestamp and returned/stored directly | Use cryptographically random, hashed-at-rest scoped tokens or target session model |
| Time/code coupling | Many business codes use second-resolution timestamps | Separate stable identifiers from human document numbers; atomic sequence service |
| Hard-coded master IDs | Asset filters (91/93/94), default profile IDs, event types and currency ID | Replace with stable codes/config and data crosswalks |

## Observed defects or contradictions to validate

- API notification approval creates a work-stage row using the review model ID rather than the created work-order ID and references inconsistent HR field names.
- `Pupod010Controller::actionCancel` sets `Released` and starts approval; likely a cancellation-request workflow with misleading naming.
- Receipt validation that blocks over-receipt or non-PO items is commented out.
- Console work-order import uses assignment in a success conditional, so failures may be reported as success.
- API registration references the newly created user variable outside the branch where it is assigned.
- `Woord010Controller` imports a `Wonof060` model that does not exist locally.
- Approval code includes a `findOne` call shaped like a conditional query, likely ineffective.
- Browser and API notification-to-work-order implementations diverge; API field/link assignments appear inconsistent.
- Some controllers declare duplicate actions (`Ufile010` create; `Pupod010` printview appears twice in extraction).
- Generic controller actions use `count($model)` on objects and assume relations exist; PHP-version behavior and null cases may differ.
- Import issue replacement deletes existing configuration before full rebuild and uses unparameterized delete SQL.
- PO/PR direct `approve` actions coexist with sequential approval completion and use different states (`Approved` versus `Completed`).
- Status spelling/meaning varies (`Execute` versus executed/executing, `Cancel` versus canceled, `Not Approved` versus rejected).
- Alarm condition combination counts `AND`/`OR` markers rather than evaluating an explicit expression tree; mixed or multi-condition semantics need test cases before reimplementation.
- The alarm job hard-deletes triggers after 30 days and logs after 90 days, which may conflict with audit/reliability requirements.

## Product questions

1. Which modules are currently used, by which roles, and which are contractually/regulatorily required?
2. What are the authoritative status transitions for notifications, work orders, PR, PO, inventory documents, approvals, projects, and sales orders?
3. Must migrated documents preserve legacy codes, URLs, PDFs, and attachment paths?
4. Which reports/forms are official records, and are Thai calendar/font/footer layouts legally required?
5. What are alarm scan frequency, acceptable latency, telemetry retention, tag mapping, and downtime behavior?
6. Are inventory costs FIFO, moving-average, or merely implementation accident? How are negative stock, returns, corrections, and unit conversion handled?
7. How do approval SQL conditions work in production, and can approvers delegate/substitute/escalate?
8. What constitutes final work-order completion, reopening, cancellation, and backlog/assignment behavior?
9. Is notification approval required before work-order conversion in all channels?
10. What are data retention, audit immutability, privacy, backup, and attachment security requirements?
11. Which timezone is authoritative for codes, schedules, password age, alarm windows, and audit timestamps?
12. Is the telemetry source SQL Server, and are `RealData`, `Tag`, `HourData`, and `MinuteData_` physical tables or views?

## Required next discovery artifacts

- Sanitized schema-only dumps for every connection, including views/triggers/indexes and approximate row counts.
- Exports of non-secret reference/config data: statuses, roles/permissions, menus, approval routes (with SQL redacted/reviewed), numbering rules, report metadata, and translations.
- Scheduler/cron definitions and job runbooks.
- Role-by-screen/action matrix and five to ten real scenarios per critical workflow.
- Representative redacted PDFs, spreadsheets, dashboards, mobile payloads, attachments, and alarm histories.
- Production defect/workaround list so accidental behavior is not enshrined.

## Recommended first migration module

After reconciling legacy identities with the existing `ma-next` auth foundation, migrate the **asset register core** (`asast010`, type/category, hierarchy, locations, and attachments) first.

Why:

- Assets are foundational to notifications, work orders, PM/CBM, meters, contracts, inventory locations/BOMs, and analytics.
- Core asset CRUD/hierarchy is meaningful but has fewer irreversible side effects than inventory posting, approvals, procurement, or alarm evaluation.
- It exercises key platform needs—authorization, lookup masters, files, audit, search, data import/crosswalks—without beginning with the most stateful workflow.
- It creates a stable target identifier crosswalk needed by later maintenance migrations.

Do not make inventory, approval, procurement, or alarm runtime the first vertical slice; each depends on unresolved state, scheduler, integration, and transaction semantics.
