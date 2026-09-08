"""Graph data — documents as nodes, shared equipment tags as edges. Pure + org-scoped."""
import re

# equipment / line / instrument tags: P-204, L-204A, V-17, PT-204 (not SOP/DOC ids)
TAG_RE = re.compile(r"\b([A-Z]{1,3}-?\d{1,4}[A-Z]?)\b")
_TAG_STOP = {"SOP", "DOC", "PDF", "XLSX", "DOCX", "PPTX", "API", "URL", "ID"}


def extract_tags(text):
    """Equipment tags from text. Sorted, deduped."""
    found = set()
    for m in TAG_RE.finditer(text or ""):
        tag = m.group(1)
        prefix = tag.split("-")[0] if "-" in tag else "".join(ch for ch in tag if ch.isalpha())
        if prefix in _TAG_STOP:
            continue
        if not any(ch.isdigit() for ch in tag):
            continue
        found.add(tag)
    return sorted(found)


def get_graph(org_id="default", user_dept="operations"):
    """Nodes = docs (id, title, dept, class, chunks, tags). Edges = shared tags (thickness = count)."""
    from data.db import get_conn, check_access
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, title, dept, class, content FROM documents WHERE org_id=%s ORDER BY id;", (org_id,))
    docs = cur.fetchall()
    cur.execute("SELECT doc_id, COUNT(*) FROM chunks WHERE org_id=%s GROUP BY doc_id;", (org_id,))
    counts = dict(cur.fetchall())
    cur.close()
    conn.close()
    nodes = []
    by_id = {}
    for _id, title, dept, doc_class, content in docs:
        if not check_access(user_dept, dept, doc_class):
            continue
        tags = extract_tags(f"{title}\n{content or ''}")
        node = {"id": _id, "title": title, "dept": dept, "class": doc_class,
                "chunks": counts.get(_id, 0), "tags": tags}
        nodes.append(node)
        by_id[_id] = node
    edges = []
    ids = list(by_id.keys())
    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            a, b = by_id[ids[i]], by_id[ids[j]]
            shared = sorted(set(a["tags"]) & set(b["tags"]))
            if shared:
                edges.append({"a": a["id"], "b": b["id"], "tags": shared, "weight": len(shared)})
    return {"nodes": nodes, "edges": edges}
