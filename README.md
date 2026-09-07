# BigBrain — Sovereign Industrial AI Workbench (harness-build)

Private AI worker for plants / defence units / tech teams.
Reads your docs, does real work (answers, calcs, Word/Excel later),
checks itself, and proves data never leaves.

## Current build (harness-build)

- Backend: Flask (`backend/app.py`) — thin routes, `use_reloader=False` (stable with torch/tf)
- Frontend: React + Vite (`frontend/`) — reusable components, ingest UI (file + paste)
- Brain: Groq cloud stand-ins (`models/model_registry.yaml`)
  - `groq-slm` -> `openai/gpt-oss-20b`
  - `groq-llm` -> `openai/gpt-oss-120b`
  - `groq-vision` -> LLM for now (free Groq key has no vision model)
- Data: local Postgres 15 + pgvector (`bigbrain` DB) — **org-divided** (sister companies, one server)
- RAG plumbing: `bge-m3` local embeddings (1024-dim), chunking, `POST /docs` + vector search (scoped by `X-Org-Id`)
- Sandbox: restricted Python fallback (`backend/tools/runner.py`), Docker later
- Tool Factory skeleton: `POST /tools/create` tests + saves Python tools
- Observability: every LLM call logged to `llm_calls` (request_id, org_id, prompt/response, tokens, latency)

## Run it

```powershell
# once: create/upgrade DB
python backend/migrate.py

# backend
cd backend
pip install -r requirements.txt
python app.py   # http://localhost:8000

# frontend (new terminal)
cd frontend
npm install
npm run dev     # http://localhost:3000
```

`.env` (not committed, see `.env.example`): `GROQ_API_KEY`, `DATABASE_URL`, `EMBED_MODEL`.

## Endpoints

- `GET /health` — router info
- `POST /ask` — `{text, user_dept, retrieve?}` -> `{task, model, answer, evidence?, request_id, org_id}`
- `POST /docs` — `{title, content, dept?, class?}` + header `X-Org-Id` -> `{id, org_id}` (chunks + embeds)
- `GET /docs` — header `X-Org-Id` -> `{org_id, docs}`
- `POST /tools/run` — `{code}` -> `{ok, stdout}`
- `POST /tools/create` — `{name, code, sample_input}` -> `{saved, path}`
- `GET /tools` — list saved tools

Frontend sends `X-Org-Id` (`VITE_ORG_ID` or `default`). Upload via dashed file box (`.txt/.md/.csv`) or paste form below chat.

## Where to verify RAG/observability

- DB: `SELECT org_id, left(content,60) FROM chunks;` — org-scoped vectors
- Ask: `POST /ask` with `"retrieve":true` returns `evidence` (not yet injected into prompt — Branch 3)
- Logs: `SELECT request_id, org_id, model_key, latency_ms, prompt_tokens FROM llm_calls ORDER BY id DESC;`

## Code rules

- Routes never contain logic — they call a service function.
- `brain/service.py:ask_question()` for ask, `data/service.py:ingest_doc()/vector_search()` for RAG, `tools/factory.py:create_tool()` for tools.
- React: `services/api.js` for all fetch, `hooks/` for logic, `components/` props-only.

## Not built yet

Main RAG prompt (grounding + citations — Branch 3 next), OCR / P&ID vision, LangGraph agent, DOCX/XLSX gen, Red Team, approval gate, Decision DNA, kill-switch UI, local Sarvam/vLLM swap (Phase LAST).
