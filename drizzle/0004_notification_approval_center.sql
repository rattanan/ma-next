ALTER TABLE `maintenance_notifications`
  MODIFY COLUMN `status` ENUM('NEW','BACKLOG','COMPLETED','DRAFT','SUBMITTED','UNDER_REVIEW','RETURNED','NEEDS_INFORMATION','REJECTED','APPROVED','CONVERTED_TO_WORK_ORDER','IN_MAINTENANCE','WAITING_FOR_OPERATOR_ACCEPTANCE','OPERATOR_REJECTED','OPERATOR_ACCEPTED','READY_TO_CLOSE','CLOSED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN `problem_category` VARCHAR(120) NULL,
  ADD COLUMN `safety_impact` TEXT NULL,
  ADD COLUMN `production_impact` TEXT NULL,
  ADD COLUMN `incident_at` DATETIME(3) NULL,
  ADD COLUMN `responsible_group` VARCHAR(160) NULL,
  ADD COLUMN `remarks` TEXT NULL;

ALTER TABLE `maintenance_notification_events`
  MODIFY COLUMN `from_status` ENUM('NEW','BACKLOG','COMPLETED','DRAFT','SUBMITTED','UNDER_REVIEW','RETURNED','NEEDS_INFORMATION','REJECTED','APPROVED','CONVERTED_TO_WORK_ORDER','IN_MAINTENANCE','WAITING_FOR_OPERATOR_ACCEPTANCE','OPERATOR_REJECTED','OPERATOR_ACCEPTED','READY_TO_CLOSE','CLOSED','CANCELLED') NULL,
  MODIFY COLUMN `to_status` ENUM('NEW','BACKLOG','COMPLETED','DRAFT','SUBMITTED','UNDER_REVIEW','RETURNED','NEEDS_INFORMATION','REJECTED','APPROVED','CONVERTED_TO_WORK_ORDER','IN_MAINTENANCE','WAITING_FOR_OPERATOR_ACCEPTANCE','OPERATOR_REJECTED','OPERATOR_ACCEPTED','READY_TO_CLOSE','CLOSED','CANCELLED') NULL;

CREATE TABLE `approval_tasks` (
  `id` VARCHAR(36) NOT NULL,
  `approval_type` ENUM('NOTIFICATION','WORK_ORDER','WORK_COMPLETION','MATERIAL_REQUEST','PURCHASE_REQUEST','PREVENTIVE_MAINTENANCE') NOT NULL,
  `reference_id` VARCHAR(36) NOT NULL,
  `reference_number` VARCHAR(80) NOT NULL,
  `title` VARCHAR(190) NOT NULL,
  `requested_by_id` VARCHAR(36) NOT NULL,
  `requested_at` DATETIME(3) NOT NULL,
  `assigned_approver_id` VARCHAR(36) NULL,
  `assigned_role` VARCHAR(80) NULL,
  `status` ENUM('PENDING','IN_REVIEW','APPROVED','RETURNED','REJECTED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  `priority` ENUM('LOW','MEDIUM','HIGH','CRITICAL') NULL,
  `organization_id` VARCHAR(36) NULL,
  `site_id` VARCHAR(36) NULL,
  `department_id` VARCHAR(36) NULL,
  `reviewed_at` DATETIME(3) NULL,
  `completed_at` DATETIME(3) NULL,
  `decision_by_id` VARCHAR(36) NULL,
  `decision_comment` TEXT NULL,
  `return_reason` TEXT NULL,
  `approval_round` INT NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `approval_tasks_reference_round_uq` (`approval_type`, `reference_id`, `approval_round`),
  INDEX `approval_tasks_assignee_status_idx` (`assigned_approver_id`, `status`),
  INDEX `approval_tasks_role_status_idx` (`assigned_role`, `status`),
  INDEX `approval_tasks_scope_idx` (`organization_id`, `site_id`, `department_id`),
  INDEX `approval_tasks_requested_idx` (`requested_at`),
  CONSTRAINT `approval_tasks_requester_fk` FOREIGN KEY (`requested_by_id`) REFERENCES `users` (`id`),
  CONSTRAINT `approval_tasks_approver_fk` FOREIGN KEY (`assigned_approver_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `approval_tasks_decision_user_fk` FOREIGN KEY (`decision_by_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
);

CREATE TABLE `approval_history` (
  `id` VARCHAR(36) NOT NULL,
  `approval_task_id` VARCHAR(36) NOT NULL,
  `action` ENUM('SUBMITTED','OPENED','APPROVED','RETURNED','REJECTED','RESUBMITTED','CANCELLED') NOT NULL,
  `action_by_id` VARCHAR(36) NOT NULL,
  `comment` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `approval_history_task_idx` (`approval_task_id`, `created_at`),
  CONSTRAINT `approval_history_task_fk` FOREIGN KEY (`approval_task_id`) REFERENCES `approval_tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `approval_history_actor_fk` FOREIGN KEY (`action_by_id`) REFERENCES `users` (`id`)
);
