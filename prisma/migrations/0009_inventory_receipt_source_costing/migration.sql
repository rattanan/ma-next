-- Store the selected posted Receipt line on an Issue line and movement so
-- outbound value can be reported using the Receipt's entered amount.

ALTER TABLE `inventory_document_lines`
  ADD COLUMN `source_receipt_line_id` VARCHAR(36) NULL,
  ADD INDEX `inventory_document_lines_receipt_source_idx` (`source_receipt_line_id`),
  ADD CONSTRAINT `inventory_document_lines_receipt_source_fk`
    FOREIGN KEY (`source_receipt_line_id`) REFERENCES `inventory_document_lines` (`id`) ON DELETE SET NULL;

ALTER TABLE `inventory_movements`
  ADD COLUMN `source_receipt_line_id` VARCHAR(36) NULL,
  ADD INDEX `inventory_movements_receipt_source_idx` (`source_receipt_line_id`),
  ADD CONSTRAINT `inventory_movements_receipt_source_fk`
    FOREIGN KEY (`source_receipt_line_id`) REFERENCES `inventory_document_lines` (`id`) ON DELETE SET NULL;
