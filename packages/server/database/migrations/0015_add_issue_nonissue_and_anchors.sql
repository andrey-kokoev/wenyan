ALTER TABLE issues ADD COLUMN marked_as_nonissue_by TEXT;
ALTER TABLE issues ADD COLUMN marked_as_nonissue_at INTEGER;

ALTER TABLE issues_rel_documents ADD COLUMN anchor_type TEXT;
ALTER TABLE issues_rel_documents ADD COLUMN anchor_start INTEGER;
ALTER TABLE issues_rel_documents ADD COLUMN anchor_end INTEGER;
ALTER TABLE issues_rel_documents ADD COLUMN anchor_text TEXT;
