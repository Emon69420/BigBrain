"""Brain service — reusable business logic. Routes call this, never Groq directly."""
from config import load_registry
from brain.groq_provider import GroqBrain

_registry = load_registry()
_brain = GroqBrain(_registry)


def ask_question(text, user_dept="operations"):
    """Full ask pipeline. Returns dict the route sends as JSON."""
    task = _brain.classify_task(text)
    model_key = _brain.route(task)
    answer = _brain.chat(model_key, [{"role": "user", "content": text}])
    return {
        "task": task,
        "model": model_key,
        "answer": answer,
        "mode": "harness-groq+localpg",
    }


def get_router_info():
    return _registry["router"]
