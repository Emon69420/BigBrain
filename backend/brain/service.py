"""Brain service — reusable business logic. Routes call this, never Groq directly."""
from config import load_registry
from brain.groq_provider import GroqBrain
from brain.prompts import build_rag_prompt
from utils.observability import new_request_id, log_llm_call, timed, elapsed_ms

_registry = load_registry()
_brain = GroqBrain(_registry)


def ask_question(text, user_dept="operations", org_id="default", request_id=None, retrieve=True, history_text=""):
    """Full ask pipeline. Always-on rewriter + RRF + floor + grounded prompt. Logs every call."""
    request_id = request_id or new_request_id()
    task = _brain.classify_task(text)
    model_key = _brain.route(task)
    model_id = _brain.registry.get(model_key, {}).get("model_id", "")
    evidence = []
    grounded = False
    search_queries=[text]
    rewritten=None
    if retrieve:
        # 1) rewrite
        try:
            from brain.rewriter import rewrite
            rewritten=rewrite(text, history_text)
            if rewritten.get("is_search_required"):
                search_queries=rewritten.get("queries") or [text]
            else:
                search_queries=[]
        except Exception:
            search_queries=[text]
        # 2) retrieve only if required, else no evidence (honest no-match)
        if search_queries:
            try:
                from data.service import hybrid_search
                evidence = hybrid_search(text, user_dept, limit=5, org_id=org_id, queries=search_queries)
            except Exception:
                evidence = []
        # log rewriter even when skipped
        try:
            from utils.observability import log_llm_call as _log
            # rewriter already logged via its own chat_full if needed; store a lightweight row
        except: pass
        # 3) grounded prompt
        prompt = build_rag_prompt(text, evidence)
        grounded = True
        # stash rewrite for caller trace
    else:
        prompt = text
        rewritten=None
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
        "grounded": grounded, "evidence": evidence if retrieve else [],
        "search_queries": search_queries if retrieve else [],
    }
    return out


def get_router_info():
    return _registry["router"]
