# Implementation status

Updated 2026-08-09.

| Slice | Status | Evidence | Remaining operational step |
|---|---|---|---|
| Foundation | Implemented | Auth, organization, master data, audit, attachments, notifications | Deploy per environment |
| Asset Management | Implemented and deployed to DEV | Asset list/search/hierarchy/detail, full create/edit forms, audited non-destructive archive, custom-field round trip, migration 0002 and demo hierarchy seed | Validate CRUD and archive permissions with DEV users |
| Corrective Maintenance | Implemented, deployed to DEV and locally verified | Central workflow, notification-to-close UI/services, migration 0003, automated test layers | Execute stakeholder acceptance flow in DEV |
| Work Order module | Implemented and deployed to DEV | List/board/calendar, manual/source creation, planning, assignment history, execution tabs, append-only backlog, labor/OT, material adapter, tools, safety/LOTO, acceptance, completion, verification, closure, history; migration 0004 and demo seed | Stakeholder parity review of legacy print layouts, OT overlap rules and inventory posting |
| Inventory Management module | Implemented and deployed to DEV; higher environments pending approval | Stock item/location/vendor masters, Issue/Receipt/Transfer documents, Receipt-entered line amounts, Issue-to-Receipt source tracking with quantity checks, source-cost Stock Card values, sequential approvals, transaction-safe Decimal posting, row-locked balances, immutable movements, stock count adjustments, vendor rating, dashboard/reports, permission-aware navigation, attachments, audit/notifications, Nextif dry-run/execute migration | Apply migrations `0008_inventory_management` and `0009_inventory_receipt_source_costing` to the next approved environment, run Nextif dry-run with source credentials, and complete UI acceptance for print/export and multi-line documents |
| PO Inventory Receipt | Implemented and deployed to DEV | Migration `0010_purchase_order_receipts`; approved/partial PO receipt queue; multi-delivery and multi-line receipt; receiver/date/location/delivery-note/attachments; reject quantity; row-locked over-receipt prevention; atomic PO `PARTIAL_RECEIVED`/`RECEIVED`, On-hand and Stock Card posting; return/reversal; printable PO receipt; legacy profiler and idempotent PO importer | Complete the PR/PO creation and approval UI so real approved POs feed the receipt queue; then run stakeholder receipt/return acceptance with Warehouse users |
| Enterprise UI shell and role dashboard | Implemented locally | Permission-grouped collapsible sidebar and mobile Sheet; consistent header/breadcrumb/user context; Inbox and Approval badges; `/dashboard` with authorized real-data KPI, status distribution, maintenance trend, Warehouse/Plant/Purchase/Approver/Admin action queues, activities, filters, deep links, loading/empty/error states; centralized status/priority badges; server-scoped Work Order list/detail/print/reference data and Inventory approval counts | Run signed-in visual acceptance with current DEV credentials for each operational role; the stored demo passwords no longer match the documented seed defaults |

Corrective Maintenance status fields are persistence outputs only. Public APIs expose named commands and the service sends every lifecycle change through `lib/maintenance/workflow.ts`.

Work Order module verification on 2026-08-01: Prisma generation, TypeScript, ESLint, 71 automated tests and the Next.js production build passed. Migration `0004_work_order_module` and deterministic seed completed against `.env` `DEV_DATABASE_URL`. Database integration tests remain opt-in through a disposable `TEST_DATABASE_URL` and were therefore skipped during the standard suite.

Inventory verification on 2026-08-02: Prisma generation, schema validation, TypeScript, ESLint, 64 passing tests and the Next.js production build passed. DEV migration deployment completed against MariaDB 5.5.68 using the compatible runner after resolving the failed standard-engine attempt; migrations `0008_inventory_management` and `0009_inventory_receipt_source_costing` are recorded as applied and the database schema is up to date. A representative legacy sample import from `nexif` into DEV then loaded 250 stock items, 3 locations, 60 vendors, 250 balances, 25 receipts, 25 issues and 7 transfers with zero rejected rows. The repeatable importer is `npm run migrate:old-inventory-sample` and defaults to sample limits; use `--all` only for a deliberate broader import.

PO Receipt verification on 2026-08-09: the source profiler resolved the accessible legacy schema as `nexif` (the schema name embedded in `OLD_DATABASE_URL` was not accessible), confirmed zero legacy `pupod010` and `pupod020` rows, and found historical warehouse Receipts but no PO records to link without fabricating source documents. The procurement importer dry-run therefore reconciled 0 source/0 loadable/0 rejected. Migration `0010_purchase_order_receipts` was applied to DEV on MariaDB 5.5.68. Prisma validation, TypeScript, ESLint, 69 automated tests and the Next.js production build passed.

Enterprise UI verification on 2026-08-09: TypeScript and ESLint passed without warnings, 74 automated tests passed with 3 database integration tests skipped, and the Next.js 16 production build generated all 85 routes. Browser checks at 1440×900 and 375×812 confirmed protected Dashboard redirect, labeled login controls, 48 px primary action height, no horizontal overflow, mobile aside suppression, and no console warnings or errors. Signed-in role-by-role browser acceptance remains pending because the current DEV credentials differ from the documented demo defaults.

## UX/UI iteration — 2026-09-05

First local shell/dashboard refinement: Thai navigation and purchasing breadcrumbs, larger mobile header/group controls, token-based sidebar background, shared PageHeader typography/action sizing, action queue ahead of KPI/charts, collapsible dashboard filters, and refresh preserving the current route/query. No workflow or permission changes.

Verification: typecheck, lint and 78 tests passed (3 database integration tests skipped). Production build passed with DEV_DATABASE_URL supplied as DATABASE_URL for the build process only; deployment configuration is still pending. Temporary synthetic-data component preview checked at 375×812 and 1440×900 with no document overflow or observed console errors/warnings; preview route removed afterward. Signed-in role acceptance, real-data filter/refresh validation, and remaining responsive checks are pending. See [UX/UI improvement plan](./ux-ui-improvement-plan.md).

## Work Order list UX — 2026-09-05

Local list refinement adds shared Thai page header, assignment presets, primary/advanced filters, URL-backed search/filter/sort/page/view, validated detail return links and optional scroll restoration. Requests are debounced and aborted on query changes; reference data is fetched on mount/retry. Error/empty states are distinct and board/calendar pagination scope is explicit. Rows/cards show assignee and work type.

Typecheck/lint and 82 tests passed, with 3 integration tests skipped. Synthetic API preview checked at 375/768/1024/1440px with no horizontal document overflow; assignment query, clear, error and empty behavior checked. Temporary preview removed. Real-account permissions, reload/back/scroll and full WO execution acceptance remain pending.

WO list production build also passed with DEV_DATABASE_URL supplied as DATABASE_URL only to the build process. The existing multiple-lockfile warning and deployment environment setup remain open.

## Work Order detail UX — 2026-09-05

Local detail refinement introduces Thai section navigation (mobile select / wrapping desktop tabs), URL section state, mounted panels preserving inputs between sections, and contextual execution shortcuts. Shared QuickForm captures the form before async submission, prevents duplicate submits, retains data on failure, displays local errors/success and resets after success. Browser reload/close warns for dirty forms; internal-link navigation guards remain pending. Backlog/resume dialogs now use Radix focus management. Datetime-local defaults use local calendar fields. Attachment loading failure is separate from an empty list; document upload uses the shared pending/error form.

84 tests passed with 3 database integration tests skipped. Synthetic browser preview checked at 375×812 and 1440×900, including form retention across tabs, failed submission/retry/reset and Escape focus restoration. Preview routes removed. Actual camera/uploads, full role/status acceptance and integration verification remain pending.

Final lint completed without warnings and the production build passed using the process-only DEV database configuration described above. Multiple-lockfile warning remains unchanged.

## Purchasing and approval UX — 2026-09-05

Local PR/PO pages now lead with document lists and collapsible creation forms, labeled line fields, loaded-batch search/status filtering (explicit 100-document limit), vendor search over returned reference data, duplicate-action guards and local form errors. Document inspection reloads on open, preserves zero revision values and wraps long text. Approval center shows purchase amounts, reason/attachments supplied by the API, protects in-flight decisions and retains comments on failure; filtering resets pagination and stale list responses are ignored.

Synthetic UI checked for PR/mobile document inspection and PO/desktop form layout; failed approval decision retained its comment and displayed an error. All temporary fixture routes removed. Full real-account role/action review, server document search, returned-document editing/resubmission and end-to-end procurement acceptance remain pending.

Verification for this purchasing iteration: lint passed without warnings, 84 tests passed (3 integration tests skipped), and production build passed using DEV_DATABASE_URL as DATABASE_URL only for the build process. Existing multiple-lockfile warning remains.
## Purchasing search and editing update — 2026-09-05

PR/PO now use server search/status filters and 25-row pagination, superseding the earlier loaded-batch limit. Filters reset pagination and obsolete requests are aborted. Session permissions control action visibility. A fresh-read editor supports existing lines in draft/returned documents, preserving reference IDs, vendor order and decimal values; failed saves retain inputs. Adding/removing lines and changing item/vendor references remain pending.

Lint/build passed; 87 tests passed, 3 integration tests skipped. Build used process-only DEV database configuration; multiple-lockfile warning remains. Synthetic mobile QA verified paging, search reset, latest detail loading, failed-save retention and retry success. Temporary routes removed. Real-account permissions, resubmission, procurement integration and concurrent-edit verification remain pending.
