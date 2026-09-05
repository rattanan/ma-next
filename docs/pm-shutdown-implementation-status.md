# PM / Shutdown implementation status

Updated: 2026-09-05. **Partial implementation; not a production-ready completion of the entire plan.**

## Deployment preflight correction — 2026-09-05

Deployment preflight verified that local DEV_DATABASE_URL and ntop DATABASE_URL resolve to the same host/port/database fingerprint. Earlier statements below that migrations and fixtures were DEV-only, or that no production migration was applied, were incorrect. The database used by production already contains migrations 0012–0015 and PLAN-TEST fixtures. Do not run more fixture integration tests until DEV is separated. Do not enable a broad planning scheduler or delete fixtures without a reviewed cleanup scope. Production schema records were inspected before this release; deployment must verify checksums and preserve the shared database. The application release does not constitute completion of the remaining release gates.

## Implemented in this working tree

- Project list/detail/create, execution/summary/milestone tasks, parent hierarchy on creation, finish-to-start predecessors through API, readiness and conversion preview.
- One Task → one WO with unique source identity and backlink in one transaction. Generic create cannot spoof PM/Shutdown sources. Project priority and task plan/checklist are copied into the WO.
- Project → Task → WO lock ordering, serialized project roll-up, exhaustive WO/task status mapping. Both public close services use governed closure and update the source in the same transaction.
- Technician acceptance/start, completion revisions, manager review, designated source operator acceptance/rejection and manager recheck route. Only CLOSED completes a Task; approval/acceptance do not.
- Parent roll-up, unweighted project progress, automatic COMPLETED, explicit project closure, hold/resume and limited replan/cancellation. Empty/all-cancelled scope is not completed.
- Project/PM navigation and WO backlinks. Basic list/card/timeline views; these are not a complete planning board or dependency-aware Gantt.
- Immutable checklist templates, PM programs, day/week/month recurrence, monthly clamping, IANA timezone scheduling, expiry, preview, activation/pause, generation/skip API, explicit catch-up confirmation, occurrence uniqueness and PM close callback.
- Asset organization/site fields and explicit admin-only initial scope binding; planning rejects unscoped or wrong-site assets.
- Transactional notification outbox with unique event keys and atomic in-app delivery. One-shot bounded worker with a database lease, explicit scoped service user, job runs, dry-run default and no automatic catch-up.
- Read-only reconciliation CLI for broken links, closure mismatches, source scope mismatches, terminal projects with open WOs, old pending notifications and stale worker runs.

## Verification evidence

- TypeScript, ESLint and the existing Vitest suite were run during implementation. Latest Vitest: 116 passed, 3 skipped; skipped integration suites are not counted as passed.
- Production build compiled and generated all routes after explicitly supplying the DEV database URL to the build process. Plain `npm run build` failed because local `.env` has DEV_DATABASE_URL but no production DATABASE_URL; no dummy secret or config fallback was committed.
- `scripts/test-planning-dev.ts` passed on DEV, including concurrent conversion, technician → reviewer → operator → close, concurrent final WO closure, repeat close, cross-site read rejection, PM duplicate generation, rollback injection, operator rejection → manager recheck → resubmission, and outbox delivery retried without duplicate notifications. Latest fixture organization: PLAN-TEST-a1c50983.
- DEV migrations `0012_pm_shutdown_planning` and `0013_planning_outbox` applied successfully on MariaDB 5.5.68. Prisma validation/generation passed. **No production migration was applied for this implementation.**
- Fixtures remain in DEV under `PLAN-TEST-*` organizations with uniquely named test users/assets/projects/programs. They have not been deleted; fixture passwords are non-login hashes. Do not enable a broad scheduler against this fixture data.
- Browser smoke testing resumed after the user unlocked the Mac and logged into DEV as administrator. Verified Project list/detail, completed fixture Tasks and 100% Project progress, Gantt toggle, Task → WO and source backlink, PM list/create form and generated occurrence. This was read-only against existing fixtures; no full multi-role browser end-to-end pass is claimed.
- On the narrow in-app viewport, replaced overflow-prone list presentation with cards showing status/progress, removed the irrelevant list-level command note, and made closed/cancelled WO execution panels read-only. Also fixed the observed shell hydration mismatch by rendering department fallback/unread labels through React translation and excluding those React-owned labels from DOM translation. Project reload verified the corrected cards and no error badge in that check; broader translation regression remains necessary.

## Remaining work and release gates

| Priority | Remaining work | Required verification |
|---|---|---|
| P0 | Extended role-to-scope regression beyond the completed dedicated Project/PM permission implementation | Basic three-role HTTP denial/CSRF tests pass; remaining exhaustive HTTP/aggregate/reference matrix still required |
| P0 | Remaining reassignment/role-revocation race tests | Capability checks implemented for owners, technicians, operators and governed reassignment/recheck. Same-assignment scope tests and wrong-role integration pass |
| P0 | Complete authorization/state regression for legacy WO commands, attachment scope and source data edits | Every old/new HTTP route, rejection, wait/resume, tool issue versus close races |
| P0 | Module/site feature flags, production asset scope mapping, backup/restore exercise and old/new scheduler cutoff | Approved pilot site and single producer; no duplicate WO across legacy/new systems |
| P0 | Worker crash/lease expiry, partial failure, stale run detection, deadlock retry, notification failure recovery | Dry-run, lease contention, real execution and repeat execution now pass on isolated DEV programs; remaining failure-injection/operations tests still required |
| P0 | Full browser UAT and business acceptance | Administrator read-only smoke test done; test all three operational roles, write workflows, desktop/mobile/keyboard and real planning workflow before enabling production |
| P1 | Edit/archive workflows with optimistic versioning, dependency/parent editing and cycle checks, referenced cancellation/replacement, restricted closed-project reopen | Cycle/race tests; no silent reopening or loss of linkage |
| P1 | Full template version history and documents/material/tool/labor snapshots; PM event type controls | Priority/duration controls and WO snapshot assertions are complete; existing WO must remain immutable after template revisions |
| P1 | PM calendar layout, missed/failed state presentation, UI skip, schedule revision effective dates and expired lifecycle | Historical date-range selection (maximum 366 days), range-filtered occurrences and empty-state UI implemented; remaining lifecycle scenarios still required |
| P1 | Real grouped board, dependency-aware Gantt, baseline comparison, filters/pagination, resource/budget reports | Realistic project size and accessible desktop/mobile UI |
| P1 | Full previous/new-value audit with HTTP request correlation; source operator decision records and production monitoring | Trace command → WO → source → notification without exposing sensitive details |
| P1 | Legacy idempotent import dry-run and complete reconciliation/controlled repair | Counts, orphan/duplicate reports, preserve closed history without emitting old notifications |

The implementation intentionally does not auto-create replacement WOs, reopen closed projects, alter existing WO snapshots after a template change, or migrate legacy history without an approved mapping.

## Completed backlog work: role isolation, scheduler verification and PM controls

- Added PROJECT_VIEW/PROJECT_MANAGE, PM_VIEW/PM_MANAGE/PM_GENERATE, enforced in services, route dispatch, layouts and navigation. WORK_ORDER_CREATE alone no longer permits Project/PM commands. Built-in maintenance managers/data-source creators receive management defaults; custom roles require explicit grants. Scope and capability must be provided by the same active role assignment.
- Owners need project management capability; technicians need work-start capability; designated operators need acceptance capability. Active scoped membership alone is insufficient. Governed assignment/recheck validates the new technician; unsupported replacement via the source-return command is rejected explicitly instead of silently ignored.
- DEV migration 0014 adds only permission catalog entries; existing user assignments were not changed. DEV migration 0015 adds PM priority/duration with backward-compatible defaults. No production migration was applied.
- Fixtures now use separate manager/technician/operator permissions, backed by isolated DB role grants, instead of synthetic all-permission actors. Optional `--http` creates temporary fixture sessions through the existing auth service, tests the local server's login requirements, reads, role-based command denial and CSRF rejection, and revokes those sessions in cleanup. It does not expose passwords or session tokens.
- Actual scheduler CLI was tested against one fixture program: read-only preview creates no occurrences; a held database lease prevents a competing run; two executions produce only one WO; a technician cannot run generation. Notification delivery is tested separately with a fixture-recipient filter, preventing test runs from processing unrelated pending notifications.
- PM priority and estimated duration can now be entered in the existing form and are copied to generated WO planning fields. Integration asserts HIGH / 45 minutes, including planned finish calculation.
- PM preview supports historical ranges up to 366 days and queries occurrence records in that same range. Browser checked a valid range with no occurrences and invalid reversed dates; no maintenance records were modified during these browser checks.
- Latest expanded DEV integration passed: PLAN-TEST-335a1eea, including full closure/recheck, scoped roles, HTTP denial/CSRF, scheduler and PM snapshots. This is not a claim of full browser UAT or production readiness.

## Local verification commands

Run from `ma-next`. Never print the `.env` contents.

```sh
npm run typecheck
npm run lint
npm test
npm run db:validate
node --env-file=.env --import tsx scripts/test-planning-dev.ts
# With the local DEV server running on 127.0.0.1:3000:
node --env-file=.env --import tsx scripts/test-planning-dev.ts --http
```

The integration script requires DEV_DATABASE_URL and refuses NODE_ENV=production. It creates isolated fixtures; it is not an automatic cleanup tool.

## Worker and reconciliation runbook

These are application CLIs, not enabled recurring jobs. There is no active production scheduler for the new module.

1. Apply the additive migrations with the established deployment process; verify checksums and database identity.
2. Provision an explicitly scoped service user with the approved planning permissions. Set PLANNING_SERVICE_USER_ID in the worker's private environment, not source control. The worker requires an explicit PM_GENERATE grant and does not elevate ADMIN/legacy roles.
3. For DEV, set NODE_ENV=development so the application uses DEV_DATABASE_URL. For production, provide the established DATABASE_URL and NODE_ENV=production. Do not point a test command at production.
4. Run `node --env-file=.env --import tsx scripts/run-planning.ts` for a read-only preview. The worker fails closed above 500 active programs until batching/partitioning is configured.
   For an isolated pilot/test, add `--program=<verified-program-uuid>`. Add `--skip-notifications` only when deliberately testing generation independently of outbox delivery; pending messages remain queued.
5. Only after approval and acceptance, append `--execute` to generate current/lead-window occurrences, deliver pending notifications and persist run results. It never backfills missed dates automatically.
6. Use the existing server process scheduler only after the pilot/cutoff gate. Runs are bounded; a connection-owned database lease prevents overlapping producers and releases on disconnect. Check FAILED/PARTIAL_FAILURE/RUNNING entries; a crashed RUNNING row needs investigation, not blind success marking.
7. `node --env-file=.env --import tsx scripts/reconcile-planning.ts` reports integrity issues without changing records. Exit 0: no reported issues; exit 2: findings; exit 1: command failed. It is a bounded first-pass report, not a full historic reconciliation or auto-repair.
8. Stop generation first if rolling back. Preserve WO/task/occurrence/outbox data and additive tables; do not drop tables or restart the old scheduler across the new generation cutoff.

## UI implementation note

The UI reuses the application's existing Button/Input/Textarea/AssetCombobox components and labeled forms following the ui-styling skill. This does not substitute for visual/accessibility UAT.
