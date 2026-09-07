"""LLM judge — after retrieval, sees evidence + tools + query, picks path."""
import json, re

JUDGE_SYSTEM = """You are a routing judge for BigBrain. Pick ONE decision given the query, retrieved evidence, available tools, and history.

Decisions:
- docs: evidence directly answers it (no math)
- docs_plus_tool: evidence gives facts but needs calculation
- tool_only: pure computation/word problem, no evidence needed
- general: greeting/smalltalk/no docs, no math

Also if docs_plus_tool or tool_only, propose tool_task: a 1-line imperative spec for the tool to build/use (e.g. "compute energy consumed from 200km at 300Wh/km and remaining % of 75kWh").

Rules:
- Prefer docs when evidence contains answer; prefer tool when numbers + "how many/much/percent/left/remaining/total" present.
- If no evidence and no numbers and short greeting → general.
- Be conservative: tool_only only when math is clearly required.

Respond strictly as JSON: {"decision":"docs|docs_plus_tool|tool_only|general","reason":"...","tool_task":"... or empty"}"""

def judge(query, evidence, tool_descs, history_text=""):
    from config import load_registry
    from brain.groq_provider import GroqBrain
    from utils.observability import log_llm_call, new_request_id, timed, elapsed_ms
    reg = load_registry()
    brain = GroqBrain(reg)
    ev_snip = "\n".join(f"[{e.get('doc_id')}] {e.get('title','')} :: {e.get('content','')[:120]}" for e in (evidence or [])[:3]) or "(none)"
    tools_snip = "\n".join(f"- {t['name']}: {t['desc']}" for t in (tool_descs or [])[:8]) or "(no tools)"
    user_block = f"Query: {query}\nEvidence:\n{ev_snip}\nTools:\n{tools_snip}\nHistory: {history_text[:300]}"
    req_id = new_request_id()
    t0 = timed()
    try:
        raw, usage = brain.chat_full("groq-slm", [{"role":"system","content":JUDGE_SYSTEM},{"role":"user","content":user_block}])
        latency = elapsed_ms(t0)
        # parse JSON
        m = re.search(r"\{.*\}", raw, re.S)
        data = json.loads(m.group(0)) if m else {}
        decision = data.get("decision","docs" if evidence else "general")
        if decision not in {"docs","docs_plus_tool","tool_only","general"}:
            decision = "docs" if evidence else "general"
        log_llm_call(req_id, "default", "tool-judge", {"task_type":"tool_judge","complexity":"low"}, "groq-slm", brain.registry.get("groq-slm",{}).get("model_id",""), user_block, raw, usage, latency)
        # console mirror
        import logging; logging.getLogger("bigbrain").info("judge req=%s decision=%s reason=%s", req_id, decision, data.get("reason","")[:60])
        return {"decision":decision, "reason":data.get("reason",""), "tool_task":data.get("tool_task",""), "raw":raw, "request_id":req_id}
    except Exception as e:
        latency = elapsed_ms(t0)
        try:
            log_llm_call(req_id, "default", "tool-judge", {"task_type":"tool_judge","complexity":"low"}, "groq-slm", "", user_block, None, None, latency, error=str(e))
        except: pass
        # fail-open: docs if evidence else general
        return {"decision":("docs" if evidence else "general"), "reason":"judge failed open: "+str(e), "tool_task":"", "raw":""}
