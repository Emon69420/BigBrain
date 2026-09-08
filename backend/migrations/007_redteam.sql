-- 007: store red-team review (verdict, findings, regenerate state, rejected draft) in messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS redteam TEXT;
