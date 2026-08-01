-- Add the governed maintenance states without deleting legacy values. Existing
-- values are mapped conservatively below, then new commands exclusively use the
-- expanded state machine.
ALTER TABLE `users`
  MODIFY COLUMN `role` ENUM('ADMIN','DATA_SOURCE_CREATOR','DASHBOARD_CREATOR','VIEWER','OPERATOR','MAINTENANCE_MANAGER','TECHNICIAN') NOT NULL DEFAULT 'VIEWER';

ALTER TABLE `audit_logs`
  ADD COLUMN `actor_role` VARCHAR(80) NULL,
  ADD COLUMN `organization_id` VARCHAR(36) NULL,
  ADD INDEX `audit_organization_idx` (`organization_id`, `created_at`);

ALTER TABLE `maintenance_notifications`
  MODIFY COLUMN `status` ENUM('NEW','BACKLOG','COMPLETED','DRAFT','SUBMITTED','UNDER_REVIEW','NEEDS_INFORMATION','REJECTED','APPROVED','IN_MAINTENANCE','WAITING_FOR_OPERATOR_ACCEPTANCE','OPERATOR_REJECTED','OPERATOR_ACCEPTED','READY_TO_CLOSE','CLOSED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN `organization_id` VARCHAR(36) NULL,
  ADD COLUMN `site_id` VARCHAR(36) NULL,
  ADD COLUMN `symptoms` TEXT NULL,
  ADD COLUMN `operational_impact` TEXT NULL,
  ADD COLUMN `requested_urgency` VARCHAR(80) NULL,
  ADD COLUMN `contact_person` VARCHAR(160) NULL,
  ADD COLUMN `contact_phone` VARCHAR(60) NULL,
  ADD COLUMN `submitted_at` DATETIME(3) NULL,
  ADD COLUMN `reviewed_by` VARCHAR(36) NULL,
  ADD COLUMN `information_request` TEXT NULL,
  ADD COLUMN `rejection_reason` TEXT NULL,
  ADD COLUMN `operator_accepted_by` VARCHAR(36) NULL,
  ADD COLUMN `operator_accepted_at` DATETIME(3) NULL,
  ADD COLUMN `operator_rejection_reason` TEXT NULL,
  ADD COLUMN `closed_by` VARCHAR(36) NULL,
  ADD COLUMN `closed_at` DATETIME(3) NULL,
  ADD INDEX `maintenance_notifications_org_idx` (`organization_id`, `status`),
  ADD CONSTRAINT `maintenance_notifications_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `maintenance_notifications_site_fk` FOREIGN KEY (`site_id`) REFERENCES `sites` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `maintenance_notifications_reviewed_by_fk` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `maintenance_notifications_accepted_by_fk` FOREIGN KEY (`operator_accepted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `maintenance_notifications_closed_by_fk` FOREIGN KEY (`closed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

ALTER TABLE `notification_reviews`
  MODIFY COLUMN `decision` ENUM('APPROVED','BACKLOG','REJECTED','NEEDS_INFORMATION') NOT NULL,
  DROP INDEX `notification_reviews_notification_id_key`,
  ADD INDEX `notification_reviews_history_idx` (`notification_id`, `reviewed_at`);

ALTER TABLE `work_orders`
  MODIFY COLUMN `status` ENUM('OPEN','BACKLOG','COMPLETION_PENDING','VERIFIED','CREATED','ASSIGNED','TECHNICIAN_ACCEPTED','IN_PROGRESS','WAITING_FOR_PARTS','WAITING_FOR_VENDOR','WAITING_FOR_ACCESS','ON_HOLD','TECHNICIAN_COMPLETED','UNDER_MANAGER_REVIEW','RETURNED_TO_TECHNICIAN','MANAGER_APPROVED','WAITING_FOR_OPERATOR_ACCEPTANCE','OPERATOR_REJECTED','OPERATOR_ACCEPTED','CLOSED','CANCELLED') NOT NULL DEFAULT 'CREATED',
  DROP INDEX `work_orders_notification_id_key`,
  ADD COLUMN `organization_id` VARCHAR(36) NULL,
  ADD COLUMN `site_id` VARCHAR(36) NULL,
  ADD COLUMN `assigned_at` DATETIME(3) NULL,
  ADD COLUMN `assigned_by` VARCHAR(36) NULL,
  ADD COLUMN `technician_accepted_at` DATETIME(3) NULL,
  ADD COLUMN `technician_completed_at` DATETIME(3) NULL,
  ADD COLUMN `manager_approved_at` DATETIME(3) NULL,
  ADD COLUMN `operator_accepted_at` DATETIME(3) NULL,
  ADD INDEX `work_orders_notification_idx` (`notification_id`),
  ADD INDEX `work_orders_org_idx` (`organization_id`, `status`),
  ADD CONSTRAINT `work_orders_org_fk` FOREIGN KEY (`organization_id`) REFERENCES `organizations` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `work_orders_site_fk` FOREIGN KEY (`site_id`) REFERENCES `sites` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `work_orders_assigned_by_fk` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

ALTER TABLE `work_order_completions`
  ADD COLUMN `revision_number` INT NOT NULL DEFAULT 1,
  ADD COLUMN `root_cause_unknown_reason` TEXT NULL,
  ADD COLUMN `test_procedure` TEXT NULL,
  ADD COLUMN `test_result` TEXT NULL,
  ADD COLUMN `remaining_issue` TEXT NULL,
  ADD COLUMN `recommendation` TEXT NULL,
  ADD COLUMN `manager_decision` ENUM('PENDING','APPROVED','RETURNED') NOT NULL DEFAULT 'PENDING',
  ADD COLUMN `manager_id` VARCHAR(36) NULL,
  ADD COLUMN `manager_comment` TEXT NULL,
  ADD COLUMN `manager_reviewed_at` DATETIME(3) NULL,
  ADD CONSTRAINT `work_order_completions_manager_fk` FOREIGN KEY (`manager_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

UPDATE `work_order_completions` c
JOIN (
  SELECT current_row.id, COUNT(previous_row.id) AS revision_number
  FROM `work_order_completions` current_row
  JOIN `work_order_completions` previous_row
    ON previous_row.work_order_id=current_row.work_order_id
   AND (previous_row.completed_at < current_row.completed_at
     OR (previous_row.completed_at=current_row.completed_at AND previous_row.id <= current_row.id))
  GROUP BY current_row.id
) revisions ON revisions.id=c.id
SET c.revision_number=revisions.revision_number;

ALTER TABLE `work_order_completions`
  ADD UNIQUE INDEX `work_order_completions_revision_uq` (`work_order_id`, `revision_number`);

ALTER TABLE `work_order_events`
  MODIFY COLUMN `from_status` ENUM('OPEN','BACKLOG','COMPLETION_PENDING','VERIFIED','CREATED','ASSIGNED','TECHNICIAN_ACCEPTED','IN_PROGRESS','WAITING_FOR_PARTS','WAITING_FOR_VENDOR','WAITING_FOR_ACCESS','ON_HOLD','TECHNICIAN_COMPLETED','UNDER_MANAGER_REVIEW','RETURNED_TO_TECHNICIAN','MANAGER_APPROVED','WAITING_FOR_OPERATOR_ACCEPTANCE','OPERATOR_REJECTED','OPERATOR_ACCEPTED','CLOSED','CANCELLED') NULL,
  MODIFY COLUMN `to_status` ENUM('OPEN','BACKLOG','COMPLETION_PENDING','VERIFIED','CREATED','ASSIGNED','TECHNICIAN_ACCEPTED','IN_PROGRESS','WAITING_FOR_PARTS','WAITING_FOR_VENDOR','WAITING_FOR_ACCESS','ON_HOLD','TECHNICIAN_COMPLETED','UNDER_MANAGER_REVIEW','RETURNED_TO_TECHNICIAN','MANAGER_APPROVED','WAITING_FOR_OPERATOR_ACCEPTANCE','OPERATOR_REJECTED','OPERATOR_ACCEPTED','CLOSED','CANCELLED') NULL,
  ADD COLUMN `actor_role` VARCHAR(80) NULL,
  ADD COLUMN `metadata` LONGTEXT NULL;

ALTER TABLE `work_order_backlog_events`
  MODIFY COLUMN `previous_status` ENUM('OPEN','BACKLOG','COMPLETION_PENDING','VERIFIED','CREATED','ASSIGNED','TECHNICIAN_ACCEPTED','IN_PROGRESS','WAITING_FOR_PARTS','WAITING_FOR_VENDOR','WAITING_FOR_ACCESS','ON_HOLD','TECHNICIAN_COMPLETED','UNDER_MANAGER_REVIEW','RETURNED_TO_TECHNICIAN','MANAGER_APPROVED','WAITING_FOR_OPERATOR_ACCEPTANCE','OPERATOR_REJECTED','OPERATOR_ACCEPTED','CLOSED','CANCELLED') NULL;

CREATE TABLE `maintenance_notification_events` (
  `id` VARCHAR(36) NOT NULL, `notification_id` VARCHAR(36) NOT NULL, `event_type` VARCHAR(80) NOT NULL,
  `from_status` ENUM('NEW','BACKLOG','COMPLETED','DRAFT','SUBMITTED','UNDER_REVIEW','NEEDS_INFORMATION','REJECTED','APPROVED','IN_MAINTENANCE','WAITING_FOR_OPERATOR_ACCEPTANCE','OPERATOR_REJECTED','OPERATOR_ACCEPTED','READY_TO_CLOSE','CLOSED','CANCELLED') NULL,
  `to_status` ENUM('NEW','BACKLOG','COMPLETED','DRAFT','SUBMITTED','UNDER_REVIEW','NEEDS_INFORMATION','REJECTED','APPROVED','IN_MAINTENANCE','WAITING_FOR_OPERATOR_ACCEPTANCE','OPERATOR_REJECTED','OPERATOR_ACCEPTED','READY_TO_CLOSE','CLOSED','CANCELLED') NULL,
  `note` TEXT NULL, `actor_user_id` VARCHAR(36) NOT NULL, `actor_role` VARCHAR(80) NULL, `metadata` LONGTEXT NULL, `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), INDEX `maintenance_notification_events_idx` (`notification_id`,`created_at`),
  CONSTRAINT `maintenance_notification_events_notification_fk` FOREIGN KEY (`notification_id`) REFERENCES `maintenance_notifications` (`id`) ON DELETE CASCADE,
  CONSTRAINT `maintenance_notification_events_actor_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`)
);

CREATE TABLE `work_order_rechecks` (
  `id` VARCHAR(36) NOT NULL, `work_order_id` VARCHAR(36) NOT NULL, `completion_id` VARCHAR(36) NULL, `cycle_number` INT NOT NULL,
  `requested_by_user_id` VARCHAR(36) NOT NULL, `requested_by_role` VARCHAR(80) NOT NULL, `return_reason` TEXT NOT NULL,
  `required_actions` LONGTEXT NOT NULL, `attachment_ids` LONGTEXT NULL, `assigned_technician_id` VARCHAR(36) NULL,
  `returned_at` DATETIME(3) NOT NULL, `due_at` DATETIME(3) NULL,
  `status` ENUM('OPEN','IN_PROGRESS','RESUBMITTED','APPROVED','RETURNED_AGAIN','CANCELLED') NOT NULL DEFAULT 'OPEN', `resolved_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`), UNIQUE INDEX `work_order_rechecks_cycle_uq` (`work_order_id`,`cycle_number`), INDEX `work_order_rechecks_status_idx` (`work_order_id`,`status`),
  CONSTRAINT `work_order_rechecks_order_fk` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `work_order_rechecks_completion_fk` FOREIGN KEY (`completion_id`) REFERENCES `work_order_completions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `work_order_rechecks_requester_fk` FOREIGN KEY (`requested_by_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `work_order_rechecks_technician_fk` FOREIGN KEY (`assigned_technician_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
);

CREATE TABLE `work_order_operator_decisions` (
  `id` VARCHAR(36) NOT NULL, `work_order_id` VARCHAR(36) NOT NULL, `notification_id` VARCHAR(36) NOT NULL,
  `decision` ENUM('ACCEPTED','REJECTED') NOT NULL, `reason` TEXT NULL, `remaining_problem` TEXT NULL, `attachment_ids` LONGTEXT NULL,
  `decided_by` VARCHAR(36) NOT NULL, `decided_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), INDEX `work_order_operator_decisions_idx` (`work_order_id`,`decided_at`),
  CONSTRAINT `work_order_operator_decisions_order_fk` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `work_order_operator_decisions_notification_fk` FOREIGN KEY (`notification_id`) REFERENCES `maintenance_notifications` (`id`),
  CONSTRAINT `work_order_operator_decisions_actor_fk` FOREIGN KEY (`decided_by`) REFERENCES `users` (`id`)
);

-- Scope legacy rows from their department where possible.
UPDATE `maintenance_notifications` n JOIN `departments` d ON d.id=n.department_id SET n.organization_id=d.organization_id, n.site_id=d.site_id WHERE n.organization_id IS NULL;
UPDATE `work_orders` w JOIN `departments` d ON d.id=w.department_id SET w.organization_id=d.organization_id, w.site_id=d.site_id WHERE w.organization_id IS NULL;

-- Conservative status mapping. A legacy completion is a technical submission,
-- while VERIFIED means manager-approved and still requires operator acceptance.
UPDATE `maintenance_notifications` SET `status`='SUBMITTED', `submitted_at`=COALESCE(`submitted_at`,`created_at`) WHERE `status`='NEW';
UPDATE `maintenance_notifications` SET `status`='IN_MAINTENANCE' WHERE `status` IN ('APPROVED','BACKLOG');
UPDATE `maintenance_notifications` SET `status`='READY_TO_CLOSE' WHERE `status`='COMPLETED';
UPDATE `work_orders` SET `status`=IF(`assigned_to` IS NULL,'CREATED','ASSIGNED'), `assigned_at`=IF(`assigned_to` IS NULL,NULL,`created_at`) WHERE `status`='OPEN';
UPDATE `work_orders` SET `status`='WAITING_FOR_PARTS' WHERE `status`='BACKLOG';
UPDATE `work_orders` SET `status`='TECHNICIAN_COMPLETED', `technician_completed_at`=COALESCE(`actual_finish_at`,`updated_at`) WHERE `status`='COMPLETION_PENDING';
UPDATE `work_orders` SET `status`='WAITING_FOR_OPERATOR_ACCEPTANCE', `manager_approved_at`=COALESCE(`verified_at`,`updated_at`) WHERE `status`='VERIFIED';

-- Backfill baseline timeline events without manufacturing actor identities.
INSERT INTO `maintenance_notification_events` (`id`,`notification_id`,`event_type`,`to_status`,`note`,`actor_user_id`,`actor_role`,`created_at`)
SELECT UUID(), n.id, 'LEGACY_STATUS_MIGRATED', n.status, 'Baseline event created by governed workflow migration', n.updated_by, 'MIGRATION', n.updated_at
FROM `maintenance_notifications` n WHERE NOT EXISTS (SELECT 1 FROM `maintenance_notification_events` e WHERE e.notification_id=n.id);
