# BigBrain — Sovereign Industrial AI Workbench (prompts-rag-main)

Private AI worker for plants / defence units / tech teams.
Reads your docs, does real work (answers, calcs, Word/Excel later),
checks itself, and proves data never leaves.

## Current build (prompts-rag-main)

- Backend: Flask (`backend/app.py`) — thin routes, `use_reloader=False` (stable with torch/tf)
- Frontend: React + Vite (`frontend/`) — chat + **grounded Sources** + AgentTrace + ingest UI (file + paste)
- Brain: Groq cloud stand-ins (`models/model_registry.yaml`)
  - `groq-slm` -> `openai/gpt-oss-20b`
  - `groq-llm` -> `openai/gpt-oss-120b`
  - `groq-vision` -> LLM for now (free Groq key has no vision model)
- Data: local Postgres 15 + pgvector (`bigbrain` DB) — **org-divided** (sister companies, one server)
- RAG: `bge-m3` local embeddings (1024-dim), chunking, vector search per org, **grounded prompt** (`backend/brain/prompts.py`) — answers cite `[doc:ID]`, says `Not found in your docs.` when empty
- Observability: every LLM call logged to `llm_calls` (`request_id`, `org_id`, full grounded prompt, response, tokens, latency, error)
- Sandbox: restricted Python fallback (`backend/tools/runner.py`), Docker later
- Tool Factory skeleton: `POST /tools/create` tests + saves Python tools

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

# synthetic oil-operations knowledge base for RAG demos (one org, 300 docs)
python backend/seed_oil_kb.py --org-id indianoil-demo
# If a long embedding run is interrupted, continue without duplicates:
python backend/seed_oil_kb.py --org-id indianoil-demo --resume
```

`.env` (not committed, see `.env.example`): `GROQ_API_KEY`, `DATABASE_URL`, `EMBED_MODEL`.

## Endpoints

- `GET /health` — router info
- `POST /ask` — `{text, user_dept}` + header `X-Org-Id` -> `{task, model, answer, grounded, evidence[], request_id, org_id, model_id}` — `retrieve` defaults **true** (grounded); pass `retrieve:false` to disable grounding
- `POST /docs` — `{title, content, dept?, class?}` + header `X-Org-Id` -> `{id, org_id}` (chunks + embeds)
- `GET /docs` — header `X-Org-Id` -> `{org_id, docs}`
- `POST /tools/run` — `{code}` -> `{ok, stdout}`
- `POST /tools/create` — `{name, code, sample_input}` -> `{saved, path}`
- `GET /tools` — list saved tools

The synthetic seed creates one `Indian Oil Demo Operations` organisation with
300 clearly marked fictional references covering zones, ownership, SOPs,
maintenance, safety, process operations, laboratory, logistics, environment,
and governance. It uses the normal hierarchical chunking and local embedding
path, and only resets documents whose title starts with `[SYNTHETIC OIL DEMO]`.

Frontend sends `X-Org-Id` (`VITE_ORG_ID` or `default`). Upload via dashed file box (`.txt/.md/.csv`) or paste form below chat. Ask box is always grounded — `Sources (n)` appears under every answer.

## How to verify

- Grounded: ingest `SOP-17` with `Inspection interval for P-204 is 6 months.` then ask the same — answer contains `6 months [doc:ID]`, `Sources (1)` lists that doc.
- Hallucination guard: ask about something not in docs (`Mars launch date`) — answer is `Not found in your docs.` and Sources says the same.
- Org isolation: same title in `orgA` vs `orgB` (e.g., 6 vs 12 months) — each org retrieves only its own chunk (check `Sources [doc:ID]`).
- Logs: `SELECT request_id, org_id, grounded, left(prompt,120) FROM llm_calls ORDER BY id DESC;` shows the full grounded prompt sent to Groq.

## Code rules

- Routes never contain logic — they call a service function.
- `brain/prompts.py:build_rag_prompt()` is the **only** place prompts live; `brain/service.py:ask_question()` is the only caller.
- `data/service.py:ingest_doc()/vector_search()` for RAG, `tools/factory.py:create_tool()` for tools.
- React: `services/api.js` for all fetch, `hooks/` for logic, `components/` props-only (`MessageList` shows Sources, `AgentTrace` shows `Retrieved n chunks`).

## Not built yet

OCR / P&ID vision, LangGraph agent, DOCX/XLSX gen, Red Team, approval gate, Decision DNA, kill-switch UI, local Sarvam/vLLM swap (Phase LAST).
