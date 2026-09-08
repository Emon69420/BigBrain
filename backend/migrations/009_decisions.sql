-- 009: Decision DNA — one queryable row per answer.
-- Links: request_id joins llm_calls + messages. No approval columns (human review parked).
CREATE TABLE IF NOT EXISTS decisions (
    id TEXT PRIMARY KEY,
    request_id TEXT UNIQUE NOT NULL,
    org_id TEXT NOT NULL DEFAULT 'default',
    created_at TIMESTAMPTZ DEFAULT now(),
    question TEXT NOT NULL DEFAULT '',
    task_type TEXT NOT NULL DEFAULT '',
    model_key TEXT NOT NULL DEFAULT '',
    model_id TEXT NOT NULL DEFAULT '',
    evidence TEXT NOT NULL DEFAULT '[]',
    tool_used TEXT NOT NULL DEFAULT '{}',
    redteam TEXT NOT NULL DEFAULT '{}',
    judge TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_decisions_org_time ON decisions(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_request ON decisions(request_id);
