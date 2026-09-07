"""Data service — reusable search logic. Routes call this, never SQL directly."""
from data.db import get_conn, check_access


def search_docs(query, user_dept="operations", limit=5):
    """Keyword search with permission filter. Vector search plugs in later."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, title, dept, class, content FROM documents WHERE content ILIKE %s LIMIT %s;",
        (f"%{query}%", limit),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    out = []
    for _id, title, dept, doc_class, content in rows:
        if check_access(user_dept, dept, doc_class):
            out.append({"id": _id, "title": title, "dept": dept})
    return out


def save_doc(title, content, dept="operations", doc_class="open"):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO documents (title, dept, class, content) VALUES (%s, %s, %s, %s) RETURNING id;",
        (title, dept, doc_class, content),
    )
    new_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return new_id
