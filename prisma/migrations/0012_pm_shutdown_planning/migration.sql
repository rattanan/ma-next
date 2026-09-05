ALTER TABLE assets ADD COLUMN organization_id VARCHAR(36) NULL, ADD COLUMN site_id VARCHAR(36) NULL;

CREATE TABLE `maintenance_project_tasks` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `organization_id` varchar(36) NOT NULL,
  `site_id` varchar(36) NOT NULL,
  `department_id` varchar(36) NULL,
  `created_by` varchar(36) NOT NULL,
  `created_at` datetime(3) NOT NULL,
  `updated_at` datetime(3) NOT NULL,
  `version` int NOT NULL DEFAULT '1',
  `project_id` varchar(36) NOT NULL,
  `parent_id` varchar(36) NULL,
  `name` varchar(190) NOT NULL,
  `description` text NOT NULL,
  `kind` enum('EXECUTION','SUMMARY','MILESTONE') NOT NULL,
  `phase` enum('PREPARATION','SHUTDOWN','RESTORATION') NOT NULL,
  `status` enum('DRAFT','READY','WO_CREATED','IN_PROGRESS','BLOCKED','WAITING_COMPLETION','COMPLETED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `asset_id` varchar(36) NULL,
  `assigned_to` varchar(36) NULL,
  `planned_start_at` datetime(3) NOT NULL,
  `planned_finish_at` datetime(3) NOT NULL,
  `estimated_minutes` int NOT NULL,
  `work_order_id` varchar(36) NULL,
  `steps` longtext NOT NULL,
  `reason` text NULL,
  `actual_finish_at` datetime(3) NULL,
  KEY `project_tasks_project_idx` (`project_id`, `status`),
  UNIQUE KEY `project_tasks_wo_uq` (`work_order_id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `maintenance_projects` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `organization_id` varchar(36) NOT NULL,
  `site_id` varchar(36) NOT NULL,
  `department_id` varchar(36) NULL,
  `created_by` varchar(36) NOT NULL,
  `created_at` datetime(3) NOT NULL,
  `updated_at` datetime(3) NOT NULL,
  `version` int NOT NULL DEFAULT '1',
  `code` varchar(60) NOT NULL,
  `name` varchar(190) NOT NULL,
  `description` text NOT NULL,
  `owner_id` varchar(36) NOT NULL,
  `operator_id` varchar(36) NOT NULL,
  `status` enum('DRAFT','PLANNED','IN_PROGRESS','ON_HOLD','COMPLETED','CLOSED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `priority` enum('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'MEDIUM',
  `planned_start_at` datetime(3) NOT NULL,
  `planned_finish_at` datetime(3) NOT NULL,
  `actual_finish_at` datetime(3) NULL,
  `progress` decimal(5,2) NOT NULL DEFAULT '0',
  `closure_note` text NULL,
  `baseline` longtext NULL,
  UNIQUE KEY `maintenance_projects_code_uq` (`organization_id`, `code`),
  KEY `maintenance_projects_scope_idx` (`organization_id`, `site_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `maintenance_templates` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `organization_id` varchar(36) NOT NULL,
  `site_id` varchar(36) NOT NULL,
  `department_id` varchar(36) NULL,
  `created_by` varchar(36) NOT NULL,
  `created_at` datetime(3) NOT NULL,
  `updated_at` datetime(3) NOT NULL,
  `version` int NOT NULL DEFAULT '1',
  `name` varchar(190) NOT NULL,
  `steps` longtext NOT NULL
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `planning_events` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `organization_id` varchar(36) NOT NULL,
  `entity_id` varchar(36) NOT NULL,
  `entity_type` varchar(30) NOT NULL,
  `event_type` varchar(60) NOT NULL,
  `actor_id` varchar(36) NOT NULL,
  `note` text NOT NULL,
  `created_at` datetime(3) NOT NULL,
  KEY `planning_events_entity_idx` (`entity_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `pm_occurrences` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `program_id` varchar(36) NOT NULL,
  `organization_id` varchar(36) NOT NULL,
  `asset_id` varchar(36) NOT NULL,
  `scheduled_date` varchar(10) NOT NULL,
  `scheduled_at` datetime(3) NOT NULL,
  `status` enum('GENERATED','COMPLETED','SKIPPED') NOT NULL,
  `work_order_id` varchar(36) NULL,
  `program_version` int NOT NULL,
  `reason` text NULL,
  `created_at` datetime(3) NOT NULL,
  `completed_at` datetime(3) NULL,
  UNIQUE KEY `pm_occurrences_schedule_uq` (`program_id`, `asset_id`, `scheduled_date`),
  UNIQUE KEY `pm_occurrences_wo_uq` (`work_order_id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `preventive_programs` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `organization_id` varchar(36) NOT NULL,
  `site_id` varchar(36) NOT NULL,
  `department_id` varchar(36) NULL,
  `created_by` varchar(36) NOT NULL,
  `created_at` datetime(3) NOT NULL,
  `updated_at` datetime(3) NOT NULL,
  `version` int NOT NULL DEFAULT '1',
  `name` varchar(190) NOT NULL,
  `asset_id` varchar(36) NOT NULL,
  `template_id` varchar(36) NOT NULL,
  `template_version` int NOT NULL,
  `steps` longtext NOT NULL,
  `assigned_to` varchar(36) NOT NULL,
  `operator_id` varchar(36) NOT NULL,
  `status` enum('ACTIVE','PAUSED','EXPIRED') NOT NULL DEFAULT 'PAUSED',
  `start_date` varchar(10) NOT NULL,
  `expiry_date` varchar(10) NOT NULL,
  `frequency` enum('DAY','WEEK','MONTH') NOT NULL,
  `interval_value` int NOT NULL,
  `timezone` varchar(80) NOT NULL,
  `local_time` varchar(5) NOT NULL,
  `lead_time_days` int NOT NULL DEFAULT '0',
  KEY `preventive_programs_scope_idx` (`organization_id`, `site_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `project_task_dependencies` (
  `id` varchar(36) NOT NULL PRIMARY KEY,
  `project_id` varchar(36) NOT NULL,
  `predecessor_id` varchar(36) NOT NULL,
  `successor_id` varchar(36) NOT NULL,
  UNIQUE KEY `project_dependency_uq` (`predecessor_id`, `successor_id`),
  KEY `project_dependency_project_idx` (`project_id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `maintenance_project_tasks` ADD CONSTRAINT `planning_maintenance_project_tasks_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `maintenance_projects`(id) ON DELETE RESTRICT;

ALTER TABLE `maintenance_project_tasks` ADD CONSTRAINT `planning_maintenance_project_tasks_parent_id_fk` FOREIGN KEY (`parent_id`) REFERENCES `maintenance_project_tasks`(id) ON DELETE RESTRICT;

ALTER TABLE `maintenance_project_tasks` ADD CONSTRAINT `planning_maintenance_project_tasks_asset_id_fk` FOREIGN KEY (`asset_id`) REFERENCES `assets`(id) ON DELETE RESTRICT;

ALTER TABLE `maintenance_project_tasks` ADD CONSTRAINT `planning_maintenance_project_tasks_work_order_id_fk` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(id) ON DELETE RESTRICT;

ALTER TABLE `project_task_dependencies` ADD CONSTRAINT `planning_project_task_dependencies_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `maintenance_projects`(id) ON DELETE RESTRICT;

ALTER TABLE `project_task_dependencies` ADD CONSTRAINT `planning_project_task_dependencies_predecessor_id_fk` FOREIGN KEY (`predecessor_id`) REFERENCES `maintenance_project_tasks`(id) ON DELETE RESTRICT;

ALTER TABLE `project_task_dependencies` ADD CONSTRAINT `planning_project_task_dependencies_successor_id_fk` FOREIGN KEY (`successor_id`) REFERENCES `maintenance_project_tasks`(id) ON DELETE RESTRICT;

ALTER TABLE `preventive_programs` ADD CONSTRAINT `planning_preventive_programs_asset_id_fk` FOREIGN KEY (`asset_id`) REFERENCES `assets`(id) ON DELETE RESTRICT;

ALTER TABLE `preventive_programs` ADD CONSTRAINT `planning_preventive_programs_template_id_fk` FOREIGN KEY (`template_id`) REFERENCES `maintenance_templates`(id) ON DELETE RESTRICT;

ALTER TABLE `pm_occurrences` ADD CONSTRAINT `planning_pm_occurrences_program_id_fk` FOREIGN KEY (`program_id`) REFERENCES `preventive_programs`(id) ON DELETE RESTRICT;

ALTER TABLE `pm_occurrences` ADD CONSTRAINT `planning_pm_occurrences_work_order_id_fk` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(id) ON DELETE RESTRICT;
