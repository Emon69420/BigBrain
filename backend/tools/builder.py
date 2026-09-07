"""Builder + loop: ensure_tool -> hit reuse (0 compute) or LLM build->test->fix->save."""
import re
from brain.prompts import build_builder_prompt, build_fix_prompt
from tools.factory import find_tool, create_tool, bump_uses

def _call_llm_for_code(task, sample, error=None, prev_code="", org_id="default"):
    from config import load_registry
    from brain.groq_provider import GroqBrain
    from utils.observability import log_llm_call, new_request_id, timed, elapsed_ms
    reg = load_registry()
    brain = GroqBrain(reg)
    model_key = "groq-llm"
    model_id = brain.registry.get(model_key, {}).get("model_id", "")
    prompt = build_fix_prompt(task, prev_code, error, sample) if error else build_builder_prompt(task, sample)
    req_id = new_request_id()
    t0 = timed()
    try:
        raw, usage = brain.chat_full(model_key, [{"role": "user", "content": prompt}])
        latency = elapsed_ms(t0)
        log_llm_call(req_id, org_id, "tool-factory", {"task_type": "tool_build", "complexity": "high"},
                     model_key, model_id, prompt, raw, usage, latency)
    except Exception as e:
        latency = elapsed_ms(t0)
        log_llm_call(req_id, org_id, "tool-factory", {"task_type": "tool_build", "complexity": "high"},
                     model_key, model_id, prompt, None, None, latency, error=str(e))
        raise
    # console mirror for live tail
    import logging; logging.getLogger("bigbrain").info("tool req=%s org=%s task=\"%s\" attempt=%s %s", req_id, org_id, task[:40], "fix" if error else "build", "ok" if raw else "empty")
    m = re.search(r"```(?:python)?\s*(.*?)```", raw, re.S)
    code = m.group(1).strip() if m else raw.strip()
    return code, {"raw": raw, "usage": usage, "request_id": req_id}

def ensure_tool(task, sample_input=None, created_by="agent", org_id="default"):
    """Registry hit -> return reused entry (0 build). Else LLM build->test->fix up to 3 tries."""
    hit = find_tool(task)
    if hit:
        import logging
        logging.getLogger("bigbrain").info("tool hit org=%s task=\"%s\" -> %s uses=%s (0 rebuild)", org_id, task[:40], hit["name"], hit.get("uses",0))
        return {"hit": True, "entry": hit, "reused": True, "trace": ["registry hit: " + hit["name"] + f" (uses {hit.get('uses',0)}, 0 rebuild)"]}

    trace = ["registry miss: " + task[:60]]
    prev_code = ""
    last_err = None
    for attempt in range(3):
        trace.append(f"build attempt {attempt+1}")
        code, meta = _call_llm_for_code(task, sample_input, error=last_err, prev_code=prev_code, org_id=org_id)
        prev_code = code
        # try save (create_tool does test)
        res = create_tool(_slug(task), code, sample_input, created_by=created_by)
        if res.get("saved"):
            trace.append(f"saved {res['entry']['name']}")
            return {"hit": False, "entry": res["entry"], "code": code, "trace": trace, "reused": False}
        last_err = res.get("error") or str(res.get("test", {}).get("error"))
        trace.append(f"test failed: {last_err}")
    return {"hit": False, "error": last_err, "trace": trace, "reused": False}

def _slug(task):
    # stable name from task: first 3 keywords joined with _
    words = [w for w in task.lower().split() if w.isalpha()][:4]
    base = "_".join(words) or "custom_tool"
    # ensure unique if exists
    from tools.factory import _load_registry
    names = {t["name"] for t in _load_registry()["tools"]}
    if base not in names:
        return base
    for i in range(2, 99):
        cand = f"{base}_{i}"
        if cand not in names:
            return cand
    return base + "_x"
