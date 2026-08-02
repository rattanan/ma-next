-- Inventory Management module: master data, governed documents, stock projections,
-- immutable movement ledger, stock count workflow and vendor rating history.

ALTER TABLE `users`
  MODIFY COLUMN `role` ENUM('ADMIN','DATA_SOURCE_CREATOR','DASHBOARD_CREATOR','VIEWER','OPERATOR','MAINTENANCE','MAINTENANCE_MANAGER','WAREHOUSE_MANAGER','PLANT_MANAGER','TECHNICIAN') NOT NULL DEFAULT 'VIEWER';

ALTER TABLE `approval_tasks`
  MODIFY COLUMN `approval_type` ENUM('NOTIFICATION','WORK_ORDER','WORK_COMPLETION','MATERIAL_REQUEST','PURCHASE_REQUEST','PREVENTIVE_MAINTENANCE','INVENTORY') NOT NULL;

CREATE TABLE `inventory_locations` (
  `id` VARCHAR(36) NOT NULL,
  `code` VARCHAR(80) NOT NULL,
  `name` VARCHAR(190) NOT NULL,
  `plant` VARCHAR(120) NULL,
  `warehouse` VARCHAR(120) NULL,
  `zone` VARCHAR(120) NULL,
  `rack` VARCHAR(120) NULL,
  `shelf` VARCHAR(120) NULL,
  `bin` VARCHAR(120) NULL,
  `responsible_person_id` VARCHAR(36) NULL,
  `description` TEXT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `legacy_source_id` INT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `created_by` VARCHAR(36) NOT NULL,
  `updated_by` VARCHAR(36) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `inventory_locations_code_uq` (`code`),
  UNIQUE INDEX `inventory_locations_legacy_uq` (`legacy_source_id`),
  INDEX `inventory_locations_tree_idx` (`plant`,`warehouse`,`zone`,`rack`,`shelf`,`bin`),
  INDEX `inventory_locations_active_idx` (`active`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `stock_items` (
  `id` VARCHAR(36) NOT NULL,
  `code` VARCHAR(80) NOT NULL,
  `name` VARCHAR(190) NOT NULL,
  `description` TEXT NULL,
  `category` VARCHAR(120) NULL,
  `unit` VARCHAR(45) NOT NULL,
  `manufacturer` VARCHAR(160) NULL,
  `part_number` VARCHAR(120) NULL,
  `barcode` VARCHAR(160) NULL,
  `minimum_stock` DECIMAL(20,6) NOT NULL DEFAULT 0,
  `maximum_stock` DECIMAL(20,6) NULL,
  `reorder_point` DECIMAL(20,6) NULL,
  `default_unit_cost` DECIMAL(20,6) NOT NULL DEFAULT 0,
  `moving_average_cost` DECIMAL(20,6) NOT NULL DEFAULT 0,
  `main_location_id` VARCHAR(36) NULL,
  `critical_spare_part` BOOLEAN NOT NULL DEFAULT false,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `remark` TEXT NULL,
  `legacy_source_id` INT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `created_by` VARCHAR(36) NOT NULL,
  `updated_by` VARCHAR(36) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `stock_items_code_uq` (`code`),
  UNIQUE INDEX `stock_items_legacy_uq` (`legacy_source_id`),
  INDEX `stock_items_name_idx` (`name`),
  INDEX `stock_items_category_idx` (`category`),
  INDEX `stock_items_active_idx` (`active`),
  CONSTRAINT `stock_items_main_location_fk` FOREIGN KEY (`main_location_id`) REFERENCES `inventory_locations` (`id`) ON DELETE SET NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `stock_item_locations` (
  `id` VARCHAR(36) NOT NULL,
  `stock_item_id` VARCHAR(36) NOT NULL,
  `location_id` VARCHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `stock_item_locations_uq` (`stock_item_id`,`location_id`),
  INDEX `stock_item_locations_location_idx` (`location_id`),
  CONSTRAINT `stock_item_locations_item_fk` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `stock_item_locations_location_fk` FOREIGN KEY (`location_id`) REFERENCES `inventory_locations` (`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_balances` (
  `id` VARCHAR(36) NOT NULL,
  `stock_item_id` VARCHAR(36) NOT NULL,
  `location_id` VARCHAR(36) NOT NULL,
  `quantity_on_hand` DECIMAL(20,6) NOT NULL DEFAULT 0,
  `reserved_quantity` DECIMAL(20,6) NOT NULL DEFAULT 0,
  `moving_average_cost` DECIMAL(20,6) NOT NULL DEFAULT 0,
  `last_movement_date` DATETIME(3) NULL,
  `last_count_date` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `inventory_balances_item_location_uq` (`stock_item_id`,`location_id`),
  INDEX `inventory_balances_location_idx` (`location_id`),
  CONSTRAINT `inventory_balances_item_fk` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `inventory_balances_location_fk` FOREIGN KEY (`location_id`) REFERENCES `inventory_locations` (`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `vendors` (
  `id` VARCHAR(36) NOT NULL,
  `code` VARCHAR(80) NOT NULL,
  `name` VARCHAR(190) NOT NULL,
  `tax_id` VARCHAR(80) NULL,
  `address` TEXT NULL,
  `country` VARCHAR(100) NULL,
  `province` VARCHAR(120) NULL,
  `phone` VARCHAR(80) NULL,
  `email` VARCHAR(190) NULL,
  `website` VARCHAR(255) NULL,
  `payment_terms` VARCHAR(120) NULL,
  `delivery_terms` VARCHAR(120) NULL,
  `lead_time` INT NULL,
  `preferred_vendor` BOOLEAN NOT NULL DEFAULT false,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `remark` TEXT NULL,
  `legacy_source_id` INT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `created_by` VARCHAR(36) NOT NULL,
  `updated_by` VARCHAR(36) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `vendors_code_uq` (`code`),
  UNIQUE INDEX `vendors_legacy_uq` (`legacy_source_id`),
  INDEX `vendors_name_idx` (`name`),
  INDEX `vendors_active_idx` (`active`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `vendor_contacts` (
  `id` VARCHAR(36) NOT NULL,
  `vendor_id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `position` VARCHAR(120) NULL,
  `department` VARCHAR(120) NULL,
  `phone` VARCHAR(80) NULL,
  `mobile` VARCHAR(80) NULL,
  `email` VARCHAR(190) NULL,
  `line_id` VARCHAR(80) NULL,
  `primary_contact` BOOLEAN NOT NULL DEFAULT false,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `remark` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `vendor_contacts_vendor_idx` (`vendor_id`,`active`),
  CONSTRAINT `vendor_contacts_vendor_fk` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `vendor_ratings` (
  `id` VARCHAR(36) NOT NULL,
  `vendor_id` VARCHAR(36) NOT NULL,
  `calculated_score` DECIMAL(6,2) NULL,
  `manual_score` DECIMAL(6,2) NULL,
  `final_score` DECIMAL(6,2) NULL,
  `rating_grade` VARCHAR(2) NULL,
  `last_calculated_date` DATETIME(3) NULL,
  `manual_adjustment_reason` TEXT NULL,
  `adjusted_by` VARCHAR(36) NULL,
  `adjusted_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `vendor_ratings_vendor_uq` (`vendor_id`),
  CONSTRAINT `vendor_ratings_vendor_fk` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `vendor_rating_history` (
  `id` VARCHAR(36) NOT NULL,
  `vendor_id` VARCHAR(36) NOT NULL,
  `calculated_score` DECIMAL(6,2) NULL,
  `manual_score` DECIMAL(6,2) NULL,
  `final_score` DECIMAL(6,2) NULL,
  `rating_grade` VARCHAR(2) NULL,
  `reason` TEXT NULL,
  `changed_by` VARCHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `vendor_rating_history_idx` (`vendor_id`,`created_at`),
  CONSTRAINT `vendor_rating_history_vendor_fk` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_documents` (
  `id` VARCHAR(36) NOT NULL,
  `document_type` ENUM('ISSUE','RECEIPT','TRANSFER') NOT NULL,
  `document_number` VARCHAR(80) NOT NULL,
  `document_date` DATETIME(3) NOT NULL,
  `site_id` VARCHAR(36) NULL,
  `requester_id` VARCHAR(36) NOT NULL,
  `department_id` VARCHAR(36) NULL,
  `purpose` TEXT NULL,
  `reference_work_order_id` VARCHAR(36) NULL,
  `reference_notification_id` VARCHAR(36) NULL,
  `status` ENUM('DRAFT','PENDING_MAINTENANCE_MANAGER','PENDING_WAREHOUSE_MANAGER','APPROVED','POSTED','RETURNED','REJECTED','CANCELLED','POSTING_FAILED') NOT NULL DEFAULT 'DRAFT',
  `current_approval_step` ENUM('MAINTENANCE_MANAGER','WAREHOUSE_MANAGER','PLANT_MANAGER') NULL,
  `remark` TEXT NULL,
  `submitted_at` DATETIME(3) NULL,
  `posted_at` DATETIME(3) NULL,
  `posted_by` VARCHAR(36) NULL,
  `posting_transaction_id` VARCHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `created_by` VARCHAR(36) NOT NULL,
  `updated_by` VARCHAR(36) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `inventory_documents_number_uq` (`document_number`),
  UNIQUE INDEX `inventory_documents_posting_uq` (`posting_transaction_id`),
  INDEX `inventory_documents_workflow_idx` (`status`,`current_approval_step`),
  INDEX `inventory_documents_requester_idx` (`requester_id`,`created_at`),
  INDEX `inventory_documents_type_date_idx` (`document_type`,`document_date`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_document_lines` (
  `id` VARCHAR(36) NOT NULL,
  `document_id` VARCHAR(36) NOT NULL,
  `line_number` INT NOT NULL,
  `stock_item_id` VARCHAR(36) NOT NULL,
  `source_location_id` VARCHAR(36) NULL,
  `destination_location_id` VARCHAR(36) NULL,
  `requested_quantity` DECIMAL(20,6) NOT NULL,
  `approved_quantity` DECIMAL(20,6) NULL,
  `rejected_quantity` DECIMAL(20,6) NOT NULL DEFAULT 0,
  `unit` VARCHAR(45) NOT NULL,
  `unit_cost` DECIMAL(20,6) NOT NULL DEFAULT 0,
  `total_amount` DECIMAL(20,6) NOT NULL DEFAULT 0,
  `vendor_id` VARCHAR(36) NULL,
  `purchase_order_reference` VARCHAR(120) NULL,
  `expected_delivery_date` DATETIME(3) NULL,
  `actual_delivery_date` DATETIME(3) NULL,
  `work_order_id` VARCHAR(36) NULL,
  `job_step_id` VARCHAR(36) NULL,
  `remark` TEXT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `inventory_document_lines_number_uq` (`document_id`,`line_number`),
  INDEX `inventory_document_lines_item_idx` (`stock_item_id`),
  CONSTRAINT `inventory_document_lines_document_fk` FOREIGN KEY (`document_id`) REFERENCES `inventory_documents` (`id`) ON DELETE CASCADE,
  CONSTRAINT `inventory_document_lines_item_fk` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items` (`id`),
  CONSTRAINT `inventory_document_lines_source_fk` FOREIGN KEY (`source_location_id`) REFERENCES `inventory_locations` (`id`),
  CONSTRAINT `inventory_document_lines_destination_fk` FOREIGN KEY (`destination_location_id`) REFERENCES `inventory_locations` (`id`),
  CONSTRAINT `inventory_document_lines_vendor_fk` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE SET NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_document_attachments` (
  `id` VARCHAR(36) NOT NULL,
  `document_id` VARCHAR(36) NOT NULL,
  `attachment_id` VARCHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `inventory_document_attachments_uq` (`document_id`,`attachment_id`),
  INDEX `inventory_document_attachments_attachment_idx` (`attachment_id`),
  CONSTRAINT `inventory_document_attachments_document_fk` FOREIGN KEY (`document_id`) REFERENCES `inventory_documents` (`id`) ON DELETE CASCADE,
  CONSTRAINT `inventory_document_attachments_attachment_fk` FOREIGN KEY (`attachment_id`) REFERENCES `attachments` (`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `stock_counts` (
  `id` VARCHAR(36) NOT NULL,
  `count_number` VARCHAR(80) NOT NULL,
  `count_date` DATETIME(3) NOT NULL,
  `cutoff_at` DATETIME(3) NOT NULL,
  `site_id` VARCHAR(36) NULL,
  `location_id` VARCHAR(36) NULL,
  `count_type` ENUM('FULL_COUNT','CYCLE_COUNT','LOCATION','STOCK_ITEM','CATEGORY') NOT NULL,
  `responsible_person_id` VARCHAR(36) NULL,
  `status` ENUM('DRAFT','COUNTING','PENDING_PLANT_MANAGER','APPROVED','POSTED','RETURNED','REJECTED','POSTING_FAILED') NOT NULL DEFAULT 'DRAFT',
  `remark` TEXT NULL,
  `submitted_at` DATETIME(3) NULL,
  `approved_at` DATETIME(3) NULL,
  `posted_at` DATETIME(3) NULL,
  `posted_by` VARCHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `created_by` VARCHAR(36) NOT NULL,
  `updated_by` VARCHAR(36) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `stock_counts_number_uq` (`count_number`),
  INDEX `stock_counts_workflow_idx` (`status`,`cutoff_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `stock_count_lines` (
  `id` VARCHAR(36) NOT NULL,
  `stock_count_id` VARCHAR(36) NOT NULL,
  `stock_item_id` VARCHAR(36) NOT NULL,
  `location_id` VARCHAR(36) NOT NULL,
  `system_quantity` DECIMAL(20,6) NOT NULL,
  `counted_quantity` DECIMAL(20,6) NULL,
  `variance_quantity` DECIMAL(20,6) NULL,
  `unit_cost` DECIMAL(20,6) NOT NULL,
  `variance_amount` DECIMAL(20,6) NULL,
  `remark` TEXT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `stock_count_lines_item_location_uq` (`stock_count_id`,`stock_item_id`,`location_id`),
  CONSTRAINT `stock_count_lines_count_fk` FOREIGN KEY (`stock_count_id`) REFERENCES `stock_counts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `stock_count_lines_item_fk` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items` (`id`),
  CONSTRAINT `stock_count_lines_location_fk` FOREIGN KEY (`location_id`) REFERENCES `inventory_locations` (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_approvals` (
  `id` VARCHAR(36) NOT NULL,
  `document_id` VARCHAR(36) NULL,
  `stock_count_id` VARCHAR(36) NULL,
  `step` ENUM('MAINTENANCE_MANAGER','WAREHOUSE_MANAGER','PLANT_MANAGER') NOT NULL,
  `sequence` INT NOT NULL,
  `status` ENUM('PENDING','IN_REVIEW','APPROVED','RETURNED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `assigned_role` VARCHAR(80) NOT NULL,
  `assigned_to` VARCHAR(36) NULL,
  `requested_by` VARCHAR(36) NOT NULL,
  `requested_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `decision_by` VARCHAR(36) NULL,
  `decision_comment` TEXT NULL,
  `decided_at` DATETIME(3) NULL,
  `round` INT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  INDEX `inventory_approvals_role_status_idx` (`assigned_role`,`status`),
  INDEX `inventory_approvals_requester_idx` (`requested_by`,`requested_at`),
  UNIQUE INDEX `inventory_approvals_document_step_uq` (`document_id`,`step`,`round`),
  UNIQUE INDEX `inventory_approvals_count_step_uq` (`stock_count_id`,`step`,`round`),
  CONSTRAINT `inventory_approvals_document_fk` FOREIGN KEY (`document_id`) REFERENCES `inventory_documents` (`id`) ON DELETE CASCADE,
  CONSTRAINT `inventory_approvals_count_fk` FOREIGN KEY (`stock_count_id`) REFERENCES `stock_counts` (`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_movements` (
  `id` VARCHAR(36) NOT NULL,
  `movement_type` ENUM('ISSUE','RECEIPT','TRANSFER_OUT','TRANSFER_IN','ADJUST_IN','ADJUST_OUT','REVERSAL') NOT NULL,
  `document_id` VARCHAR(36) NULL,
  `document_number` VARCHAR(80) NULL,
  `line_id` VARCHAR(36) NULL,
  `stock_item_id` VARCHAR(36) NOT NULL,
  `location_id` VARCHAR(36) NOT NULL,
  `source_location_id` VARCHAR(36) NULL,
  `destination_location_id` VARCHAR(36) NULL,
  `quantity_in` DECIMAL(20,6) NOT NULL DEFAULT 0,
  `quantity_out` DECIMAL(20,6) NOT NULL DEFAULT 0,
  `quantity_before` DECIMAL(20,6) NOT NULL,
  `quantity_after` DECIMAL(20,6) NOT NULL,
  `unit_cost` DECIMAL(20,6) NOT NULL,
  `amount_in` DECIMAL(20,6) NOT NULL DEFAULT 0,
  `amount_out` DECIMAL(20,6) NOT NULL DEFAULT 0,
  `value_before` DECIMAL(20,6) NOT NULL,
  `value_after` DECIMAL(20,6) NOT NULL,
  `moving_average_cost_before` DECIMAL(20,6) NOT NULL,
  `moving_average_cost_after` DECIMAL(20,6) NOT NULL,
  `vendor_id` VARCHAR(36) NULL,
  `work_order_id` VARCHAR(36) NULL,
  `stock_count_id` VARCHAR(36) NULL,
  `posted_by` VARCHAR(36) NOT NULL,
  `posted_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `inventory_movements_item_location_idx` (`stock_item_id`,`location_id`,`posted_at`),
  INDEX `inventory_movements_document_idx` (`document_id`),
  INDEX `inventory_movements_type_date_idx` (`movement_type`,`posted_at`),
  CONSTRAINT `inventory_movements_item_fk` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items` (`id`),
  CONSTRAINT `inventory_movements_document_fk` FOREIGN KEY (`document_id`) REFERENCES `inventory_documents` (`id`) ON DELETE SET NULL,
  CONSTRAINT `inventory_movements_location_fk` FOREIGN KEY (`location_id`) REFERENCES `inventory_locations` (`id`),
  CONSTRAINT `inventory_movements_source_fk` FOREIGN KEY (`source_location_id`) REFERENCES `inventory_locations` (`id`),
  CONSTRAINT `inventory_movements_destination_fk` FOREIGN KEY (`destination_location_id`) REFERENCES `inventory_locations` (`id`),
  CONSTRAINT `inventory_movements_vendor_fk` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE SET NULL,
  CONSTRAINT `inventory_movements_count_fk` FOREIGN KEY (`stock_count_id`) REFERENCES `stock_counts` (`id`) ON DELETE SET NULL
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_document_sequences` (
  `id` VARCHAR(36) NOT NULL,
  `sequence_key` VARCHAR(80) NOT NULL,
  `prefix` VARCHAR(30) NOT NULL,
  `next_number` INT NOT NULL DEFAULT 1,
  `padding` INT NOT NULL DEFAULT 5,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `updated_by` VARCHAR(36) NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `inventory_document_sequences_key_uq` (`sequence_key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_settings` (
  `id` VARCHAR(36) NOT NULL,
  `setting_key` VARCHAR(120) NOT NULL,
  `value` TEXT NOT NULL,
  `description` TEXT NULL,
  `updated_by` VARCHAR(36) NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `inventory_settings_key_uq` (`setting_key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `inventory_settings` (`id`,`setting_key`,`value`,`description`,`updated_at`)
VALUES ('00000000-0000-5000-8000-000000000001','ALLOW_NEGATIVE_STOCK','false','Allow issue transactions to post below zero on-hand quantity',CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `setting_key`=`setting_key`;
