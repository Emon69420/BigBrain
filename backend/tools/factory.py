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

def find_exact(task_text):
    """Hit ONLY if score_fit == exact. Partial/none never execute. Single source of truth for reuse."""
    hit = find_tool(task_text)
    if hit and score_fit(task_text, hit) == "exact":
        return hit
    return None

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

def map_args_by_unit(query_text, expected_params):
    """Map numbers in query to tool params via unit tags. Returns dict (maybe partial). Pure + deterministic."""
    import re
    unit_tags = {
        "m/s": {"velocity", "speed"}, "km/h": {"velocity", "speed"}, "mph": {"velocity", "speed"},
        "m": {"height", "distance", "length", "radius", "altitude"}, "km": {"distance", "length"},
        "cm": {"length"}, "mm": {"length"}, "ft": {"height", "distance", "length"},
        "metre": {"height", "distance", "length"}, "meter": {"height", "distance", "length"},
        "mile": {"distance"}, "m3": {"volume", "litres"},
        "kg": {"mass", "weight"}, "gram": {"mass", "weight"}, "tonne": {"mass"}, "ton": {"mass"}, "lb": {"mass", "weight"},
        "N": {"force"}, "newton": {"force"},
        "W": {"power"}, "kW": {"power"}, "watt": {"power"}, "kilowatt": {"power"},
        "Wh": {"energy"}, "kWh": {"energy", "capacity", "battery"}, "J": {"energy", "joule"}, "joule": {"energy"},
        "degree": {"temp", "temperature", "celsius"}, "celsius": {"temp", "temperature"},
        "second": {"time", "duration"}, "sec": {"time"}, "minute": {"time", "duration"}, "min": {"time"},
        "hour": {"time"}, "litre": {"volume", "litres"}, "liter": {"volume", "litres"},
        "volt": {"voltage"}, "amp": {"current"}, "ohm": {"resistance"},
        "kg": {"mass", "weight"}, "g": {"mass", "weight"}, "n": {"force"},
        "w": {"power"}, "j": {"energy"}, "c": {"temp", "temperature", "celsius"},
        "v": {"voltage"}, "a": {"current"}, "m": {"height", "distance", "length"}, "s": {"time"},
    }
    pat = r"(\d+(?:\.\d+)?)\s*(m/s|km/h|mph|kilowatt-hours?|kilowatts?|watt-hours?|watts?|kWh|Wh|kW|joules?|degrees?|celsius|kilograms?|grams?|newtons?|seconds?|secs?|sec|minutes?|mins?|min|hours?|metres?|meters?|kilometres?|kilometers?|litres?|liters?|volts?|amps?|ohms?|m3|kg|N|W|J|C|V|A|m|s)\b"
    pairs = [(float(n), u) for n, u in re.findall(pat, query_text)]
    bare = [float(n) for n in re.findall(r"\d+(?:\.\d+)?", query_text)]
    # remove paired numbers from bare list (match by value)
    bare_left = list(bare)
    for n, u in pairs:
        if n in bare_left:
            bare_left.remove(n)
    def toks(s):
        return set(re.findall(r"[a-z0-9]+", str(s).lower()))
    args = {}
    used_pairs = set()
    for exp in (expected_params or []):
        et = toks(exp)
        best, best_s = None, 0
        for i, (n, u) in enumerate(pairs):
            if i in used_pairs:
                continue
            tags = set(unit_tags.get(u, unit_tags.get(u.lower(), set())))
            ut = toks(u) | tags
            inter = len(et & ut)
            if inter > best_s:
                best_s, best = inter, i
        if best is not None and best_s >= 1:
            args[exp] = pairs[best][0]
            used_pairs.add(best)
    # bare numbers fill remaining params in order
    remaining = [e for e in (expected_params or []) if e not in args]
    for exp, val in zip(remaining, bare_left):
        args[exp] = val
    return args


def find_twin(name):
    """Save-time dedup: if new entry is an exact twin (desc + arg set) of another, return the twin."""
    import re
    data = _load_registry()
    new = next((t for t in data["tools"] if t["name"] == name), None)
    if not new:
        return None
    def argset(full):
        m = re.search(r"Args:(.*?)(Returns:|$)", full or "", re.S | re.I)
        if not m:
            return set()
        return set(re.findall(r"[a-z_][a-z0-9_]*", m.group(1).lower())) - {"float", "int", "str", "list", "dict", "or"}
    new_args = argset(new.get("full_desc", ""))
    for t in data["tools"]:
        if t["name"] == name:
            continue
        if score_fit(new.get("desc", ""), t) == "exact" and argset(t.get("full_desc", "")) == new_args and new_args:
            return t
    return None


def extract_inputs(query_text):
    """Deterministic fallback: numbers+units -> {name: value}. Used when judge emits empty inputs."""
    import re
    unit_first_tag = {
        "m/s": "velocity_m_s", "km/h": "velocity_km_h", "mph": "velocity_mph",
        "m": "distance_m", "km": "distance_km", "cm": "length_cm", "mm": "length_mm", "ft": "height_ft",
        "metre": "distance_m", "meter": "distance_m", "mile": "distance_miles", "m3": "volume_m3",
        "kg": "mass_kg", "gram": "mass_g", "tonne": "mass_t", "ton": "mass_t", "lb": "mass_lb",
        "N": "force_N", "newton": "force_N",
        "W": "power_W", "kW": "power_kW", "watt": "power_W", "kilowatt": "power_kW",
        "Wh": "energy_Wh", "kWh": "energy_kWh", "J": "energy_J", "joule": "energy_J",
        "degree": "temp_change_C", "celsius": "temp_C",
        "second": "time_s", "sec": "time_s", "minute": "time_min", "min": "time_min", "hour": "time_h",
        "litre": "volume_L", "liter": "volume_L", "volt": "voltage_V", "amp": "current_A", "ohm": "resistance_ohm",
        "km": "distance_km", "kg": "mass_kg", "g": "mass_g", "m": "distance_m", "s": "time_s",
    }
    pat = r"(\d+(?:\.\d+)?)\s*(m/s|km/h|km|mph|kilowatt-hours?|kilowatts?|watt-hours?|watts?|kWh|Wh|kW|joules?|degrees?|celsius|kilograms?|grams?|newtons?|seconds?|secs?|sec|minutes?|mins?|min|hours?|metres?|meters?|kilometres?|kilometers?|litres?|liters?|volts?|amps?|ohms?|m3|kg|[NWMJVAgsm])\b"
    out = {}
    used = set()
    for n, u in re.findall(pat, query_text):
        base = unit_first_tag.get(u, unit_first_tag.get(u.lower(), unit_first_tag.get(u.lower().rstrip("s"), unit_first_tag.get({"kwh": "energy_kWh", "wh": "energy_Wh", "kw": "power_kW"}.get(u.lower(), None)))))
        if not base:
            continue
        name = base
        i = 2
        while name in out:
            name = f"{base}_{i}"
            i += 1
        out[name] = float(n)
        used.add(float(n))
    # bare numbers left over -> value_N in order (mask paired spans + lone m3 so its 3 isn't counted)
    masked = list(query_text)
    for _m in re.finditer(pat, query_text):
        for _i in range(_m.start(), _m.end()):
            masked[_i] = " "
    masked_txt = "".join(masked)
    masked_txt = re.sub(r"\bm3\b", "   ", masked_txt)
    left = [float(n) for n in re.findall(r"\d+(?:\.\d+)?", masked_txt)]
    k = 1
    for v in left:
        while f"value_{k}" in out:
            k += 1
        out[f"value_{k}"] = v
        k += 1
    return out


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
