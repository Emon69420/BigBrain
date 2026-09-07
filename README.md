# BigBrain — Sovereign Industrial AI Workbench (Harness Build)

Private AI worker for plants / defence units / tech teams.
Reads your docs, does real work (answers, calcs, Word/Excel later),
checks itself, and proves data never leaves.

## Current build (harness)

- Backend: Flask (`backend/app.py`) — thin routes only, logic in services
- Frontend: React + Vite (`frontend/`) — reusable components
- Brain: Groq cloud stand-ins (`models/model_registry.yaml`)
  - simple -> `openai/gpt-oss-20b` (SLM slot)
  - complex -> `openai/gpt-oss-120b` (LLM slot)
  - vision -> LLM for now (free Groq key has no vision model)
- Data: local Postgres 15 + pgvector on your PC (`bigbrain` DB)
- Sandbox: restricted Python fallback (`backend/tools/runner.py`), Docker later
- Tool Factory skeleton: `POST /tools/create` tests + saves Python tools

## Run it

```powershell
# backend
cd backend
pip install -r requirements.txt
python app.py   # http://localhost:8000

# frontend (new terminal)
cd frontend
npm install
npm run dev     # http://localhost:3000
```

Needs `.env` (not committed, see `.env.example`):
`GROQ_API_KEY`, `DATABASE_URL`, `EMBED_MODEL`.

## Endpoints

- `GET /health` — router info
- `POST /ask` — `{text, user_dept}` -> `{task, model, answer}`
- `POST /tools/run` — `{code}` -> `{ok, stdout}`
- `POST /tools/create` — `{name, code, sample_input}` -> `{saved, path}`
- `GET /tools` — list saved tools

## Code rules

- Routes never contain logic — they call a service function.
- `brain/service.py:ask_question()` for ask, `data/service.py:search_docs()/save_doc()`
  for docs, `tools/factory.py:create_tool()` for tools.
- React: `services/api.js` for all fetch, `hooks/` for logic,
  `components/` props-only.

## Not built yet

Vector embeddings search, OCR / P&ID vision, LangGraph agent,
DOCX/XLSX gen, Red Team, approval gate, Decision DNA, kill-switch UI,
local Sarvam/vLLM swap (Phase LAST).
