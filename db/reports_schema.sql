-- FASREP Reports & Chunked Storage Schema (Cloudflare D1 / SQLite)

CREATE TABLE IF NOT EXISTS reports (
  id           TEXT PRIMARY KEY,
  user_id      TEXT,
  module_type  TEXT NOT NULL DEFAULT 'prototype',
  report_title TEXT,
  product_name TEXT,
  model_number TEXT,
  po_number    TEXT,
  factory      TEXT,
  verdict      TEXT,
  photo_count  INTEGER DEFAULT 0,
  thumb_small  TEXT,
  revision     INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_reports_module_type ON reports(module_type);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_deleted_at ON reports(deleted_at);

CREATE TABLE IF NOT EXISTS report_payload_chunks (
  id           TEXT NOT NULL,
  chunk_index  INTEGER NOT NULL,
  total_chunks INTEGER NOT NULL,
  data         TEXT NOT NULL,
  PRIMARY KEY (id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_chunks_id ON report_payload_chunks(id);
