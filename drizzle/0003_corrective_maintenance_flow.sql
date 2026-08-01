ALTER TABLE `maintenance_notifications`
  ADD COLUMN `severity` ENUM('MINOR','MODERATE','MAJOR','CRITICAL') NOT NULL DEFAULT 'MODERATE',
  ADD COLUMN `equipment_operating_status` ENUM('RUNNING','STOPPED','DEGRADED','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN `department_id` VARCHAR(36) NULL,
  ADD COLUMN `assigned_person_id` VARCHAR(36) NULL,
  ADD COLUMN `photo_attachment_ids` LONGTEXT NULL,
  ADD INDEX `maintenance_notifications_department_idx` (`department_id`),
  ADD INDEX `maintenance_notifications_assigned_person_idx` (`assigned_person_id`),
  ADD CONSTRAINT `maintenance_notifications_assigned_person_fk` FOREIGN KEY (`assigned_person_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;
ALTER TABLE `work_orders` ADD COLUMN `severity` ENUM('MINOR','MODERATE','MAJOR','CRITICAL') NOT NULL DEFAULT 'MODERATE', ADD COLUMN `department_id` VARCHAR(36) NULL, ADD COLUMN `backlog_reason` TEXT NULL, ADD INDEX `work_orders_department_idx` (`department_id`);
ALTER TABLE `work_order_tasks` ADD COLUMN `kind` ENUM('JOB_STEP','CHECKLIST') NOT NULL DEFAULT 'JOB_STEP';
ALTER TABLE `work_execution_entries` ADD COLUMN `overtime_minutes` INT NOT NULL DEFAULT 0, ADD COLUMN `overtime_multiplier` DECIMAL(4,2) NOT NULL DEFAULT 1.00;
ALTER TABLE `work_order_completions` ADD COLUMN `before_photo_attachment_ids` LONGTEXT NULL, ADD COLUMN `after_photo_attachment_ids` LONGTEXT NULL;
CREATE TABLE `work_order_spare_parts` (`id` VARCHAR(36) NOT NULL, `work_order_id` VARCHAR(36) NOT NULL, `spare_part_id` VARCHAR(36) NOT NULL, `quantity` DECIMAL(14,4) NOT NULL, `note` TEXT NULL, `used_by` VARCHAR(36) NOT NULL, `used_at` DATETIME(3) NOT NULL, PRIMARY KEY (`id`), INDEX `work_order_spare_parts_order_idx` (`work_order_id`, `used_at`), CONSTRAINT `work_order_spare_parts_order_fk` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders` (`id`) ON DELETE CASCADE, CONSTRAINT `work_order_spare_parts_spare_fk` FOREIGN KEY (`spare_part_id`) REFERENCES `spare_parts` (`id`), CONSTRAINT `work_order_spare_parts_user_fk` FOREIGN KEY (`used_by`) REFERENCES `users` (`id`));
