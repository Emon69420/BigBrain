"""Brain service — reusable business logic. Routes call this, never Groq directly."""
from config import load_registry
from brain.groq_provider import GroqBrain
from utils.observability import new_request_id, log_llm_call, timed, elapsed_ms

_registry = load_registry()
_brain = GroqBrain(_registry)


def ask_question(text, user_dept="operations", org_id="default", request_id=None, retrieve=False):
    """Full ask pipeline. Returns dict the route sends as JSON. Logs every call."""
    request_id = request_id or new_request_id()
    task = _brain.classify_task(text)
    model_key = _brain.route(task)
    model_id = _brain.registry.get(model_key, {}).get("model_id", "")
    prompt = text
    evidence = []
    if retrieve:
        try:
            from data.service import vector_search
            evidence = vector_search(text, user_dept, limit=5, org_id=org_id)
        except Exception:
            evidence = []
    t0 = timed()
    try:
        answer, usage = _brain.chat_full(model_key, [{"role": "user", "content": prompt}])
        latency = elapsed_ms(t0)
        log_llm_call(request_id, org_id, user_dept, task, model_key, model_id,
                     prompt, answer, usage, latency)
    except Exception as e:
        latency = elapsed_ms(t0)
        err = str(e)
        log_llm_call(request_id, org_id, user_dept, task, model_key, model_id,
                     prompt, None, None, latency, error=err)
        raise
    out = {
        "task": task, "model": model_key, "model_id": model_id,
        "answer": answer, "mode": "harness-groq+localpg",
        "request_id": request_id, "org_id": org_id,
    }
    if retrieve:
        out["evidence"] = evidence
    return out


def get_router_info():
    return _registry["router"]
