# MA Next migration plan

## Scope and safety boundary

Legacy data migration is a separate workstream from application feature implementation. The production PHP database and file store remain untouched: no target migrations, triggers, writes, cleanup, schema changes, destructive queries or application dual-writes are permitted against them.

Migration development uses sanitized schema/data exports or a read-only restored snapshot. Credentials and production secrets are never copied into source control, documentation, local Compose or test fixtures.

## Migration architecture

```text
read-only source snapshot/export
    → immutable raw extract
    → profiled staging schema/database
    → validated transformation
    → MariaDB target load
    → reconciliation and business sign-off
```

Raw/staging tables are isolated from application roles. Transformation code is explicit per aggregate; it is not a mechanical PHP-to-TypeScript or table-to-table translation.

## Required discovery before build

- confirm `aes02` is the authoritative deployed branch/version;
- obtain sanitized DDL for all source connections including views, triggers, indexes and collations;
- obtain non-secret master/status/RBAC/approval/numbering/report/translation/scheduler configuration;
- profile row counts, key ranges, nulls, duplicates, orphans, invalid dates, encodings and file references;
- approve authoritative workflow mappings and official report parity samples;
- inventory active integrations, cutover dependencies, data owners and retention obligations;
- define migration scope by functional-baseline function and tenant/site.

## Migration assets

| Asset | Purpose |
|---|---|
| Migration manifest | source version/checksum, extraction time, scope, batch and approvals |
| Source profile | counts, distinct states, quality findings and rejected assumptions |
| Mapping specification | source fields/values to target fields/values with transforms and owner |
| `legacy_id_maps` | stable source system/table/ID to target type/ID crosswalk |
| Rejection register | record-level code, non-sensitive explanation and disposition |
| Reconciliation suite | automated counts, totals, relationships, state and checksum comparisons |
| Runbook | exact rehearsed commands, roles, timing, rollback and escalation |
| Sign-off pack | technical and business evidence by module/batch |

## Sequence

### Phase M0 — Architecture and source confirmation

Approve the MariaDB/Prisma target version, collation and SQL mode, plus tenancy, IDs, status mappings, timezone, role model, file policy and cutover approach. Freeze the mapping specification version for each rehearsal.

### Phase M1 — Platform reference data

Load tenant, organization, site, department, configured master values, translations and legacy crosswalk infrastructure. Customer-specific IDs become stable target codes/mappings, never hard-coded application constants.

### Phase M2 — Identity reconciliation

Map legacy User/Profile to target User and optional Employee. Do not migrate MD5 password history as valid credentials. Use an approved forced-reset, staged account-claim or external IdP approach. Load roles only after the production permission matrix is approved.

### Phase M3 — Asset core

Migrate asset types/categories/status mappings, locations, assets, parent/hierarchy, custom/config values, contract references and attachment metadata/objects. Reconcile all source fields and explicitly register unmapped fields; no legacy field may disappear silently.

### Phase M4 — Maintenance history and open work

Load notifications/reviews, work orders and all children, PM definitions/occurrences and condition events in dependency order. Preserve source codes and timestamps, map statuses through approved tables, and distinguish historical closed records from active workflow records.

### Phase M5 — Commercial and inventory

Load vendors/contracts/items/locations. Establish inventory opening balances through explicit opening ledger transactions derived from an approved cutoff and source evidence. Historical ledger migration versus summarized opening positions requires finance/inventory approval. Only then load open stock documents.

### Phase M6 — Platform histories and files

Migrate approved audit/login/approval histories, notifications, reports/configuration and attachments according to retention and security rules. Unsafe arbitrary SQL/report definitions are cataloged, not executed.

### Phase M7 — Rehearsal, cutover and stabilization

Run at least two production-scale rehearsals from snapshots, measure duration, resolve rejections, execute business parity scripts, and obtain sign-off. During final cutover, place legacy in an approved read-only/frozen operating state, take final extracts, load deltas using the same idempotent process, reconcile, switch users/integrations, and retain a rollback window.

## Transformation rules

- Preserve source primary key and code in crosswalk/source-reference metadata, not as target primary-key policy.
- Convert dates using documented source timezone and retain raw value when ambiguous.
- Normalize encodings without changing user-visible Thai/English text silently.
- Map free-text states through approved mapping tables; unknown values reject rather than default.
- Map missing relations to explicit rejection or approved placeholder master—not fabricated links.
- Deduplicate only with approved match rules; keep merge evidence and aliases.
- Every target row carries tenant context derived from an approved source mapping.
- Files migrate by safe path resolution, checksum, MIME detection, scanning, object upload and link reconciliation.
- Posted stock quantities originate from migration ledger transactions, never direct balance writes.
- Known legacy defects are not “fixed” during migration without a documented disposition and reconciliation impact.

## Reconciliation

Automated reconciliation is required at record, relationship and business-total levels:

- counts by source table/target aggregate, tenant/site/status and rejected disposition;
- unique code and legacy crosswalk completeness;
- asset parent/orphan/cycle report and attachment count/checksum/bytes;
- notification-to-work-order and PM occurrence links;
- work task/labor/part/completion/history counts;
- inventory quantity/value by item/location/lot and ledger-to-balance rebuild;
- contract coverage links and financial totals;
- identity/employee/role mappings and disabled/locked status;
- audit/history event time ordering;
- approved reports/PDF data against representative legacy outputs.

Business owners sign off module-specific acceptance thresholds. A global “row count matched” is insufficient.

## Idempotency, restart and rollback

Each batch has an immutable ID and source manifest checksum. Loads use crosswalk/unique keys so reruns update only explicitly restartable staging or return the existing target mapping. Partially failed batches remain visible and resumable; they do not report success through assignment/default behavior.

Before go-live, rollback means discard/rebuild the isolated target. After users create target data, rollback requires an approved business plan for target-originated records; reverse-writing them into legacy is out of scope and prohibited by default.

## Existing MA Next transition debt

The current repository already contains MariaDB-compatible Prisma provider/dependencies alongside Drizzle migration artifacts. Before feature implementation, an approved foundation consolidation must:

1. inventory already implemented behavior and tests;
2. confirm Prisma's `mysql` provider, MariaDB adapter, target engine version, collation and SQL mode;
3. rebuild or reconcile Prisma migrations from an agreed MariaDB baseline rather than editing deployed history blindly;
4. migrate any disposable local development data only if useful;
5. remove obsolete Drizzle and duplicate direct-persistence paths after verification and explicit approval;
6. update the functional traceability matrix to identify the consolidated MariaDB foundation evidence.

This document does not authorize those code changes.

## Migration gates

- no production connection in development/test configuration;
- read-only source account and snapshot evidence verified;
- target and staging database names explicitly allow-listed;
- dry-run and row-level rejection report completed;
- automated tests and reconciliation pass;
- security/privacy scan of extracts and logs passes;
- performance fits approved cutover window;
- data owners sign off their modules;
- backup/restore and rollback rehearsal passes;
- final go/no-go and legacy freeze are recorded as audit events.

## Migration decisions requiring approval

Approve ADR-002, ADR-005, ADR-015, ADR-018, ADR-020, ADR-021 and ADR-022 in the [architecture decision register](./target-architecture.md#architecture-decisions-requiring-approval), source authority, data scope/history depth, snapshot method, cutover/freeze window, downtime, status/value mappings, identity credential transition, duplicate/orphan disposition, inventory opening/history strategy, attachment handling, reconciliation tolerances, sign-off owners, rollback window and legacy read-only retention period.
