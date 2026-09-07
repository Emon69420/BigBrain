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
    stop = {"calculate","compute","computing","using","across","from","with","for","and","the"}
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
