-- ============================================================================
-- ISSUES SCHEMA
-- ============================================================================

-- Issues table - tracked problems or tasks within a project
CREATE TABLE IF NOT EXISTS issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium', -- low, medium, high, critical
  status TEXT NOT NULL DEFAULT 'open', -- open, in_progress, resolved, closed
  project_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch('now')),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- IssuesRelDocuments table - links issues to documents
CREATE TABLE IF NOT EXISTS issues_rel_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL,
  document_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch('now')),
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_issues_project_id ON issues(project_id);
CREATE INDEX IF NOT EXISTS idx_issues_rel_documents_issue_id ON issues_rel_documents(issue_id);
CREATE INDEX IF NOT EXISTS idx_issues_rel_documents_document_id ON issues_rel_documents(document_id);
