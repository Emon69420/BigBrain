"""Runner switch — restricted Python fallback now, Docker later. Same signature."""
import io
import contextlib


def run_python(code, timeout=10):
    """Run code safely. Docker replaces body later, callers unchanged."""
    banned = ["os.", "sys.", "subprocess", "socket", "open(", "__import__",
              "requests", "urllib"]
    for b in banned:
        if b in code:
            return {"ok": False, "error": f"blocked: {b} (needs Docker phase)"}
    buf = io.StringIO()
    try:
        safe_builtins = {"print": print, "range": range, "len": len,
                         "sum": sum, "min": min, "max": max}
        with contextlib.redirect_stdout(buf):
            exec(code, {"__builtins__": safe_builtins})
        return {"ok": True, "stdout": buf.getvalue()}
    except Exception as e:
        return {"ok": False, "error": str(e), "stdout": buf.getvalue()}


def test_tool(code, sample_input=""):
    """Reusable tester for Tool Factory — runs tool with sample data."""
    full = code + "\nprint(main(" + repr(sample_input) + "))" if "def main" in code else code
    return run_python(full)
