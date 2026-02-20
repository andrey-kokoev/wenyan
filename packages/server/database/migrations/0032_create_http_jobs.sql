CREATE TABLE IF NOT EXISTS http_jobs (
  id TEXT PRIMARY KEY,
  project_id INTEGER NOT NULL,
  requested_by TEXT NOT NULL,
  status TEXT NOT NULL,
  request_json TEXT NOT NULL,
  response_status INTEGER,
  response_key TEXT,
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_http_jobs_status ON http_jobs(status);
CREATE INDEX IF NOT EXISTS idx_http_jobs_project ON http_jobs(project_id);
