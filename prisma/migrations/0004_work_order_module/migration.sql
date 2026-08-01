ALTER TABLE `work_orders`
  MODIFY COLUMN `notification_id` VARCHAR(36) NULL,
  ADD COLUMN `source_type` ENUM('MANUAL','NOTIFICATION','PREVENTIVE_EVENT','SHUTDOWN_TASK','IMPORT') NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN `source_record_id` VARCHAR(80) NULL,
  ADD COLUMN `work_type` ENUM('PREVENTIVE','CORRECTIVE','SHUTDOWN','OTHER_ASSIGNMENT') NOT NULL DEFAULT 'CORRECTIVE',
  ADD COLUMN `equipment_operating_status` ENUM('RUNNING','STOPPED','DEGRADED','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN `crew_name` VARCHAR(160) NULL,
  ADD COLUMN `lead_user_id` VARCHAR(36) NULL,
  ADD COLUMN `vendor_name` VARCHAR(190) NULL,
  ADD COLUMN `customer_name` VARCHAR(190) NULL,
  ADD COLUMN `reporter_name` VARCHAR(160) NULL,
  ADD COLUMN `reporter_phone` VARCHAR(60) NULL,
  ADD COLUMN `reported_at` DATETIME(3) NULL,
  ADD COLUMN `planned_start_at` DATETIME(3) NULL,
  ADD COLUMN `planned_finish_at` DATETIME(3) NULL,
  ADD COLUMN `estimated_minutes` INT NULL,
  ADD COLUMN `actual_finish_at` DATETIME(3) NULL,
  ADD COLUMN `checklist_template_id` VARCHAR(36) NULL,
  ADD COLUMN `maintenance_template_id` VARCHAR(36) NULL,
  ADD COLUMN `notes` LONGTEXT NULL,
  ADD COLUMN `legacy_id` INT NULL,
  ADD COLUMN `legacy_type` VARCHAR(80) NULL,
  ADD COLUMN `legacy_status` VARCHAR(80) NULL,
  ADD UNIQUE INDEX `work_orders_source_uq` (`source_type`, `source_record_id`),
  ADD UNIQUE INDEX `work_orders_legacy_uq` (`legacy_id`),
  ADD INDEX `work_orders_type_priority_idx` (`work_type`, `priority`),
  ADD INDEX `work_orders_department_due_idx` (`department_id`, `due_at`),
  ADD CONSTRAINT `work_orders_lead_user_fk` FOREIGN KEY (`lead_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

UPDATE `work_orders` SET `source_type`='NOTIFICATION', `source_record_id`=`notification_id` WHERE `notification_id` IS NOT NULL;

ALTER TABLE `work_execution_entries`
  ADD COLUMN `department_id` VARCHAR(36) NULL,
  ADD COLUMN `employee_id` VARCHAR(36) NULL,
  ADD COLUMN `position_name` VARCHAR(160) NULL,
  ADD COLUMN `work_type` VARCHAR(80) NULL;

ALTER TABLE `work_order_spare_parts`
  ADD COLUMN `transaction_type` VARCHAR(40) NOT NULL DEFAULT 'CONSUMED',
  ADD COLUMN `warehouse` VARCHAR(120) NULL,
  ADD COLUMN `storage_location` VARCHAR(120) NULL,
  ADD COLUMN `unit_snapshot` VARCHAR(40) NULL,
  ADD COLUMN `reference_document` VARCHAR(190) NULL;

ALTER TABLE `work_order_tasks`
  MODIFY COLUMN `status` ENUM('OPEN','IN_PROGRESS','BACKLOG','COMPLETED') NOT NULL DEFAULT 'OPEN',
  ADD COLUMN `asset_id` VARCHAR(36) NULL,
  ADD COLUMN `due_at` DATETIME(3) NULL,
  ADD COLUMN `estimated_minutes` INT NULL,
  ADD COLUMN `actual_minutes` INT NULL,
  ADD COLUMN `result` LONGTEXT NULL,
  ADD COLUMN `notes` LONGTEXT NULL,
  ADD COLUMN `response_type` VARCHAR(40) NULL,
  ADD COLUMN `response_value` LONGTEXT NULL,
  ADD COLUMN `remarks` LONGTEXT NULL,
  ADD COLUMN `evidence_attachment_id` VARCHAR(36) NULL,
  ADD COLUMN `legacy_id` INT NULL,
  ADD UNIQUE INDEX `work_order_tasks_legacy_uq` (`legacy_id`),
  ADD CONSTRAINT `work_order_tasks_asset_fk` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE SET NULL;

CREATE TABLE `work_order_assets` (
  `id` VARCHAR(36) NOT NULL, `work_order_id` VARCHAR(36) NOT NULL, `asset_id` VARCHAR(36) NOT NULL,
  `role` VARCHAR(40) NOT NULL DEFAULT 'RELATED', `sequence` INT NOT NULL DEFAULT 10, `notes` LONGTEXT NULL, `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE INDEX `work_order_assets_role_uq` (`work_order_id`,`asset_id`,`role`), INDEX `work_order_assets_order_idx` (`work_order_id`,`sequence`),
  CONSTRAINT `work_order_assets_order_fk` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `work_order_assets_asset_fk` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`)
);

CREATE TABLE `work_order_assignments` (
  `id` VARCHAR(36) NOT NULL, `work_order_id` VARCHAR(36) NOT NULL, `department_id` VARCHAR(36) NULL, `user_id` VARCHAR(36) NULL,
  `team_name` VARCHAR(160) NULL, `position_name` VARCHAR(160) NULL, `assignment_type` VARCHAR(40) NOT NULL DEFAULT 'TECHNICIAN',
  `assigned_at` DATETIME(3) NOT NULL, `ended_at` DATETIME(3) NULL, `assigned_by` VARCHAR(36) NOT NULL, `note` LONGTEXT NULL,
  PRIMARY KEY (`id`), INDEX `work_order_assignments_order_idx` (`work_order_id`,`assigned_at`), INDEX `work_order_assignments_user_idx` (`user_id`,`ended_at`),
  CONSTRAINT `work_order_assignments_order_fk` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `work_order_assignments_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `work_order_assignments_actor_fk` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`)
);

CREATE TABLE `work_order_backlog_events` (
  `id` VARCHAR(36) NOT NULL, `work_order_id` VARCHAR(36) NOT NULL, `task_id` VARCHAR(36) NULL,
  `scope` ENUM('WORK_ORDER','JOB_STEP') NOT NULL DEFAULT 'WORK_ORDER', `previous_status` ENUM('OPEN','BACKLOG','IN_PROGRESS','COMPLETION_PENDING','VERIFIED','CLOSED') NULL,
  `reason_code` VARCHAR(60) NULL, `reason` LONGTEXT NOT NULL, `category` VARCHAR(80) NULL, `expected_resume_at` DATETIME(3) NULL,
  `entered_by` VARCHAR(36) NOT NULL, `entered_at` DATETIME(3) NOT NULL, `resumed_by` VARCHAR(36) NULL, `resumed_at` DATETIME(3) NULL, `resolution` LONGTEXT NULL,
  PRIMARY KEY (`id`), INDEX `work_order_backlog_order_idx` (`work_order_id`,`entered_at`), INDEX `work_order_backlog_task_idx` (`task_id`,`resumed_at`),
  CONSTRAINT `work_order_backlog_order_fk` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `work_order_backlog_task_fk` FOREIGN KEY (`task_id`) REFERENCES `work_order_tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `work_order_backlog_entered_fk` FOREIGN KEY (`entered_by`) REFERENCES `users` (`id`),
  CONSTRAINT `work_order_backlog_resumed_fk` FOREIGN KEY (`resumed_by`) REFERENCES `users` (`id`)
);

CREATE TABLE `work_order_tool_loans` (
  `id` VARCHAR(36) NOT NULL, `work_order_id` VARCHAR(36) NOT NULL, `tool_code` VARCHAR(80) NOT NULL, `tool_name` VARCHAR(190) NOT NULL,
  `quantity` DECIMAL(14,4) NOT NULL, `usage_condition` LONGTEXT NULL, `status` ENUM('PLANNED','ISSUED','RETURNED','CANCELLED') NOT NULL DEFAULT 'PLANNED',
  `issued_at` DATETIME(3) NULL, `returned_at` DATETIME(3) NULL, `issued_by` VARCHAR(36) NULL, `returned_by` VARCHAR(36) NULL,
  `notes` LONGTEXT NULL, `created_at` DATETIME(3) NOT NULL, `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), INDEX `work_order_tool_loans_order_idx` (`work_order_id`,`status`),
  CONSTRAINT `work_order_tool_loans_order_fk` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `work_order_tool_loans_issued_fk` FOREIGN KEY (`issued_by`) REFERENCES `users` (`id`),
  CONSTRAINT `work_order_tool_loans_returned_fk` FOREIGN KEY (`returned_by`) REFERENCES `users` (`id`)
);

CREATE TABLE `work_order_acceptances` (
  `id` VARCHAR(36) NOT NULL, `work_order_id` VARCHAR(36) NOT NULL, `accepted_at` DATETIME(3) NOT NULL, `accepted_by` VARCHAR(36) NOT NULL,
  `details` LONGTEXT NOT NULL, `notes` LONGTEXT NULL, `loto_reference` VARCHAR(190) NULL, `isolation_points` LONGTEXT NULL,
  `permit_number` VARCHAR(120) NULL, `safety_instructions` LONGTEXT NULL, `hazards` LONGTEXT NULL, `operating_conditions` LONGTEXT NULL,
  `log_sheet_reference` VARCHAR(190) NULL, `test_result` LONGTEXT NULL, `handover_details` LONGTEXT NULL, `attachment_ids` LONGTEXT NULL, `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), INDEX `work_order_acceptances_order_idx` (`work_order_id`,`accepted_at`),
  CONSTRAINT `work_order_acceptances_order_fk` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `work_order_acceptances_user_fk` FOREIGN KEY (`accepted_by`) REFERENCES `users` (`id`)
);
