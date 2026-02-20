-- Add origin field to issues to distinguish manual vs AI-generated
ALTER TABLE issues ADD COLUMN origin TEXT NOT NULL DEFAULT 'manual';
