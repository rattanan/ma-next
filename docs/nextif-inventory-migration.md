# Nextif inventory migration

`npm run migrate:nextif-inventory` runs in dry-run mode by default. Use `--execute` only after reviewing the summary and rejected-record log:

```bash
npm run migrate:nextif-inventory -- --dry-run
npm run migrate:nextif-inventory -- --execute
```

The source connection is read from `NEXTIF_SOURCE_DATABASE_URL` (or the existing `SOURCE_DATABASE_URL` convention). The target uses `TARGET_DATABASE_URL`, then `DEV_DATABASE_URL`, then `DATABASE_URL`. The source and target URLs must be different.

## Mapping

Semantic-to-source mappings live in [`scripts/nextif-inventory-mapping.ts`](../ma-next/scripts/nextif-inventory-mapping.ts). The runner does not depend on those table names in its business logic. A deployment-specific JSON mapping can be supplied with `NEXTIF_INVENTORY_MAPPING_FILE`; keys in that file override the defaults.

The default mapping covers stock items, the Plant/Warehouse/Zone/Rack/Shelf/Bin location hierarchy, vendors, vendor contacts, balances, receipt history, issue history and transfer history. Categories and units are normalized onto the stock item record because the current MA-Next model uses controlled item fields rather than a separate legacy lookup table.

## Safety and reconciliation

- Dry-run reads source rows and writes no target records.
- Execute mode uses stable IDs derived from `NEXTIF`, the semantic entity and the source key, so a rerun upserts the same records.
- Missing required fields or unmapped references are rejected and written to `migration_rejections` with source table, source id, reason code and raw row data.
- Execute mode writes a `migration_runs` row with status, manifest and summary. Records are processed in batches of 250 for rejection logging.
- Imported balances create an explicit `RECEIPT` movement with an `NEXTIF-OPENING-*` document reference, so the opening quantity is auditable instead of being treated as a direct balance edit.
- Historical receipts, issues and transfers become posted Inventory Documents, lines and immutable `RECEIPT`, `ISSUE`, `TRANSFER_OUT`/`TRANSFER_IN` movement rows. Optional source before/after quantity and moving-average columns can be supplied in the mapping; otherwise the runner uses a zero-based normalized history row and records the source row in the migration log for reconciliation.

Review the summary by entity (`source`, `loaded`, `rejected`) and investigate every rejection before cutover. The script intentionally does not seed sample data.
