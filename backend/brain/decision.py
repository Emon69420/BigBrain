"""Decision DNA — one persisted record per answer: what was decided, on what
evidence, with which model and tools, and what the Red Team said.

Join keys: request_id links to llm_calls + messages (which carry conversation_id).
Fail-open everywhere: recording must never break answering.
"""
import json
import uuid


def _new_id():
    return "D-" + uuid.uuid4().hex[:6]


def _as_json(value, default):
    try:
        return json.dumps(value if value is not None else default)
    except Exception:
        return json.dumps(default)


def record_decision(request_id, org_id, question, task, model_key, model_id,
                    evidence, tool_used, redteam, judge):
    """Persist one Decision DNA row. Returns decision id or None (never raises)."""
    try:
        from data.db import get_conn
        task_type = task.get("task_type", "") if isinstance(task, dict) else str(task or "")
        conn = get_conn()
        cur = conn.cursor()
        did = _new_id()
        cur.execute(
            """INSERT INTO decisions
               (id, request_id, org_id, question, task_type, model_key, model_id,
                evidence, tool_used, redteam, judge)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
               ON CONFLICT (request_id) DO NOTHING RETURNING id;""",
            (did, request_id, org_id or "default", (question or "")[:2000], task_type,
             model_key or "", model_id or "",
             _as_json(evidence, []), _as_json(tool_used, {}),
             _as_json(redteam, {}), _as_json(judge, {})),
        )
        row = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        return row[0] if row else did
    except Exception as e:
        import logging
        logging.getLogger("bigbrain").warning("decision record failed (non-fatal): %s", e)
        return None


def _parse_row(r):
    def _j(v, default):
        try:
            return json.loads(v) if v else default
        except Exception:
            return default
    return {
        "id": r[0], "request_id": r[1], "org_id": r[2],
        "created_at": str(r[3]), "question": r[4], "task_type": r[5],
        "model_key": r[6], "model_id": r[7],
        "evidence": _j(r[8], []), "tool_used": _j(r[9], {}),
        "redteam": _j(r[10], {}), "judge": _j(r[11], {}),
    }


def get_by_request(request_id, org_id):
    """Full Decision DNA for one answer. Returns dict or None."""
    try:
        from data.db import get_conn
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            """SELECT id, request_id, org_id, created_at, question, task_type,
                      model_key, model_id, evidence, tool_used, redteam, judge
               FROM decisions WHERE request_id=%s AND org_id=%s;""",
            (request_id, org_id or "default"),
        )
        row = cur.fetchone()
        cur.close()
        conn.close()
        return _parse_row(row) if row else None
    except Exception:
        return None


def list_by_conversation(conversation_id, org_id, user_id=None):
    """Decision DNA trail for a thread, newest last. Joins messages.request_id."""
    try:
        from data.db import get_conn
        conn = get_conn()
        cur = conn.cursor()
        if user_id is not None:
            cur.execute("SELECT id FROM conversations WHERE id=%s AND org_id=%s AND user_id=%s;",
                        (conversation_id, org_id or "default", user_id))
            if not cur.fetchone():
                cur.close()
                conn.close()
                return None
        cur.execute(
            """SELECT d.id, d.request_id, d.org_id, d.created_at, d.question, d.task_type,
                      d.model_key, d.model_id, d.evidence, d.tool_used, d.redteam, d.judge
               FROM decisions d
               JOIN messages m ON m.request_id = d.request_id
              WHERE m.conversation_id=%s AND d.org_id=%s
              ORDER BY d.created_at;""",
            (conversation_id, org_id or "default"),
        )
        rows = [_parse_row(r) for r in cur.fetchall()]
        cur.close()
        conn.close()
        return rows
    except Exception:
        return []
