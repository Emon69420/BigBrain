"""Selector — smart LLM picks exact-fit tools, decides if enough, lists missing."""
import json, re

SELECTOR_SYSTEM = """You have a registry of tools. Decide if they are enough for the task.

Task may be: {purpose} with inputs {inputs}
Available tools:
{tools}

Return JSON: {{"verdict":"sufficient|partial|none","selected":[{{"tool":"name","arg_map":{{"tool_arg":"input_key"}}}}],"missing":[{{"purpose":"...","inputs":{{}}}}]}}
Rules:
- sufficient: one or chain of existing tools covers 100% with exact arg mapping
- partial: some steps covered, some missing
- none: nothing covers it
- Only map args that exist in inputs or prior step outputs
- Never invent tool names not in registry
Return JSON only."""

def select(task_obj, tool_descs):
    from config import load_registry
    from brain.groq_provider import GroqBrain
    from utils.observability import log_llm_call, new_request_id, timed, elapsed_ms
    reg = load_registry()
    brain = GroqBrain(reg)
    purpose = task_obj.get("purpose","") if isinstance(task_obj, dict) else str(task_obj)
    inputs = task_obj.get("inputs",{}) if isinstance(task_obj, dict) else {}
    tools_snip = "\n".join(f"- {t['name']}: {t['desc']} Args: {t['full_desc'].split('Args:')[-1].split('Returns:')[0].strip() if 'Args:' in t['full_desc'] else ''}" for t in tool_descs[:12]) or "(none)"
    prompt = SELECTOR_SYSTEM.format(purpose=purpose, inputs=json.dumps(inputs), tools=tools_snip)
    req_id = new_request_id()
    t0 = timed()
    try:
        raw, usage = brain.chat_full("groq-slm", [{"role":"system","content":prompt},{"role":"user","content":purpose}], temperature=0)
        latency = elapsed_ms(t0)
        m = re.search(r"\{.*\}", raw, re.S)
        data = json.loads(m.group(0)) if m else {}
        verdict = data.get("verdict","none")
        if verdict not in ("sufficient","partial","none"):
            verdict = "none"
        log_llm_call(req_id, "default", "tool-select", {"task_type":"tool_select","complexity":"low"}, "groq-slm", brain.registry.get("groq-slm",{}).get("model_id",""), prompt, raw, usage, latency)
        import logging; logging.getLogger("bigbrain").info("select req=%s verdict=%s selected=%s missing=%s", req_id, verdict, len(data.get("selected",[])), len(data.get("missing",[])))
        return {"verdict":verdict, "selected":data.get("selected",[]), "missing":data.get("missing",[]), "raw":raw}
    except Exception as e:
        latency = elapsed_ms(t0)
        try: log_llm_call(req_id, "default", "tool-select", {"task_type":"tool_select","complexity":"low"}, "groq-slm", "", prompt, None, None, latency, error=str(e))
        except: pass
        return {"verdict":"none","selected":[],"missing":[{"purpose":purpose,"inputs":inputs}]}
