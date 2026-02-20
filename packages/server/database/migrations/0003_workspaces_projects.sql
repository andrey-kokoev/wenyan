-- ============================================================================
-- WORKSPACES AND PROJECTS SCHEMA
-- ============================================================================

-- Workspaces table - owned by users (identified by email)
CREATE TABLE IF NOT EXISTS workspaces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL,  -- email of the owner
  is_personal INTEGER NOT NULL DEFAULT 0,  -- boolean
  created_at INTEGER NOT NULL DEFAULT (unixepoch('now')),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch('now'))
);

-- Projects table - belong to a workspace
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  workspace_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch('now')),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch('now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Documents table - linked to projects
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,  -- pdf, docx, txt, md
  content TEXT,             -- For text-based files
  url TEXT,                 -- For web-based files
  storage_key TEXT,         -- Key in R2 storage
  status TEXT NOT NULL DEFAULT 'uploaded',  -- uploaded, processing, analyzed, error
  created_at INTEGER NOT NULL DEFAULT (unixepoch('now')),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Indexes for performance
-- idx_workspaces_owner_id: Optimizes lookups when finding workspaces by user email (owner_id)
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces(owner_id);

-- idx_workspaces_is_personal: Speeds up queries that filter personal vs shared workspaces
CREATE INDEX IF NOT EXISTS idx_workspaces_is_personal ON workspaces(is_personal);

-- idx_projects_workspace_id: Optimizes foreign key joins and queries filtering projects by workspace
CREATE INDEX IF NOT EXISTS idx_projects_workspace_id ON projects(workspace_id);

-- idx_documents_project_id: Optimizes foreign key joins and queries filtering documents by project
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);

-- idx_documents_status: Critical for filtering documents by processing status (uploaded, processing,
-- analyzed, error). This index significantly improves performance when:
--   - Displaying only processed/analyzed documents to users
--   - Finding documents stuck in 'processing' state for monitoring
--   - Querying failed documents ('error' status) for retry logic
--   - Dashboard queries that aggregate documents by status
-- Expected performance gain: O(log n) vs O(n) for status-based queries
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
