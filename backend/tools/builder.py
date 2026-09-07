"""Builder + loop: ensure_tool -> hit reuse (0 compute) or LLM build->test->fix->save."""
import re
from brain.prompts import build_builder_prompt, build_fix_prompt
from tools.factory import find_tool, create_tool, bump_uses

def _call_llm_for_code(task, sample, error=None, prev_code=""):
    from config import load_registry
    from brain.groq_provider import GroqBrain
    reg = load_registry()
    brain = GroqBrain(reg)
    # use llm slot (stronger code reasoning)
    if error:
        prompt = build_fix_prompt(task, prev_code, error, sample)
    else:
        prompt = build_builder_prompt(task, sample)
    raw, usage = brain.chat_full("groq-llm", [{"role": "user", "content": prompt}])
    # extract python code from markdown fence if present
    m = re.search(r"```(?:python)?\s*(.*?)```", raw, re.S)
    code = m.group(1).strip() if m else raw.strip()
    return code, {"raw": raw, "usage": usage}

def ensure_tool(task, sample_input=None, created_by="agent"):
    """Registry hit -> return reused entry (0 build). Else LLM build->test->fix up to 3 tries."""
    hit = find_tool(task)
    if hit:
        # hit is reuse — bump_uses not yet, run will bump on actual use
        return {"hit": True, "entry": hit, "reused": True, "trace": ["registry hit: " + hit["name"]]}

    trace = ["registry miss: " + task[:60]]
    prev_code = ""
    last_err = None
    for attempt in range(3):
        trace.append(f"build attempt {attempt+1}")
        code, meta = _call_llm_for_code(task, sample_input, error=last_err, prev_code=prev_code)
        prev_code = code
        # log each build attempt to llm_calls via observability inside chat_full? already logged via service? we log here too
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
