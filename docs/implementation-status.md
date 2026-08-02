# Implementation status

Updated 2026-08-02.

| Slice | Status | Evidence | Remaining operational step |
|---|---|---|---|
| Foundation | Implemented | Auth, organization, master data, audit, attachments, notifications | Deploy per environment |
| Asset Management | Implemented and deployed to DEV | Asset list/search/hierarchy/detail, full create/edit forms, audited non-destructive archive, custom-field round trip, migration 0002 and demo hierarchy seed | Validate CRUD and archive permissions with DEV users |
| Corrective Maintenance | Implemented, deployed to DEV and locally verified | Central workflow, notification-to-close UI/services, migration 0003, automated test layers | Execute stakeholder acceptance flow in DEV |
| Work Order module | Implemented and deployed to DEV | List/board/calendar, manual/source creation, planning, assignment history, execution tabs, append-only backlog, labor/OT, material adapter, tools, safety/LOTO, acceptance, completion, verification, closure, history; migration 0004 and demo seed | Stakeholder parity review of legacy print layouts, OT overlap rules and inventory posting |
| Inventory Management module | Implemented and deployed to DEV; higher environments pending approval | Stock item/location/vendor masters, Issue/Receipt/Transfer documents, Receipt-entered line amounts, Issue-to-Receipt source tracking with quantity checks, source-cost Stock Card values, sequential approvals, transaction-safe Decimal posting, row-locked balances, immutable movements, stock count adjustments, vendor rating, dashboard/reports, permission-aware navigation, attachments, audit/notifications, Nextif dry-run/execute migration | Apply migrations `0008_inventory_management` and `0009_inventory_receipt_source_costing` to the next approved environment, run Nextif dry-run with source credentials, and complete UI acceptance for print/export and multi-line documents |

Corrective Maintenance status fields are persistence outputs only. Public APIs expose named commands and the service sends every lifecycle change through `lib/maintenance/workflow.ts`.

Work Order module verification on 2026-08-01: Prisma generation, TypeScript, ESLint, 71 automated tests and the Next.js production build passed. Migration `0004_work_order_module` and deterministic seed completed against `.env` `DEV_DATABASE_URL`. Database integration tests remain opt-in through a disposable `TEST_DATABASE_URL` and were therefore skipped during the standard suite.

Inventory verification on 2026-08-02: Prisma generation, schema validation, TypeScript, ESLint, 64 passing tests and the Next.js production build passed. DEV migration deployment completed against MariaDB 5.5.68 using the compatible runner after resolving the failed standard-engine attempt; migrations `0008_inventory_management` and `0009_inventory_receipt_source_costing` are recorded as applied and the database schema is up to date. A representative legacy sample import from `nexif` into DEV then loaded 250 stock items, 3 locations, 60 vendors, 250 balances, 25 receipts, 25 issues and 7 transfers with zero rejected rows. The repeatable importer is `npm run migrate:old-inventory-sample` and defaults to sample limits; use `--all` only for a deliberate broader import.
