-- 006: hierarchical chunks — parents hold context, leaves hold vectors.
-- Old rows keep parent_id NULL + level 'leaf' (standalone, usable as-is).
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES chunks(id) ON DELETE CASCADE;
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS chunk_level TEXT DEFAULT 'leaf';
CREATE INDEX IF NOT EXISTS idx_chunks_parent ON chunks(parent_id);
CREATE INDEX IF NOT EXISTS idx_chunks_level ON chunks(chunk_level);
