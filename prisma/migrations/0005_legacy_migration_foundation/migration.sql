CREATE TABLE `migration_runs` (
  `id` VARCHAR(36) NOT NULL,
  `source_system` VARCHAR(80) NOT NULL,
  `source_database` VARCHAR(80) NOT NULL,
  `scope` VARCHAR(190) NOT NULL,
  `status` VARCHAR(40) NOT NULL,
  `started_at` DATETIME(3) NOT NULL,
  `finished_at` DATETIME(3) NULL,
  `manifest` LONGTEXT NULL,
  `summary` LONGTEXT NULL,
  PRIMARY KEY (`id`),
  INDEX `migration_runs_source_idx` (`source_system`, `started_at`)
);

CREATE TABLE `legacy_source_records` (
  `id` VARCHAR(36) NOT NULL,
  `source_system` VARCHAR(80) NOT NULL,
  `source_table` VARCHAR(80) NOT NULL,
  `source_id` VARCHAR(80) NOT NULL,
  `target_type` VARCHAR(80) NOT NULL,
  `target_id` VARCHAR(80) NOT NULL,
  `raw_data` LONGTEXT NOT NULL,
  `checksum` VARCHAR(64) NOT NULL,
  `migration_run_id` VARCHAR(36) NOT NULL,
  `migrated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `legacy_source_records_source_uq` (`source_system`, `source_table`, `source_id`),
  INDEX `legacy_source_records_target_idx` (`target_type`, `target_id`),
  INDEX `legacy_source_records_run_idx` (`migration_run_id`),
  CONSTRAINT `legacy_source_records_run_fk` FOREIGN KEY (`migration_run_id`) REFERENCES `migration_runs` (`id`)
);

CREATE TABLE `migration_rejections` (
  `id` VARCHAR(36) NOT NULL,
  `migration_run_id` VARCHAR(36) NOT NULL,
  `source_table` VARCHAR(80) NOT NULL,
  `source_id` VARCHAR(80) NOT NULL,
  `reason_code` VARCHAR(80) NOT NULL,
  `reason` TEXT NOT NULL,
  `raw_data` LONGTEXT NULL,
  `created_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `migration_rejections_record_uq` (`migration_run_id`, `source_table`, `source_id`, `reason_code`),
  INDEX `migration_rejections_reason_idx` (`reason_code`),
  CONSTRAINT `migration_rejections_run_fk` FOREIGN KEY (`migration_run_id`) REFERENCES `migration_runs` (`id`) ON DELETE CASCADE
);
