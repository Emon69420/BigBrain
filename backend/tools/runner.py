"""Runner switch — restricted Python fallback now, Docker later. Same signature."""
import io
import contextlib


def run_python(code, timeout=10):
    """Run code safely. Docker replaces body later, callers unchanged."""
    # keep blocklist minimal for tool building — real isolation is Docker later
    banned = ["subprocess", "socket", "requests", "urllib.request"]
    for b in banned:
        if b in code:
            return {"ok": False, "error": f"blocked: {b} (needs Docker phase)"}
    buf = io.StringIO()
    try:
        import math
        safe_builtins = {"print": print, "range": range, "len": len,
                         "sum": sum, "min": min, "max": max, "abs": abs, "round": round,
                         "float": float, "int": int, "str": str, "bool": bool, "list": list, "dict": dict,
                         "pow": pow, "divmod": divmod,
                         "Exception": Exception, "ValueError": ValueError, "TypeError": TypeError,
                         "math": math, "__import__": __import__}
        with contextlib.redirect_stdout(buf):
            exec(code, {"__builtins__": safe_builtins})
        return {"ok": True, "stdout": buf.getvalue()}
    except Exception as e:
        return {"ok": False, "error": str(e), "stdout": buf.getvalue()}


def run_tool(name, args=None):
    """Run a persisted tool by name via its def main. Extra kwargs not in signature are dropped (logged)."""
    from tools.factory import load_tool, bump_uses
    mod = load_tool(name)
    if not hasattr(mod, "main"):
        return {"ok": False, "error": f"tool {name} has no def main"}
    try:
        import io, contextlib, inspect
        try:
            sig = inspect.signature(mod.main)
            params = sig.parameters
            has_var_kw = any(p.kind == inspect.Parameter.VAR_KEYWORD for p in params.values())
        except Exception:
            params, has_var_kw = {}, True
        buf = io.StringIO()
        a = args
        dropped = []
        with contextlib.redirect_stdout(buf):
            if a is None:
                res = mod.main()
            elif isinstance(a, dict):
                if not has_var_kw:
                    dropped = [k for k in a if k not in params]
                    a = {k: v for k, v in a.items() if k in params}
                res = mod.main(**a)
            elif isinstance(a, list):
                res = mod.main(*a)
            else:
                res = mod.main(a)
            if res is not None:
                print(res)
        out = buf.getvalue().strip()
        # provenance: a tool that yields nothing (None + empty print) proves nothing
        if res is None and (not out or out == "None"):
            return {"ok": False, "error": f"tool {name} returned no result — untrusted"}
        if dropped:
            import logging as _lg
            _lg.getLogger("bigbrain").info("run_tool %s dropped unexpected args %s", name, dropped)
        bump_uses(name)
        return {"ok": True, "stdout": out, "result": res, "dropped": dropped or None}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def test_tool(code, sample_input=""):
    """Reusable tester — handles single value, list (positional), or dict (keyword)."""
    if sample_input is None or sample_input == "":
        # dry run: just check def main parses; actual call done via run_tool later
        return run_python(code + "\n# dry-run ok")
    if "def main" not in code:
        return run_python(code)
    if isinstance(sample_input, list):
        args = ", ".join(repr(x) for x in sample_input)
        full = code + f"\nprint(main({args}))"
    elif isinstance(sample_input, dict):
        args = ", ".join(f"{k}={repr(v)}" for k, v in sample_input.items())
        full = code + f"\nprint(main({args}))"
    else:
        full = code + "\nprint(main(" + repr(sample_input) + "))"
    return run_python(full)
