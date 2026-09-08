"""Chat thread service — conversations + messages. Per org, per user."""
import json
from data.db import get_conn


def create_conversation(org_id, user_id, title="New chat"):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("INSERT INTO conversations (org_id, user_id, title) VALUES (%s,%s,%s) RETURNING id;", (org_id, user_id, title))
    cid = cur.fetchone()[0]; conn.commit(); cur.close(); conn.close()
    return cid


def rename_conversation(conversation_id, org_id, user_id, title):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("UPDATE conversations SET title=%s WHERE id=%s AND org_id=%s AND user_id=%s RETURNING id;",
                (title.strip()[:80], conversation_id, org_id, user_id))
    row = cur.fetchone(); conn.commit(); cur.close(); conn.close()
    return bool(row)


def list_conversations(org_id, user_id):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT id, title, created_at FROM conversations WHERE org_id=%s AND user_id=%s ORDER BY created_at DESC;", (org_id, user_id))
    rows = cur.fetchall(); cur.close(); conn.close()
    return [{"id": r[0], "title": r[1], "created_at": str(r[2])} for r in rows]


def get_messages(conversation_id, org_id, user_id):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT id FROM conversations WHERE id=%s AND org_id=%s AND user_id=%s;", (conversation_id, org_id, user_id))
    if not cur.fetchone():
        cur.close(); conn.close(); return None
    # handle older DB without new cols
    try:
        cur.execute("SELECT id, role, content, model_key, evidence, request_id, tool_used, tool_trace, judge, created_at FROM messages WHERE conversation_id=%s ORDER BY id;", (conversation_id,))
        rows = cur.fetchall()
        has_extra = True
    except:
        conn.rollback()
        cur.execute("SELECT id, role, content, model_key, evidence, request_id, created_at FROM messages WHERE conversation_id=%s ORDER BY id;", (conversation_id,))
        rows = cur.fetchall()
        has_extra = False
    cur.close(); conn.close()
    out = []
    for r in rows:
        if has_extra:
            ev = None
            try: ev = json.loads(r[4]) if r[4] else []
            except: ev = []
            tu = None
            try: tu = json.loads(r[6]) if r[6] else None
            except: tu = None
            tr = None
            try: tr = json.loads(r[7]) if r[7] else []
            except: tr = []
            ju = None
            try: ju = json.loads(r[8]) if r[8] else None
            except: ju = None
            out.append({"id": r[0], "role": r[1], "content": r[2], "model_key": r[3], "evidence": ev, "request_id": r[5], "tool_used": tu, "tool_trace": tr, "judge": ju, "created_at": str(r[9])})
        else:
            ev = None
            try: ev = json.loads(r[4]) if r[4] else []
            except: ev = []
            out.append({"id": r[0], "role": r[1], "content": r[2], "model_key": r[3], "evidence": ev, "request_id": r[5], "created_at": str(r[6])})
    return out


def add_message(conversation_id, role, content, model_key=None, evidence=None, request_id=None, tool_used=None, tool_trace=None, judge=None):
    conn = get_conn(); cur = conn.cursor()
    ev = json.dumps(evidence or [])
    tu = json.dumps(tool_used) if tool_used is not None else None
    tr = json.dumps(tool_trace or [])
    ju = json.dumps(judge) if judge is not None else None
    try:
        cur.execute("INSERT INTO messages (conversation_id, role, content, model_key, evidence, request_id, tool_used, tool_trace, judge) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id;",
                    (conversation_id, role, content, model_key, ev, request_id, tu, tr, ju))
    except:
        conn.rollback()
        cur.execute("INSERT INTO messages (conversation_id, role, content, model_key, evidence, request_id) VALUES (%s,%s,%s,%s,%s,%s) RETURNING id;",
                    (conversation_id, role, content, model_key, ev, request_id))
    mid = cur.fetchone()[0]; conn.commit(); cur.close(); conn.close()
    return mid
