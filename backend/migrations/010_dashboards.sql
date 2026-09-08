-- 010: Dashboard Maker ("Boards") — conversational zone/general dashboards.
-- dashboards.status: 'draft' (being iterated with the bot) -> 'live' (staff fill values).
-- metrics JSONB: [{key, label, unit, kind}] kind is 'number' or 'text'.
-- readings: one row per update; "current value" = latest per (dashboard_id, metric_key).
CREATE TABLE IF NOT EXISTS dashboards (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL DEFAULT 'default',
    name TEXT NOT NULL DEFAULT '',
    zone TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    metrics TEXT NOT NULL DEFAULT '[]',
    created_by TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS readings (
    id BIGSERIAL PRIMARY KEY,
    dashboard_id TEXT NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    metric_key TEXT NOT NULL DEFAULT '',
    value_num DOUBLE PRECISION,
    value_text TEXT NOT NULL DEFAULT '',
    recorded_by TEXT NOT NULL DEFAULT '',
    recorded_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dashboards_org ON dashboards(org_id, status);
CREATE INDEX IF NOT EXISTS idx_readings_board_metric_time
    ON readings(dashboard_id, metric_key, recorded_at DESC);
