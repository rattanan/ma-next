-- Extend the sequential purchasing domain with purchase-order receipt tracking.

ALTER TABLE `purchase_orders`
  ADD COLUMN `site_id` VARCHAR(36) NULL,
  ADD COLUMN `expected_delivery_date` DATETIME(3) NULL,
  ADD COLUMN `work_order_id` VARCHAR(36) NULL,
  ADD COLUMN `asset_id` VARCHAR(36) NULL,
  ADD INDEX `purchase_orders_receipt_queue_idx` (`status`, `expected_delivery_date`);

ALTER TABLE `purchase_order_lines`
  ADD COLUMN `rejected_quantity` DECIMAL(20,6) NOT NULL DEFAULT 0,
  ADD COLUMN `returned_quantity` DECIMAL(20,6) NOT NULL DEFAULT 0,
  ADD COLUMN `expected_delivery_date` DATETIME(3) NULL,
  ADD COLUMN `work_order_id` VARCHAR(36) NULL,
  ADD COLUMN `asset_id` VARCHAR(36) NULL;

ALTER TABLE `inventory_documents`
  ADD COLUMN `purchase_order_id` VARCHAR(36) NULL,
  ADD INDEX `inventory_documents_po_status_idx` (`purchase_order_id`, `status`),
  ADD CONSTRAINT `inventory_documents_po_fk`
    FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE SET NULL;

ALTER TABLE `inventory_document_lines`
  ADD COLUMN `purchase_order_line_id` VARCHAR(36) NULL,
  ADD INDEX `inventory_document_lines_po_line_idx` (`purchase_order_line_id`),
  ADD CONSTRAINT `inventory_document_lines_po_line_fk`
    FOREIGN KEY (`purchase_order_line_id`) REFERENCES `purchase_order_lines` (`id`) ON DELETE SET NULL;
