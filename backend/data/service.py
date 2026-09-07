"""Data service — reusable search + ingest. Routes never write SQL directly."""
from data.db import get_conn, check_access
from data.chunking import chunk_text


def _ensure_org(org_id):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("INSERT INTO orgs (id, name) VALUES (%s,%s) ON CONFLICT (id) DO NOTHING;", (org_id, org_id))
    conn.commit(); cur.close(); conn.close()

def save_doc(title, content, dept="operations", doc_class="open", org_id="default"):
    _ensure_org(org_id)
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO documents (title, dept, class, content, org_id)"
        " VALUES (%s,%s,%s,%s,%s) RETURNING id;",
        (title, dept, doc_class, content, org_id),
    )
    new_id = cur.fetchone()[0]
    conn.commit()
    cur.close()
    conn.close()
    return new_id


def list_docs(org_id="default"):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, title, dept, class FROM documents WHERE org_id=%s ORDER BY id;", (org_id,))
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [{"id": r[0], "title": r[1], "dept": r[2], "class": r[3]} for r in rows]


def search_docs(query, user_dept="operations", limit=5, org_id="default"):
    """Keyword search (fast, no embeddings) with org + permission filter."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT id, title, dept, class, content FROM documents"
        " WHERE org_id=%s AND content ILIKE %s LIMIT %s;",
        (org_id, f"%{query}%", limit),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    out = []
    for _id, title, dept, doc_class, content in rows:
        if check_access(user_dept, dept, doc_class):
            out.append({"id": _id, "title": title, "dept": dept, "class": doc_class})
    return out


# --- Vector RAG ---

def vector_search(query, user_dept="operations", limit=5, org_id="default"):
    """Vector search with org + permission. Falls back to keyword if embeddings unavailable."""
    try:
        from data.embeddings import embed_query
        qvec = embed_query(query)
    except Exception:
        return search_docs(query, user_dept, limit, org_id)
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """SELECT c.content, c.doc_id, d.title, d.dept, d.class,
                  (c.embedding <=> %s::vector) AS distance
           FROM chunks c JOIN documents d ON d.id=c.doc_id
           WHERE c.org_id=%s ORDER BY c.embedding <=> %s::vector LIMIT %s;""",
        (qvec, org_id, qvec, limit),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    out = []
    for content, doc_id, title, dept, doc_class, dist in rows:
        if check_access(user_dept, dept, doc_class):
            out.append({"content": content, "doc_id": doc_id, "title": title, "dept": dept, "class": doc_class, "distance": float(dist)})
    return out


def ingest_doc(title, content, org_id="default", dept="operations", doc_class="open"):
    """Save doc + chunk + embed. Called by POST /docs. Fast even without cached model (null vectors)."""
    doc_id = save_doc(title, content, dept, doc_class, org_id)
    chunks = chunk_text(content)
    if not chunks:
        return doc_id
    try:
        from data.embeddings import embed_texts
        vecs = embed_texts(chunks)
    except Exception as e:
        # Not cached yet or load failed — store null vectors, keyword search still works
        vecs = [None] * len(chunks)
    conn = get_conn()
    cur = conn.cursor()
    for i, (ch, vec) in enumerate(zip(chunks, vecs)):
        if vec is not None:
            cur.execute(
                "INSERT INTO chunks (org_id, doc_id, chunk_index, content, embedding)"
                " VALUES (%s,%s,%s,%s,%s::vector);",
                (org_id, doc_id, i, ch, vec),
            )
        else:
            cur.execute(
                "INSERT INTO chunks (org_id, doc_id, chunk_index, content, embedding)"
                " VALUES (%s,%s,%s,%s,NULL);",
                (org_id, doc_id, i, ch),
            )
    conn.commit()
    cur.close()
    conn.close()
    return doc_id
