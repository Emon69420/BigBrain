"""Tool Factory service — docstring contract + registry + reuse. """
import ast
import importlib.util
import os
import yaml
from tools.runner import test_tool

REGISTRY_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "models", "tool_registry.yaml")
CUSTOM_DIR = os.path.join(os.path.dirname(__file__), "custom")

# --- docstring contract ---

def parse_desc(code):
    """Extract tool desc from module docstring. First non-empty line = summary."""
    try:
        tree = ast.parse(code)
        doc = ast.get_docstring(tree) or ""
    except Exception:
        doc = ""
    # also handle bare triple-quoted string at top if get_docstring misses due to formatting
    if not doc.strip():
        for q in ['"""','"\'"\'']:
            if code.lstrip().startswith(q):
                end = code.find(q, 3)
                if end != -1:
                    doc = code[3:end]
                    break
    lines = [l.strip() for l in doc.strip().splitlines() if l.strip()]
    summary = lines[0] if lines else ""
    return {"summary": summary, "full": doc.strip()}


def validate_tool(code):
    """Enforces docstring contract + def main exists."""
    desc = parse_desc(code)
    if not desc["summary"]:
        return False, "missing docstring: first line must be tool desc inside triple quotes"
    if "def main" not in code:
        return False, "missing def main(...) entrypoint"
    return True, desc

# --- registry (yaml, mirrors model_registry.yaml) ---

def _load_registry():
    if not os.path.exists(REGISTRY_PATH):
        return {"tools": []}
    with open(REGISTRY_PATH, encoding="utf-8") as f:
        data = yaml.safe_load(f) or {"tools": []}
        data.setdefault("tools", [])
        return data

def _save_registry(data):
    with open(REGISTRY_PATH, "w", encoding="utf-8") as f:
        yaml.safe_dump(data, f, sort_keys=False, allow_unicode=True)

def list_registry():
    """Full registry entries (name, path, desc, status, version, uses)."""
    return _load_registry()["tools"]

def _find_entry(name):
    for t in _load_registry()["tools"]:
        if t["name"] == name:
            return t
    return None

def register_tool(name, code, created_by="user"):
    desc = parse_desc(code)
    data = _load_registry()
    # upsert
    existing = next((t for t in data["tools"] if t["name"] == name), None)
    entry = {
        "name": name,
        "path": f"backend/tools/custom/{name}.py",
        "desc": desc["summary"],
        "full_desc": desc["full"],
        "status": "unverified",
        "version": 1 if not existing else existing.get("version", 1) + 1,
        "uses": existing.get("uses", 0) if existing else 0,
        "created_by": created_by,
    }
    if existing:
        idx = data["tools"].index(existing)
        # keep uses, bump version
        data["tools"][idx] = entry
    else:
        data["tools"].append(entry)
    _save_registry(data)
    return entry

def bump_uses(name):
    data = _load_registry()
    for t in data["tools"]:
        if t["name"] == name:
            t["uses"] = (t.get("uses", 0) or 0) + 1
            _save_registry(data)
            return t["uses"]
    return 0

def find_tool(task_text):
    """Exact word match with threshold — avoids substring false hits."""
    import re
    q = (task_text or "").lower()
    best = None
    best_score = 0
    stop = {"calculate","compute","computing","using","across","from","with","for","and","the","per","second","seconds","minutes","minute"}
    for t in _load_registry()["tools"]:
        blob = (t.get("desc","") + " " + t.get("full_desc","")).lower()
        blob_words = set(re.findall(r"[a-z0-9]+", blob))
        qwords = [w for w in re.findall(r"[a-z0-9]+", q) if len(w) >= 3 and w not in stop]
        if not qwords:
            qwords = [w for w in re.findall(r"[a-z0-9]+", q) if len(w) >= 3]
        score = sum(1 for w in qwords if w in blob_words)
        if score > best_score:
            best_score = score
            best = t
    return best if best_score >= 2 else None

def score_fit(task, entry):
    """Grade fit: exact (covers task + args satisfiable), partial, none. Never call partial."""
    import re
    q = (task or "").lower()
    blob = (entry.get("desc","") + " " + entry.get("full_desc","")).lower()
    blob_words = set(re.findall(r"[a-z0-9]+", blob))
    stop = {"calculate","compute","computing","using","across","from","with","for","and","the","per","second","seconds","minutes","minute"}
    qwords = [w for w in re.findall(r"[a-z0-9]+", q) if len(w) >= 3 and w not in stop]
    if not qwords:
        qwords = [w for w in re.findall(r"[a-z0-9]+", q) if len(w) >= 3]
    score = sum(1 for w in qwords if w in blob_words)
    # short tasks (1 distinctive word) -> score 1 is exact (e.g. factorial)
    if len(qwords) == 1:
        return "exact" if score >= 1 else "none"
    if score >= 2 and score >= max(2, len(qwords)//2):
        return "exact"
    if score >= 1:
        return "partial"
    return "none"

def plan_chain(task, max_len=3):
    """Propose a chain of exact-fit tools that together cover the task. LLM proposes, code validates."""
    import json, re
    tools = list_registry()
    if not tools:
        return None
    descs = "\n".join(f"- {t['name']}: {t['desc']} Args: {t['full_desc'].split('Args:')[-1].split('Returns:')[0].strip() if 'Args:' in t['full_desc'] else ''}" for t in tools[:12])
    prompt = f"""Decompose this task into 1-{max_len} steps, each using exactly one existing tool. Return JSON {{"steps":[{{"tool":"name","args":{{}}}}]}} or {{"steps":[]}} if not coverable.

Tools:
{descs}

Task: {task}
If a step's args come from prior step output, use {{"__from":"step_0.result"}} style placeholder only if arg name matches.
Return JSON only."""
    try:
        from config import load_registry
        from brain.groq_provider import GroqBrain
        reg = load_registry()
        brain = GroqBrain(reg)
        raw,_ = brain.chat_full("groq-slm", [{"role":"user","content":prompt}])
        m=re.search(r"\{.*\}", raw, re.S)
        if not m: return None
        data=json.loads(m.group(0))
        steps=data.get("steps",[])
        if not steps or len(steps)>max_len: return None
        # validate each step is exact and tool exists
        for s in steps:
            entry = next((t for t in tools if t["name"]==s.get("tool")), None)
            if not entry or score_fit(s.get("tool","")+ " " + task, entry) != "exact":
                # allow exact on original task words, not just tool name
                if score_fit(task, entry) != "exact":
                    return None
        return steps
    except:
        return None

def execute_chain(steps, initial_args=None):
    """Deterministic executor: runs steps in order, validates args, no LLM."""
    from tools.runner import run_tool
    ctx = {"initial": initial_args or {}}
    trace=[]
    last_result=None
    for i, s in enumerate(steps):
        name=s.get("tool")
        raw_args=s.get("args",{})
        # resolve placeholders
        args={}
        for k,v in (raw_args or {}).items():
            if isinstance(v, str) and v.startswith("__from:"):
                # __from:step_0.result
                ref=v.split(":",1)[1]
                parts=ref.split(".")
                src=ctx.get(parts[0],{})
                val=src.get(parts[1]) if len(parts)>1 else src
                args[k]=val
            elif isinstance(v, str) and v=="__from:prev":
                args[k]=last_result
            else:
                # if value is string placeholder like "{{prev}}", resolve
                args[k]=v
        # fill missing from initial_args if arg name matches
        if initial_args:
            for k in list(args.keys()):
                if args[k] is None and k in initial_args:
                    args[k]=initial_args[k]
        # validate all args present (inspect tool signature)
        try:
            import inspect
            from tools.factory import load_tool
            mod=load_tool(name)
            sig=inspect.signature(mod.main)
            missing=[p for p in sig.parameters if p not in args]
            if missing:
                # try to fill from initial_args
                for m in missing[:]:
                    if m in (initial_args or {}):
                        args[m]=initial_args[m]
                        missing.remove(m)
                if missing:
                    return {"ok":False, "error":f"missing args {missing} for {name}", "trace":trace}
        except Exception as e:
            return {"ok":False, "error":str(e), "trace":trace}
        res=run_tool(name, args)
        trace.append(f"{name} {args} -> {res.get('stdout') or res.get('error')}")
        if not res.get("ok"):
            return {"ok":False, "error":res.get("error"), "trace":trace}
        last_result=res.get("result") if res.get("result") is not None else res.get("stdout")
        ctx[f"step_{i}"]={"result":last_result, "args":args}
    return {"ok":True, "result":last_result, "trace":trace}

def load_tool(name):
    """Import and return module for the tool."""
    path = os.path.join(CUSTOM_DIR, f"{name}.py")
    if not os.path.exists(path):
        raise FileNotFoundError(f"tool {name} not found at {path}")
    spec = importlib.util.spec_from_file_location(f"tools.custom.{name}", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

# --- create / list (persistence across restarts) ---

def create_tool(name, code, sample_input=None, created_by="user"):
    """Validate docstring, test (if sample provided), save file, register. Returns status dict."""
    ok, info = validate_tool(code)
    if not ok:
        return {"saved": False, "error": info}
    # skip test if no sample (multi-arg tools would fail with single value)
    if sample_input is None or sample_input == "":
        result = {"ok": True, "skipped": True}
    else:
        result = test_tool(code, sample_input)
        if not result.get("ok"):
            return {"saved": False, "test": result, "error": result.get("error")}
    os.makedirs(CUSTOM_DIR, exist_ok=True)
    path = os.path.join(CUSTOM_DIR, f"{name}.py")
    with open(path, "w", encoding="utf-8") as f:
        f.write(code)
    entry = register_tool(name, code, created_by)
    return {"saved": True, "path": path, "test": result, "entry": entry}


def list_tools():
    """Backwards-compat simple name list (for old callers)."""
    if not os.path.exists(CUSTOM_DIR):
        return []
    return [f[:-3] for f in os.listdir(CUSTOM_DIR) if f.endswith(".py")]
