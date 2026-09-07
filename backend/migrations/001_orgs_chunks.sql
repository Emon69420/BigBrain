-- 001: multi-org layout + chunks for RAG. Safe to re-run.
CREATE TABLE IF NOT EXISTS orgs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
INSERT INTO orgs (id, name) VALUES ('default', 'Default org')
ON CONFLICT (id) DO NOTHING;

-- documents table already exists from harness scaffold; add org scope.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS org_id TEXT;
UPDATE documents SET org_id = 'default' WHERE org_id IS NULL;
ALTER TABLE documents ALTER COLUMN org_id SET NOT NULL;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_org_fk') THEN
        ALTER TABLE documents ADD CONSTRAINT documents_org_fk
        FOREIGN KEY (org_id) REFERENCES orgs(id);
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_documents_org ON documents(org_id);

CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS chunks (
    id SERIAL PRIMARY KEY,
    org_id TEXT NOT NULL REFERENCES orgs(id),
    doc_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1024),
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chunks_org ON chunks(org_id);
CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(doc_id);
