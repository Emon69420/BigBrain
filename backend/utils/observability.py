"""Observability — logs every LLM call + response. Reused by all services."""
import logging
import time
import uuid

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("bigbrain")


def new_request_id():
    return uuid.uuid4().hex[:12]


def log_llm_call(request_id, org_id, user_dept, task, model_key, model_id,
                 prompt, response, usage, latency_ms, error=None):
    """Write one row to llm_calls. Never raises — logging must not break answers."""
    try:
        from data.db import get_conn
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO llm_calls
               (request_id, org_id, user_dept, task_type, complexity,
                model_key, model_id, prompt, response,
                prompt_tokens, completion_tokens, latency_ms, error)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s);""",
            (request_id, org_id, user_dept,
             (task or {}).get("task_type"), (task or {}).get("complexity"),
             model_key, model_id, prompt, response,
             (usage or {}).get("prompt_tokens"), (usage or {}).get("completion_tokens"),
             latency_ms, error),
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        log.warning("observability write failed req=%s: %s", request_id, e)
    log.info("llm req=%s org=%s model=%s task=%s latency_ms=%s %s",
             request_id, org_id, model_key, (task or {}).get("task_type"),
             latency_ms, ("ERROR " + error) if error else "ok")


def timed():
    return time.perf_counter()


def elapsed_ms(start):
    return int((time.perf_counter() - start) * 1000)
