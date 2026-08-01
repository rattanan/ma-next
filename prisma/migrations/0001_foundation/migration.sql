-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(36) NOT NULL,
    `full_name` VARCHAR(160) NOT NULL,
    `username` VARCHAR(80) NOT NULL,
    `email` VARCHAR(190) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` VARCHAR(40) NOT NULL DEFAULT 'VIEWER',
    `status` ENUM('ACTIVE', 'INACTIVE', 'LOCKED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
    `admin_notes` TEXT NULL,
    `failed_login_attempts` INTEGER NOT NULL DEFAULT 0,
    `failed_login_window_started_at` DATETIME(3) NULL,
    `locked_until` DATETIME(3) NULL,
    `must_change_password` BOOLEAN NOT NULL DEFAULT true,
    `last_login_at` DATETIME(3) NULL,
    `password_changed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` VARCHAR(36) NULL,
    `updated_by` VARCHAR(36) NULL,
    `archived_at` DATETIME(3) NULL,

    UNIQUE INDEX `users_username_uq`(`username`),
    UNIQUE INDEX `users_email_uq`(`email`),
    INDEX `users_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` VARCHAR(36) NOT NULL,
    `code` VARCHAR(80) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `system` BOOLEAN NOT NULL DEFAULT false,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `roles_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` VARCHAR(36) NOT NULL,
    `code` VARCHAR(120) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `description` TEXT NULL,
    `category` VARCHAR(80) NOT NULL,

    UNIQUE INDEX `permissions_code_key`(`code`),
    INDEX `permissions_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_roles` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `role_id` VARCHAR(36) NOT NULL,
    `scope_type` ENUM('GLOBAL', 'ORGANIZATION', 'SITE', 'DEPARTMENT') NOT NULL DEFAULT 'GLOBAL',
    `organization_id` VARCHAR(36) NULL,
    `site_id` VARCHAR(36) NULL,
    `department_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_roles_user_id_idx`(`user_id`),
    UNIQUE INDEX `user_roles_scope_uq`(`user_id`, `role_id`, `scope_type`, `organization_id`, `site_id`, `department_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `role_id` VARCHAR(36) NOT NULL,
    `permission_id` VARCHAR(36) NOT NULL,

    PRIMARY KEY (`role_id`, `permission_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `session_token_hash` VARCHAR(64) NOT NULL,
    `ip_address` VARCHAR(64) NULL,
    `user_agent` TEXT NULL,
    `last_active_at` DATETIME(3) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `sessions_token_uq`(`session_token_hash`),
    INDEX `sessions_user_idx`(`user_id`),
    INDEX `sessions_expires_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_history` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `password_history_user_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `login_history` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NULL,
    `login_identifier` VARCHAR(190) NOT NULL,
    `event_type` ENUM('LOGIN', 'LOGOUT', 'SESSION') NOT NULL,
    `status` ENUM('SUCCESS', 'FAILED', 'LOCKED', 'LOGOUT', 'SESSION_EXPIRED') NOT NULL,
    `ip_address` VARCHAR(64) NULL,
    `user_agent` TEXT NULL,
    `browser` VARCHAR(80) NULL,
    `operating_system` VARCHAR(80) NULL,
    `device_type` VARCHAR(40) NULL,
    `failure_reason` VARCHAR(160) NULL,
    `logged_in_at` DATETIME(3) NULL,
    `logged_out_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `login_history_user_idx`(`user_id`),
    INDEX `login_history_created_idx`(`created_at`),
    INDEX `login_history_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `login_rate_limits` (
    `ip_hash` VARCHAR(64) NOT NULL,
    `window_started_at` DATETIME(3) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `blocked_until` DATETIME(3) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`ip_hash`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `organizations` (
    `id` VARCHAR(36) NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `description` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `organizations_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sites` (
    `id` VARCHAR(36) NOT NULL,
    `organization_id` VARCHAR(36) NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `timezone` VARCHAR(80) NOT NULL DEFAULT 'Asia/Bangkok',
    `address` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sites_organization_id_code_key`(`organization_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `departments` (
    `id` VARCHAR(36) NOT NULL,
    `organization_id` VARCHAR(36) NOT NULL,
    `site_id` VARCHAR(36) NULL,
    `parent_id` VARCHAR(36) NULL,
    `code` VARCHAR(40) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `departments_site_id_idx`(`site_id`),
    UNIQUE INDEX `departments_organization_id_code_key`(`organization_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `master_data_types` (
    `id` VARCHAR(36) NOT NULL,
    `code` VARCHAR(80) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `description` TEXT NULL,
    `value_schema` LONGTEXT NULL,
    `system` BOOLEAN NOT NULL DEFAULT false,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `master_data_types_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `master_data_values` (
    `id` VARCHAR(36) NOT NULL,
    `master_data_type_id` VARCHAR(36) NOT NULL,
    `code` VARCHAR(80) NOT NULL,
    `label` VARCHAR(190) NOT NULL,
    `description` TEXT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `metadata` LONGTEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `valid_from` DATETIME(3) NULL,
    `valid_to` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `master_data_values_master_data_type_id_active_idx`(`master_data_type_id`, `active`),
    UNIQUE INDEX `master_data_values_master_data_type_id_code_key`(`master_data_type_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(36) NOT NULL,
    `actor_user_id` VARCHAR(36) NULL,
    `actor_name` VARCHAR(160) NULL,
    `action` VARCHAR(100) NOT NULL,
    `category` VARCHAR(60) NOT NULL,
    `target_type` VARCHAR(60) NULL,
    `target_id` VARCHAR(80) NULL,
    `target_name` VARCHAR(190) NULL,
    `result` ENUM('SUCCESS', 'FAILED') NOT NULL,
    `description` TEXT NULL,
    `previous_values` LONGTEXT NULL,
    `new_values` LONGTEXT NULL,
    `ip_address` VARCHAR(64) NULL,
    `user_agent` TEXT NULL,
    `request_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_actor_idx`(`actor_user_id`),
    INDEX `audit_action_idx`(`action`),
    INDEX `audit_target_idx`(`target_type`, `target_id`),
    INDEX `audit_created_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attachments` (
    `id` VARCHAR(36) NOT NULL,
    `entity_type` VARCHAR(80) NOT NULL,
    `entity_id` VARCHAR(80) NOT NULL,
    `driver` ENUM('LOCAL', 'S3', 'AZURE') NOT NULL DEFAULT 'LOCAL',
    `storage_key` VARCHAR(500) NOT NULL,
    `original_name` VARCHAR(255) NOT NULL,
    `content_type` VARCHAR(120) NOT NULL,
    `byte_size` INTEGER NOT NULL,
    `checksum` VARCHAR(128) NULL,
    `uploaded_by` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deleted_at` DATETIME(3) NULL,

    INDEX `attachments_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    INDEX `attachments_uploaded_by_idx`(`uploaded_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(36) NOT NULL,
    `type` VARCHAR(80) NOT NULL,
    `title` VARCHAR(190) NOT NULL,
    `message` TEXT NOT NULL,
    `action_url` VARCHAR(500) NULL,
    `channel` ENUM('IN_APP', 'EMAIL') NOT NULL DEFAULT 'IN_APP',
    `source_type` VARCHAR(80) NULL,
    `source_id` VARCHAR(80) NULL,
    `created_by` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NULL,

    INDEX `notifications_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_recipients` (
    `id` VARCHAR(36) NOT NULL,
    `notification_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `status` ENUM('UNREAD', 'READ', 'ARCHIVED') NOT NULL DEFAULT 'UNREAD',
    `read_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notification_recipients_user_id_status_idx`(`user_id`, `status`),
    UNIQUE INDEX `notification_recipients_notification_id_user_id_key`(`notification_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_types` (
    `id` VARCHAR(36) NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` VARCHAR(36) NOT NULL,
    `updated_by` VARCHAR(36) NOT NULL,

    UNIQUE INDEX `asset_types_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `asset_categories` (
    `id` VARCHAR(36) NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` VARCHAR(36) NOT NULL,
    `updated_by` VARCHAR(36) NOT NULL,

    UNIQUE INDEX `asset_categories_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `assets` (
    `id` VARCHAR(36) NOT NULL,
    `code` VARCHAR(60) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `description` TEXT NULL,
    `asset_type_id` VARCHAR(36) NOT NULL,
    `asset_category_id` VARCHAR(36) NULL,
    `parent_asset_id` VARCHAR(36) NULL,
    `location` VARCHAR(190) NOT NULL,
    `criticality` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    `status` ENUM('ACTIVE', 'INACTIVE', 'RETIRED') NOT NULL DEFAULT 'ACTIVE',
    `owner_user_id` VARCHAR(36) NULL,
    `legacy_source_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` VARCHAR(36) NOT NULL,
    `updated_by` VARCHAR(36) NOT NULL,

    UNIQUE INDEX `assets_code_key`(`code`),
    UNIQUE INDEX `assets_legacy_source_id_key`(`legacy_source_id`),
    INDEX `assets_status_idx`(`status`),
    INDEX `assets_asset_type_id_idx`(`asset_type_id`),
    INDEX `assets_parent_asset_id_idx`(`parent_asset_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `maintenance_notifications` (
    `id` VARCHAR(36) NOT NULL,
    `code` VARCHAR(60) NOT NULL,
    `asset_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(190) NOT NULL,
    `description` TEXT NOT NULL,
    `type` ENUM('CORRECTIVE', 'BREAKDOWN', 'INSPECTION') NOT NULL DEFAULT 'CORRECTIVE',
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    `status` ENUM('NEW', 'APPROVED', 'BACKLOG', 'REJECTED', 'COMPLETED') NOT NULL DEFAULT 'NEW',
    `breakdown` BOOLEAN NOT NULL DEFAULT false,
    `requested_by` VARCHAR(36) NOT NULL,
    `supervisor_id` VARCHAR(36) NULL,
    `due_at` DATETIME(3) NULL,
    `reviewed_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` VARCHAR(36) NOT NULL,
    `updated_by` VARCHAR(36) NOT NULL,

    UNIQUE INDEX `maintenance_notifications_code_key`(`code`),
    INDEX `maintenance_notifications_asset_id_idx`(`asset_id`),
    INDEX `maintenance_notifications_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_reviews` (
    `id` VARCHAR(36) NOT NULL,
    `notification_id` VARCHAR(36) NOT NULL,
    `decision` ENUM('APPROVED', 'BACKLOG', 'REJECTED') NOT NULL,
    `note` TEXT NOT NULL,
    `reviewed_by` VARCHAR(36) NOT NULL,
    `reviewed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `notification_reviews_notification_id_key`(`notification_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `work_orders` (
    `id` VARCHAR(36) NOT NULL,
    `code` VARCHAR(60) NOT NULL,
    `notification_id` VARCHAR(36) NOT NULL,
    `asset_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(190) NOT NULL,
    `description` TEXT NOT NULL,
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    `status` ENUM('OPEN', 'BACKLOG', 'IN_PROGRESS', 'COMPLETION_PENDING', 'VERIFIED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `assigned_to` VARCHAR(36) NULL,
    `supervisor_id` VARCHAR(36) NULL,
    `due_at` DATETIME(3) NULL,
    `started_at` DATETIME(3) NULL,
    `verified_at` DATETIME(3) NULL,
    `closed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` VARCHAR(36) NOT NULL,
    `updated_by` VARCHAR(36) NOT NULL,

    UNIQUE INDEX `work_orders_code_key`(`code`),
    UNIQUE INDEX `work_orders_notification_id_key`(`notification_id`),
    INDEX `work_orders_status_idx`(`status`),
    INDEX `work_orders_asset_id_idx`(`asset_id`),
    INDEX `work_orders_assigned_to_idx`(`assigned_to`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `work_order_tasks` (
    `id` VARCHAR(36) NOT NULL,
    `work_order_id` VARCHAR(36) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `title` VARCHAR(190) NOT NULL,
    `description` TEXT NULL,
    `required` BOOLEAN NOT NULL DEFAULT true,
    `status` ENUM('OPEN', 'IN_PROGRESS', 'COMPLETED') NOT NULL DEFAULT 'OPEN',
    `assigned_to` VARCHAR(36) NULL,
    `completed_by` VARCHAR(36) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `work_order_tasks_work_order_id_status_idx`(`work_order_id`, `status`),
    UNIQUE INDEX `work_order_tasks_work_order_id_sequence_key`(`work_order_id`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `work_execution_entries` (
    `id` VARCHAR(36) NOT NULL,
    `work_order_id` VARCHAR(36) NOT NULL,
    `description` TEXT NOT NULL,
    `minutes_spent` INTEGER NOT NULL,
    `action_at` DATETIME(3) NOT NULL,
    `actor_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `work_execution_entries_work_order_id_action_at_idx`(`work_order_id`, `action_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `work_order_completions` (
    `id` VARCHAR(36) NOT NULL,
    `work_order_id` VARCHAR(36) NOT NULL,
    `result` VARCHAR(190) NOT NULL,
    `problem` TEXT NULL,
    `cause` TEXT NULL,
    `solution` TEXT NOT NULL,
    `escalation` TEXT NULL,
    `notes` TEXT NULL,
    `duration_minutes` INTEGER NOT NULL,
    `completed_by` VARCHAR(36) NOT NULL,
    `completed_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `work_order_completions_work_order_id_completed_at_idx`(`work_order_id`, `completed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `work_order_verifications` (
    `id` VARCHAR(36) NOT NULL,
    `work_order_id` VARCHAR(36) NOT NULL,
    `completion_id` VARCHAR(36) NOT NULL,
    `decision` ENUM('VERIFIED', 'RETURNED') NOT NULL,
    `note` TEXT NOT NULL,
    `verified_by` VARCHAR(36) NOT NULL,
    `verified_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `work_order_verifications_completion_id_key`(`completion_id`),
    INDEX `work_order_verifications_work_order_id_idx`(`work_order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `work_order_events` (
    `id` VARCHAR(36) NOT NULL,
    `work_order_id` VARCHAR(36) NOT NULL,
    `event_type` VARCHAR(60) NOT NULL,
    `from_status` ENUM('OPEN', 'BACKLOG', 'IN_PROGRESS', 'COMPLETION_PENDING', 'VERIFIED', 'CLOSED') NULL,
    `to_status` ENUM('OPEN', 'BACKLOG', 'IN_PROGRESS', 'COMPLETION_PENDING', 'VERIFIED', 'CLOSED') NULL,
    `note` TEXT NULL,
    `actor_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `work_order_events_work_order_id_created_at_idx`(`work_order_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_history` ADD CONSTRAINT `password_history_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sites` ADD CONSTRAINT `sites_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `master_data_values` ADD CONSTRAINT `master_data_values_master_data_type_id_fkey` FOREIGN KEY (`master_data_type_id`) REFERENCES `master_data_types`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_recipients` ADD CONSTRAINT `notification_recipients_notification_id_fkey` FOREIGN KEY (`notification_id`) REFERENCES `notifications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_recipients` ADD CONSTRAINT `notification_recipients_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
