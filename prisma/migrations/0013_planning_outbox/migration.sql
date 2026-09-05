CREATE TABLE planning_outbox (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  event_key VARCHAR(160) NOT NULL,
  recipient_id VARCHAR(36) NOT NULL,
  actor_id VARCHAR(36) NOT NULL,
  title VARCHAR(190) NOT NULL,
  message TEXT NOT NULL,
  action_url VARCHAR(500) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  delivered_at DATETIME(3) NULL,
  UNIQUE KEY planning_outbox_event_uq (event_key),
  KEY planning_outbox_pending_idx (delivered_at,created_at)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE planning_job_runs (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  actor_id VARCHAR(36) NOT NULL,
  mode VARCHAR(20) NOT NULL,
  started_at DATETIME(3) NOT NULL,
  finished_at DATETIME(3) NULL,
  status VARCHAR(20) NOT NULL,
  result LONGTEXT NULL
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
