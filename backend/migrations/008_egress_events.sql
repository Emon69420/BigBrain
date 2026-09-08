-- 008: egress event ledger for the Security dashboard.
-- Every row records a true destination. Counts are derived from these rows;
-- nothing is displayed that is not recorded here first.
CREATE TABLE IF NOT EXISTS egress_events (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    org_id TEXT NOT NULL DEFAULT 'default',
    kind TEXT NOT NULL,
    host TEXT NOT NULL,
    verdict TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_egress_org_time ON egress_events(org_id, created_at DESC);
