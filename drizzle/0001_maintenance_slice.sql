CREATE TABLE IF NOT EXISTS `asset_types` (
  `id` varchar(36) NOT NULL, `code` varchar(40) NOT NULL, `name` varchar(120) NOT NULL, `description` text, `active` boolean NOT NULL DEFAULT true,
  `created_at` datetime(3) NOT NULL, `updated_at` datetime(3) NOT NULL, `created_by` varchar(36) NOT NULL, `updated_by` varchar(36) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `asset_types_code_uq` (`code`), KEY `asset_types_active_idx` (`active`),
  CONSTRAINT `asset_types_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`), CONSTRAINT `asset_types_updated_by_fk` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
);

CREATE TABLE IF NOT EXISTS `asset_categories` (
  `id` varchar(36) NOT NULL, `code` varchar(40) NOT NULL, `name` varchar(120) NOT NULL, `description` text, `active` boolean NOT NULL DEFAULT true,
  `created_at` datetime(3) NOT NULL, `updated_at` datetime(3) NOT NULL, `created_by` varchar(36) NOT NULL, `updated_by` varchar(36) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `asset_categories_code_uq` (`code`), KEY `asset_categories_active_idx` (`active`),
  CONSTRAINT `asset_categories_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`), CONSTRAINT `asset_categories_updated_by_fk` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
);

CREATE TABLE IF NOT EXISTS `assets` (
  `id` varchar(36) NOT NULL, `code` varchar(60) NOT NULL, `name` varchar(160) NOT NULL, `description` text, `asset_type_id` varchar(36) NOT NULL, `asset_category_id` varchar(36), `parent_asset_id` varchar(36),
  `location` varchar(190) NOT NULL, `criticality` enum('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'MEDIUM', `status` enum('ACTIVE','INACTIVE','RETIRED') NOT NULL DEFAULT 'ACTIVE', `owner_user_id` varchar(36), `legacy_source_id` int,
  `created_at` datetime(3) NOT NULL, `updated_at` datetime(3) NOT NULL, `created_by` varchar(36) NOT NULL, `updated_by` varchar(36) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `assets_code_uq` (`code`), UNIQUE KEY `assets_legacy_source_uq` (`legacy_source_id`), KEY `assets_status_idx` (`status`), KEY `assets_type_idx` (`asset_type_id`), KEY `assets_parent_idx` (`parent_asset_id`),
  CONSTRAINT `assets_type_fk` FOREIGN KEY (`asset_type_id`) REFERENCES `asset_types` (`id`), CONSTRAINT `assets_category_fk` FOREIGN KEY (`asset_category_id`) REFERENCES `asset_categories` (`id`), CONSTRAINT `assets_owner_fk` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `assets_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`), CONSTRAINT `assets_updated_by_fk` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
);

CREATE TABLE IF NOT EXISTS `maintenance_notifications` (
  `id` varchar(36) NOT NULL, `code` varchar(60) NOT NULL, `asset_id` varchar(36) NOT NULL, `title` varchar(190) NOT NULL, `description` text NOT NULL,
  `type` enum('CORRECTIVE','BREAKDOWN','INSPECTION') NOT NULL DEFAULT 'CORRECTIVE', `priority` enum('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'MEDIUM', `status` enum('NEW','APPROVED','BACKLOG','REJECTED','COMPLETED') NOT NULL DEFAULT 'NEW', `breakdown` boolean NOT NULL DEFAULT false,
  `requested_by` varchar(36) NOT NULL, `supervisor_id` varchar(36), `due_at` datetime(3), `reviewed_at` datetime(3), `completed_at` datetime(3), `created_at` datetime(3) NOT NULL, `updated_at` datetime(3) NOT NULL, `created_by` varchar(36) NOT NULL, `updated_by` varchar(36) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `maintenance_notifications_code_uq` (`code`), KEY `maintenance_notifications_asset_idx` (`asset_id`), KEY `maintenance_notifications_status_idx` (`status`),
  CONSTRAINT `maintenance_notifications_asset_fk` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`), CONSTRAINT `maintenance_notifications_requested_by_fk` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`), CONSTRAINT `maintenance_notifications_supervisor_fk` FOREIGN KEY (`supervisor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `maintenance_notifications_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`), CONSTRAINT `maintenance_notifications_updated_by_fk` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
);

CREATE TABLE IF NOT EXISTS `notification_reviews` (
  `id` varchar(36) NOT NULL, `notification_id` varchar(36) NOT NULL, `decision` enum('APPROVED','BACKLOG','REJECTED') NOT NULL, `note` text NOT NULL, `reviewed_by` varchar(36) NOT NULL, `reviewed_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `notification_reviews_notification_uq` (`notification_id`), CONSTRAINT `notification_reviews_notification_fk` FOREIGN KEY (`notification_id`) REFERENCES `maintenance_notifications` (`id`) ON DELETE CASCADE, CONSTRAINT `notification_reviews_user_fk` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`)
);

CREATE TABLE IF NOT EXISTS `work_orders` (
  `id` varchar(36) NOT NULL, `code` varchar(60) NOT NULL, `notification_id` varchar(36) NOT NULL, `asset_id` varchar(36) NOT NULL, `title` varchar(190) NOT NULL, `description` text NOT NULL,
  `priority` enum('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'MEDIUM', `status` enum('OPEN','BACKLOG','IN_PROGRESS','COMPLETION_PENDING','VERIFIED','CLOSED') NOT NULL DEFAULT 'OPEN', `assigned_to` varchar(36), `supervisor_id` varchar(36), `due_at` datetime(3), `started_at` datetime(3), `verified_at` datetime(3), `closed_at` datetime(3),
  `created_at` datetime(3) NOT NULL, `updated_at` datetime(3) NOT NULL, `created_by` varchar(36) NOT NULL, `updated_by` varchar(36) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `work_orders_code_uq` (`code`), UNIQUE KEY `work_orders_notification_uq` (`notification_id`), KEY `work_orders_status_idx` (`status`), KEY `work_orders_asset_idx` (`asset_id`), KEY `work_orders_assignee_idx` (`assigned_to`),
  CONSTRAINT `work_orders_notification_fk` FOREIGN KEY (`notification_id`) REFERENCES `maintenance_notifications` (`id`), CONSTRAINT `work_orders_asset_fk` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`), CONSTRAINT `work_orders_assignee_fk` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL, CONSTRAINT `work_orders_supervisor_fk` FOREIGN KEY (`supervisor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `work_orders_created_by_fk` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`), CONSTRAINT `work_orders_updated_by_fk` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`)
);

CREATE TABLE IF NOT EXISTS `work_order_tasks` (
  `id` varchar(36) NOT NULL, `work_order_id` varchar(36) NOT NULL, `sequence` int NOT NULL, `title` varchar(190) NOT NULL, `description` text, `required` boolean NOT NULL DEFAULT true, `status` enum('OPEN','IN_PROGRESS','COMPLETED') NOT NULL DEFAULT 'OPEN', `assigned_to` varchar(36), `completed_by` varchar(36), `completed_at` datetime(3), `created_at` datetime(3) NOT NULL, `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `work_order_tasks_sequence_uq` (`work_order_id`,`sequence`), KEY `work_order_tasks_status_idx` (`work_order_id`,`status`), CONSTRAINT `work_order_tasks_order_fk` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders` (`id`) ON DELETE CASCADE, CONSTRAINT `work_order_tasks_assignee_fk` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL, CONSTRAINT `work_order_tasks_completed_by_fk` FOREIGN KEY (`completed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS `work_execution_entries` (
  `id` varchar(36) NOT NULL, `work_order_id` varchar(36) NOT NULL, `description` text NOT NULL, `minutes_spent` int NOT NULL, `action_at` datetime(3) NOT NULL, `actor_user_id` varchar(36) NOT NULL, `created_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`), KEY `work_execution_entries_order_idx` (`work_order_id`,`action_at`), CONSTRAINT `work_execution_entries_order_fk` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders` (`id`) ON DELETE CASCADE, CONSTRAINT `work_execution_entries_actor_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`)
);

CREATE TABLE IF NOT EXISTS `work_order_completions` (
  `id` varchar(36) NOT NULL, `work_order_id` varchar(36) NOT NULL, `result` varchar(190) NOT NULL, `problem` text, `cause` text, `solution` text NOT NULL, `escalation` text, `notes` text, `duration_minutes` int NOT NULL, `completed_by` varchar(36) NOT NULL, `completed_at` datetime(3) NOT NULL, `created_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`), KEY `work_order_completions_order_idx` (`work_order_id`,`completed_at`), CONSTRAINT `work_order_completions_order_fk` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders` (`id`) ON DELETE CASCADE, CONSTRAINT `work_order_completions_user_fk` FOREIGN KEY (`completed_by`) REFERENCES `users` (`id`)
);

CREATE TABLE IF NOT EXISTS `work_order_verifications` (
  `id` varchar(36) NOT NULL, `work_order_id` varchar(36) NOT NULL, `completion_id` varchar(36) NOT NULL, `decision` enum('VERIFIED','RETURNED') NOT NULL, `note` text NOT NULL, `verified_by` varchar(36) NOT NULL, `verified_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `work_order_verifications_completion_uq` (`completion_id`), KEY `work_order_verifications_order_idx` (`work_order_id`), CONSTRAINT `work_order_verifications_order_fk` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders` (`id`) ON DELETE CASCADE, CONSTRAINT `work_order_verifications_completion_fk` FOREIGN KEY (`completion_id`) REFERENCES `work_order_completions` (`id`) ON DELETE CASCADE, CONSTRAINT `work_order_verifications_user_fk` FOREIGN KEY (`verified_by`) REFERENCES `users` (`id`)
);

CREATE TABLE IF NOT EXISTS `work_order_events` (
  `id` varchar(36) NOT NULL, `work_order_id` varchar(36) NOT NULL, `event_type` varchar(60) NOT NULL, `from_status` enum('OPEN','BACKLOG','IN_PROGRESS','COMPLETION_PENDING','VERIFIED','CLOSED'), `to_status` enum('OPEN','BACKLOG','IN_PROGRESS','COMPLETION_PENDING','VERIFIED','CLOSED'), `note` text, `actor_user_id` varchar(36) NOT NULL, `created_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`), KEY `work_order_events_order_idx` (`work_order_id`,`created_at`), CONSTRAINT `work_order_events_order_fk` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders` (`id`) ON DELETE CASCADE, CONSTRAINT `work_order_events_actor_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`)
);
