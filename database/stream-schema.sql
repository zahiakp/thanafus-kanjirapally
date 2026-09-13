CREATE TABLE IF NOT EXISTS stream_channels (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(80) NOT NULL,
  name VARCHAR(120) NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 0,
  automatic TINYINT(1) NOT NULL DEFAULT 1,
  version BIGINT UNSIGNED NOT NULL DEFAULT 1,
  public_token_hash CHAR(64) NULL,
  event_title VARCHAR(160) NOT NULL DEFAULT 'Meelad Maharjan''26',
  live_program_id INT NULL,
  live_entry_id INT NULL,
  next_program_id INT NULL,
  pinned_scene VARCHAR(32) NULL,
  cycle_epoch DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_by VARCHAR(120) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_stream_channels_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stream_cues (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  channel_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(32) NOT NULL,
  priority SMALLINT NOT NULL DEFAULT 50,
  duration_seconds SMALLINT UNSIGNED NOT NULL DEFAULT 15,
  source_key VARCHAR(191) NULL,
  program_id INT NULL,
  payload_json JSON NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'queued',
  starts_at DATETIME(3) NULL,
  ends_at DATETIME(3) NULL,
  created_by VARCHAR(120) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_stream_cue_source (channel_id, source_key),
  KEY idx_stream_cue_queue (channel_id, status, priority, created_at),
  KEY idx_stream_cue_program (program_id),
  CONSTRAINT fk_stream_cue_channel FOREIGN KEY (channel_id) REFERENCES stream_channels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @stream_index_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'programs' AND index_name = 'idx_programs_stream_status_order'),
  'SELECT 1', 'CREATE INDEX idx_programs_stream_status_order ON programs (`status`, `order`)'
);
PREPARE stream_index_statement FROM @stream_index_ddl;
EXECUTE stream_index_statement;
DEALLOCATE PREPARE stream_index_statement;

SET @stream_index_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'programlist' AND index_name = 'idx_programlist_stream_program_status'),
  'SELECT 1', 'CREATE INDEX idx_programlist_stream_program_status ON programlist (`program`, `status`)'
);
PREPARE stream_index_statement FROM @stream_index_ddl;
EXECUTE stream_index_statement;
DEALLOCATE PREPARE stream_index_statement;

SET @stream_index_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'results' AND index_name = 'idx_results_stream_program_status'),
  'SELECT 1', 'CREATE INDEX idx_results_stream_program_status ON results (`program`, `status`)'
);
PREPARE stream_index_statement FROM @stream_index_ddl;
EXECUTE stream_index_statement;
DEALLOCATE PREPARE stream_index_statement;