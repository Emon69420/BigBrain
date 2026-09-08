"""LLM judge — after retrieval, sees evidence + tools + query, picks path."""
import json, re

JUDGE_SYSTEM = """You are the strict gate for BigBrain. Every maths/physics/coding message MUST use a tool. Never let maths be guessed.

Decisions:
- docs: ONLY factual lookup with evidence and NO maths
- docs_plus_tool: evidence has facts BUT you still need to calculate
- tool_only: pure maths/physics/coding word problem
- general: greeting/smalltalk only

Hard rule: ANY maths beyond talking & fact lookup MUST be tool_only/docs_plus_tool.

Tool_task rules (critical):
- tool_task.purpose MUST be a concise imperative rephrase of the USER'S query intent (what they asked to calculate), NEVER a description of an evidence doc.
- tool_task.inputs = exact numbers from the query only (units stripped), never computed results, never call-syntax.
Example for refinery flow: {"purpose":"compute litres per second from 0.5 m3/s, seconds to fill 1800000 litres tank, and minutes","inputs":{"flow_m3_per_s":0.5,"litres_per_m3":1000,"tank_litres":1800000}}
Example for pressure: {"purpose":"compute pressure drop across pipeline","inputs":{...}}

Respond strictly as JSON: {"decision":"...","reason":"...","tool_task":{"purpose":"...","inputs":{}} or ""}"""

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
        raw, usage = brain.chat_full("groq-slm", [{"role":"system","content":JUDGE_SYSTEM},{"role":"user","content":user_block}], temperature=0)
        latency = elapsed_ms(t0)
        m = re.search(r"\{.*\}", raw, re.S)
        data = json.loads(m.group(0)) if m else {}
        decision = data.get("decision","docs" if evidence else "general")
        if decision not in {"docs","docs_plus_tool","tool_only","general"}:
            decision = "docs" if evidence else "general"
        # numeric backstop: maths without tool decision -> force tool_only
        tt = data.get("tool_task","")
        has_numbers = bool(re.search(r"\d", query))
        has_math_words = bool(re.search(r"how many|how much|percent|left|remaining|total|calculate|compute|convert|degrees|joules|energy|watts", query.lower()))
        if decision in ("docs","general") and has_numbers and has_math_words:
            decision = "tool_only" if not evidence else "docs_plus_tool"
            if not tt:
                tt = {"purpose": query[:80], "inputs": {}}
        # normalize tool_task to dict with purpose+inputs
        if isinstance(tt, str):
            tt = {"purpose": tt, "inputs": {}}
        if not isinstance(tt, dict):
            tt = {"purpose": str(tt), "inputs": {}}
        log_llm_call(req_id, "default", "tool-judge", {"task_type":"tool_judge","complexity":"low"}, "groq-slm", brain.registry.get("groq-slm",{}).get("model_id",""), user_block, raw, usage, latency)
        import logging; logging.getLogger("bigbrain").info("judge req=%s decision=%s reason=%s task=%s", req_id, decision, data.get("reason","")[:50], str(tt.get("purpose",""))[:40])
        return {"decision":decision, "reason":data.get("reason",""), "tool_task":tt, "raw":raw, "request_id":req_id}
    except Exception as e:
        latency = elapsed_ms(t0)
        try:
            log_llm_call(req_id, "default", "tool-judge", {"task_type":"tool_judge","complexity":"low"}, "groq-slm", "", user_block, None, None, latency, error=str(e))
        except: pass
        # fail-open: docs if evidence else general
        return {"decision":("docs" if evidence else "general"), "reason":"judge failed open: "+str(e), "tool_task":"", "raw":""}
