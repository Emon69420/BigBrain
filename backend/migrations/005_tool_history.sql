-- 005: store tool_used + judge trace in messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS tool_used TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS tool_trace TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS judge TEXT;
