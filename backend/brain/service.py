"""Brain service — reusable business logic. Routes call this, never Groq directly."""
from config import load_registry
from brain.groq_provider import GroqBrain
from brain.prompts import build_rag_prompt
from utils.observability import new_request_id, log_llm_call, timed, elapsed_ms

_registry = load_registry()
_brain = GroqBrain(_registry)


def ask_question(text, user_dept="operations", org_id="default", request_id=None, retrieve=True, history_text=""):
    """Full ask pipeline. Always-on rewriter + RRF + floor + grounded prompt. Logs every call."""
    request_id = request_id or new_request_id()
    task = _brain.classify_task(text)
    model_key = _brain.route(task)
    model_id = _brain.registry.get(model_key, {}).get("model_id", "")
    evidence = []
    grounded = False
    general_knowledge = False
    search_queries=[text]
    tool_used = None
    tool_trace = []
    if retrieve:
        try:
            from data.service import hybrid_search
            evidence = hybrid_search(text, user_dept, limit=5, org_id=org_id, queries=[text])
        except Exception:
            evidence = []
        # --- auto tool: every calculation/physics/coding benefits from a tool (no prompt, no toggle) ---
        task_is_toolable = task.get("task_type") in {"calculation","coding"} or task.get("modality")=="calc" or any(k in text.lower() for k in ["calculate","compute","simulate","pressure","load","blast","bending","heat transfer","convert"])
        if task_is_toolable:
            try:
                from tools.builder import ensure_tool
                from tools.runner import run_tool
                # ensure (reuse saves compute, miss builds)
                t_res = ensure_tool(text, sample_input=None, created_by="auto", org_id=org_id)
                tool_trace = t_res.get("trace", [])
                entry = t_res.get("entry")
                if entry:
                    # extract args using exact arg names from full_desc
                    args = {}
                    try:
                        full = entry.get("full_desc","") or entry.get("desc","")
                        arg_prompt = f"Tool {entry['name']} expects:\n{full}\nQuery: {text}\nReturn JSON with exact arg names only, e.g. {{\"charge_kg\":10}}. Numbers only, no units string. Return JSON only."
                        raw,_ = _brain.chat_full("groq-llm", [{"role":"user","content":arg_prompt}])
                        import json, re
                        m=re.search(r"\{.*\}", raw, re.S)
                        if m: args=json.loads(m.group(0))
                        # normalize: if model returned generic keys like force/distance, map to actual arg names via fuzzy
                        if args and entry["name"] not in str(args):
                            # keep as is; run_tool will error and we surface it
                            pass
                    except: args={}
                    run_res = run_tool(entry["name"], args if args else None)
                    if run_res.get("ok"):
                        tool_used = {"name": entry["name"], "hit": t_res.get("hit", False), "uses": entry.get("uses",0), "result": run_res.get("stdout") or str(run_res.get("result"))}
                        # inject as tool evidence so answer can cite [tool:name]
                        evidence = [{"content": f"Tool {entry['name']} result: {tool_used['result']}", "doc_id": entry["name"], "title": f"tool:{entry['name']}", "dept": user_dept, "class": "open", "distance": 0.0, "tool": True}] + evidence
                    else:
                        tool_used = {"name": entry["name"], "error": run_res.get("error"), "hit": t_res.get("hit", False)}
            except Exception as e:
                tool_trace.append(f"tool auto failed: {e}")
        prompt = build_rag_prompt(text, evidence)
        grounded = True
        general_knowledge = len([e for e in evidence if not e.get("tool")]) == 0 and not tool_used
    else:
        prompt = text
        general_knowledge = True
    t0 = timed()
    try:
        answer, usage = _brain.chat_full(model_key, [{"role": "user", "content": prompt}])
        latency = elapsed_ms(t0)
        log_llm_call(request_id, org_id, user_dept, task, model_key, model_id,
                     prompt, answer, usage, latency)
    except Exception as e:
        latency = elapsed_ms(t0)
        err = str(e)
        log_llm_call(request_id, org_id, user_dept, task, model_key, model_id,
                     prompt, None, None, latency, error=err)
        raise
    out = {
        "task": task, "model": model_key, "model_id": model_id,
        "answer": answer, "mode": "harness-groq+localpg",
        "request_id": request_id, "org_id": org_id,
        "grounded": grounded, "general_knowledge": general_knowledge if retrieve else True,
        "evidence": evidence if retrieve else [],
        "search_queries": search_queries if retrieve else [],
        "tool_used": tool_used,
        "tool_trace": tool_trace,
    }
    return out


def get_router_info():
    return _registry["router"]
