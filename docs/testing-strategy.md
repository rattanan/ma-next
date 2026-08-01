# MA Next testing strategy

## Quality objective

Automated tests demonstrate functional-baseline preservation, tenant/security isolation, workflow integrity, ledger correctness, adapter behavior and migration reconciliation. Tests run against disposable infrastructure only and never connect to production PHP or production MariaDB/object storage.

## Test layers

| Layer | Scope | Infrastructure |
|---|---|---|
| Static | TypeScript strict mode, ESLint, import boundaries, Prisma validation, migration lint | none |
| Domain unit | value objects, policies, transition tables, costing calculations, recipient rules | pure TypeScript; fake clock/IDs |
| Application unit | use-case orchestration, authorization calls, audit/outbox expectations | in-memory ports/fakes |
| Database integration | Prisma repositories, constraints, transactions, concurrency and tenant-scoping invariants | disposable MariaDB matching the target version, collation and SQL mode |
| Adapter contract | Auth.js adapter, S3 port, telemetry, email/push, report renderers | MinIO/mail catcher/fake provider servers |
| Route/component integration | RSC/Server Action/Route Handler auth, Zod and result rendering | Next.js test runtime plus disposable services |
| Browser E2E | critical desktop/mobile journeys, accessibility, localization | built application, MariaDB, MinIO, browser automation |
| Migration parity | source fixtures/extract → target load → reconciliation | sanitized fixture snapshots and disposable MariaDB |
| Operational | backup/restore, worker retry, health checks, migration deploy/rollback rehearsal | production-like ephemeral environment |

No business rule is validated solely through a UI snapshot.

## Functional-baseline traceability

Every baseline function ID receives test case IDs and evidence in the functional traceability matrix. `MUST_PRESERVE` functions require approved parity scenarios before release. `NEEDS_CONFIRMATION` behavior remains a blocked/pending test rather than an invented expected value.

Minimum test metadata:

- baseline function ID and business rule reference;
- actor, tenant/scope and permission;
- preconditions/source fixture;
- command/query and validation cases;
- expected state, output, side effects, audit and notifications;
- localization/report expectations where applicable;
- legacy parity evidence or approved target deviation.

## Critical suites

### Authentication and permission

- enabled/disabled/locked/expired account behavior and audited login/logout;
- secure credential/session lifecycle without legacy MD5 reuse;
- permission/scope matrix, cross-tenant denial and resource-existence non-leakage;
- role administration, last-admin invariant and session revocation;
- CSRF/origin protections, rate limiting and API credential scopes.

### Asset

- all mapped legacy fields round-trip; required/custom-field Zod/domain validation;
- code/KKS search, type/status/site filters and pagination;
- hierarchy traversal, cycle/orphan policy and parent/BOM distinction;
- authorization at tenant/site/department scope;
- attachment/image preview and contract/spare/work-order relationships;
- mobile layout and QR workflow once approved.

### Notification and work order

- verified defaults and non-blocking duplicate warning;
- one review decision and one idempotent conversion;
- browser/API/worker call the same use cases;
- transition table tests for every allowed and forbidden edge;
- incomplete required task blocks completion;
- completion, verification, return, close and reopen cases after approval;
- workflow/audit/outbox atomicity and concurrency conflicts.

### PM and CBM

- timezone/date boundary, due/not-due, catch-up and plan-change fixtures;
- repeated/concurrent jobs produce one occurrence/work order;
- failed generation remains retryable and source is not acknowledged early;
- telemetry quality/unavailability, threshold boundary and deduplication;
- stored decision evidence explains generated condition events.

### Inventory

- every posting creates ledger lines and reconciled balance projections;
- insufficient stock rejects atomically with no partial lines;
- approved FIFO-like sample costs and lot usage until policy changes;
- transfer creates matched source/destination lines under one transaction;
- receipt updates PO quantities/status and notifies waiting work assignees;
- idempotent concurrent posting, deterministic locks and deadlock retry;
- reversal/adjustment preserves immutable original transaction;
- property-based sequences maintain quantity/value invariants.

### Attachments, notifications and audit

- storage adapter contract, quarantine, scan, checksum, access and cleanup;
- notification dedupe, retry, recipient isolation, safe link and localized template;
- audit serializer redaction, required event coverage and transactional atomicity;
- application database role cannot update/delete ledger or audit history.

## Integration environment

Docker Compose supplies the same MariaDB version, collation and SQL mode as production, an S3-compatible MinIO service and optional mail catcher. Tests create a unique MariaDB database and bucket prefix per worker/run, migrate from empty using Prisma, seed deterministic fixtures, and clean only explicitly resolved disposable resources.

`TEST_DATABASE_URL` and test bucket names must pass an allow-list guard such as an explicit `_test` marker. Production hostnames/accounts are denied. Tests do not fall back from missing test configuration to `DATABASE_URL`.

## Test data

- Hand-built factories use stable clocks/IDs and valid domain defaults.
- Redacted legacy fixtures are versioned only after privacy review and contain no credentials, secrets or production object URLs.
- Golden report/PDF fixtures require business approval; compare semantic values and carefully selected rendering, not unstable binary bytes.
- Thai fixtures cover combining characters, search/collation, Buddhist/Gregorian presentation policy, fonts and line wrapping.
- Large-volume synthetic fixtures cover realistic cardinality without copying production personal data.

## E2E journeys

Initial release gates should include:

1. sign in → authorized landing → sign out;
2. asset search/hierarchy/detail → authorized attachment preview;
3. asset → maintenance notification → review → one linked work order;
4. plan/start work → complete tasks → completion → supervisor verification → close, after state approval;
5. PM scheduler → one occurrence/work order under retry;
6. inventory receipt/issue/transfer with ledger reconciliation, when inventory enters scope;
7. tenant/scope denial and mobile responsive behavior;
8. Thai/English switching and approved official output.

## Non-functional tests

- accessibility: automated checks plus keyboard/screen-reader review for critical flows;
- performance budgets for common list/detail/search and posting under representative volumes;
- load/concurrency tests for login, work transitions, sequences, scheduler and inventory posting;
- security tests for OWASP request classes, mass assignment, IDOR, XSS, upload abuse and secret leakage;
- resilience tests for database rollback, duplicate messages, worker restart, provider timeout and telemetry outage;
- backup/restore verifies MariaDB-to-object reference consistency;
- observability tests verify correlation IDs, redaction, health/readiness and actionable job failures.

## CI quality gates

On each change:

1. formatting/lint and strict typecheck;
2. unit tests with coverage on domain/application modules;
3. Prisma schema validation and migrate-from-empty test;
4. MariaDB integration and adapter contract tests;
5. production Next.js build;
6. affected E2E/parity suites.

Scheduled/release pipelines add full E2E, migration rehearsal, dependency/container/security scans, performance smoke, backup/restore and reconciliation. Coverage percentage is a signal, not acceptance; branch/transition/invariant completeness is required for critical modules.

Flaky tests are quarantined only with owner, issue and deadline; they cannot silently pass a release gate. Failed migration or ledger reconciliation always blocks release.

## Test ownership and evidence

Developers own unit/integration automation; product/domain owners approve parity scenarios and unresolved rules; security approves threat-focused suites; operations owns restore/runbook tests. Release evidence records source version, target commit, migration version, test environment, results, known deviations and approvers.

## Testing decisions requiring approval

Approve supported browser/device matrix, MariaDB/S3 production versions, MariaDB collation and SQL mode, coverage and performance thresholds, accessibility standard, official report comparison method, sanitized fixture governance, security tooling, load volumes, recovery objectives, mandatory E2E set, parity tolerances, and responsibility for approving `NEEDS_CONFIRMATION` tests. Related central decisions are ADR-013, ADR-015, ADR-018, ADR-020, ADR-021 and ADR-022.
