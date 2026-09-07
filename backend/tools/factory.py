"""Tool Factory service — creates + tests + saves tools. Reused by route."""
import os
from tools.runner import test_tool

REGISTRY_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "models", "tool_registry.yaml")
CUSTOM_DIR = os.path.join(os.path.dirname(__file__), "custom")


def create_tool(name, code, sample_input=""):
    """Test code, save if it passes. Returns status dict."""
    result = test_tool(code, sample_input)
    if not result.get("ok"):
        return {"saved": False, "test": result}
    os.makedirs(CUSTOM_DIR, exist_ok=True)
    path = os.path.join(CUSTOM_DIR, f"{name}.py")
    with open(path, "w") as f:
        f.write(code)
    return {"saved": True, "path": path, "test": result}


def list_tools():
    if not os.path.exists(CUSTOM_DIR):
        return []
    return [f[:-3] for f in os.listdir(CUSTOM_DIR) if f.endswith(".py")]
