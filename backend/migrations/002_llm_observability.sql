-- 002: LLM observability. One row per model call: prompt + response + cost data.
CREATE TABLE IF NOT EXISTS llm_calls (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    request_id TEXT NOT NULL,
    org_id TEXT NOT NULL,
    user_dept TEXT NOT NULL,
    task_type TEXT,
    complexity TEXT,
    model_key TEXT,
    model_id TEXT,
    prompt TEXT,
    response TEXT,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    latency_ms INTEGER,
    error TEXT
);
CREATE INDEX IF NOT EXISTS idx_llm_calls_org_time ON llm_calls(org_id, created_at);
CREATE INDEX IF NOT EXISTS idx_llm_calls_request ON llm_calls(request_id);

CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT now()
);
