ALTER TABLE recovery_snapshots
ADD COLUMN version_token TEXT NOT NULL DEFAULT '';
