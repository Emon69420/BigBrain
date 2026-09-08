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
- tool_task.inputs = exact numbers from the query (units stripped) PLUS standard physical constants the task needs (gravity 9.8 m/s2, water specific heat 4.2 J/gC or 4186 J/kgC, etc.). Never computed results, never call-syntax.
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
        raw, usage = brain.chat_full("groq-llm", [{"role":"system","content":JUDGE_SYSTEM},{"role":"user","content":user_block}], temperature=0)
        latency = elapsed_ms(t0)
        m = re.search(r"\{.*\}", raw, re.S)
        data = json.loads(m.group(0)) if m else {}
        decision = data.get("decision","docs" if evidence else "general")
        if decision not in {"docs","docs_plus_tool","tool_only","general"}:
            decision = "docs" if evidence else "general"
        # numeric backstop: quantities (number+unit) without tool decision -> force tool_only
        tt = data.get("tool_task","")
        units = r"m/s|km/h|mph|m/s2|kg\b|grams?|newtons?|\bN\b|watts?|\bkW\b|\bWh\b|kWh|joules?|degrees?|°c|°f|seconds?|\bsec\b|minutes?|\bmin\b|hours?|metres?|meters?|\bkm\b|\bcm\b|\bmm\b|litres?|liters?|volts?|amps?|ohms?|hz\b|metres? per second"
        has_quantity = bool(re.search(r"\d+\s*(?:" + units + r")", query, re.I))
        has_math_words = bool(re.search(r"how many|how much|percent|left|remaining|total|calculat|compute|convert|long|height|time|velocity|speed|force|pressure|power|current|voltage|area|volume|mass|weight|accelerat|temperature|energy", query.lower()))
        # self-contradiction repair: reason admits maths but decision says general/docs
        # (negated mentions like "no calculation required" do NOT count)
        reason_l = (data.get("reason","") or "").lower()
        negated = bool(re.search(r"no (calculation|math|tool)|without .*?(math|calculat|tool)|not (require|need).*?(math|calculat|tool)", reason_l))
        contradicts = decision in ("docs","general") and (not negated) and bool(re.search(r"calculat|physics|equation|numeric|math", reason_l))
        # reverse repair: reason denies maths but decision demands tools -> force general/docs
        denies_math = bool(re.search(r"greeting|smalltalk|without .*?(calculat|math)|no (calculat|math)|factual lookup|no math", reason_l))
        if decision in ("tool_only", "docs_plus_tool") and denies_math:
            import logging as _lg0; _lg0.getLogger("bigbrain").info("judge reverse-repair: reason denies maths, forcing general/docs")
            decision = "docs" if evidence else "general"
        if decision in ("docs","general") and ((has_quantity and has_math_words) or contradicts):
            if contradicts:
                import logging as _lg; _lg.getLogger("bigbrain").info("judge self-contradiction repaired: reason admits maths, forcing tool path")
            decision = "tool_only" if not evidence else "docs_plus_tool"
            if not tt:
                tt = {"purpose": query[:80], "inputs": {}}
        # normalize tool_task to dict with purpose+inputs
        if isinstance(tt, str):
            tt = {"purpose": tt, "inputs": {}}
        if not isinstance(tt, dict):
            tt = {"purpose": str(tt), "inputs": {}}
        # empty tool_task on a tool path -> retry once, then deterministic extract
        if decision in ("tool_only", "docs_plus_tool") and not (tt.get("purpose") or "").strip():
            try:
                raw2, usage2 = brain.chat_full("groq-llm", [{"role": "system", "content": JUDGE_SYSTEM + "\nYou MUST include tool_task with purpose and inputs. Empty tool_task is forbidden on tool decisions."}, {"role": "user", "content": user_block}], temperature=0)
                m2 = re.search(r"\{.*\}", raw2, re.S)
                d2 = json.loads(m2.group(0)) if m2 else {}
                if isinstance(d2.get("tool_task"), dict) and (d2["tool_task"].get("purpose") or "").strip():
                    tt = d2["tool_task"]
                    import logging as _lg2; _lg2.getLogger("bigbrain").info("judge retry filled empty tool_task")
            except Exception:
                pass
        if decision in ("tool_only", "docs_plus_tool") and not (tt.get("purpose") or "").strip():
            # deterministic fallback: purpose = query, inputs from unit extraction
            try:
                from tools.factory import extract_inputs
                tt = {"purpose": query[:120], "inputs": extract_inputs(query)}
                import logging as _lg3; _lg3.getLogger("bigbrain").info("judge fallback: deterministic inputs %s", tt["inputs"])
            except Exception:
                tt = {"purpose": query[:120], "inputs": {}}
        log_llm_call(req_id, "default", "tool-judge", {"task_type":"tool_judge","complexity":"low"}, "groq-llm", brain.registry.get("groq-llm",{}).get("model_id",""), user_block, raw, usage, latency)
        import logging; logging.getLogger("bigbrain").info("judge req=%s decision=%s reason=%s task=%s", req_id, decision, data.get("reason","")[:50], str(tt.get("purpose",""))[:40])
        return {"decision":decision, "reason":data.get("reason",""), "tool_task":tt, "raw":raw, "request_id":req_id}
    except Exception as e:
        latency = elapsed_ms(t0)
        try:
            log_llm_call(req_id, "default", "tool-judge", {"task_type":"tool_judge","complexity":"low"}, "groq-llm", "", user_block, None, None, latency, error=str(e))
        except: pass
        # fail-open: docs if evidence else general
        return {"decision":("docs" if evidence else "general"), "reason":"judge failed open: "+str(e), "tool_task":"", "raw":""}
