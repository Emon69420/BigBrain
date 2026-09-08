"""Data service — reusable search + ingest. Routes never write SQL directly."""
from data.db import get_conn, check_access
from data.chunking import chunk_text


def _ensure_org(org_id):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("INSERT INTO orgs (id, name) VALUES (%s,%s) ON CONFLICT (id) DO NOTHING;", (org_id, org_id))
    conn.commit(); cur.close(); conn.close()

def save_doc(title, content, dept="operations", doc_class="open", org_id="default"):
    # Use ingest_doc (transactional) internally; kept for compat but now delegates
    return ingest_doc(title, content, org_id, dept, doc_class)


def list_docs(org_id="default"):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, title, dept, class FROM documents WHERE org_id=%s ORDER BY id;", (org_id,))
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [{"id": r[0], "title": r[1], "dept": r[2], "class": r[3]} for r in rows]


def delete_doc(doc_id, org_id):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("DELETE FROM documents WHERE id=%s AND org_id=%s RETURNING id;", (doc_id, org_id))
    row = cur.fetchone(); conn.commit(); cur.close(); conn.close()
    return bool(row)


def search_docs(query, user_dept="operations", limit=5, org_id="default"):
    """Keyword search on title OR content, with org + permission."""
    conn = get_conn()
    cur = conn.cursor()
    pat = f"%{query.strip().replace('%','')}%"
    cur.execute(
        "SELECT id, title, dept, class, content FROM documents"
        " WHERE org_id=%s AND (content ILIKE %s OR title ILIKE %s) LIMIT %s;",
        (org_id, pat, pat, limit),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    out = []
    for _id, title, dept, doc_class, content in rows:
        if check_access(user_dept, dept, doc_class):
            out.append({"id": _id, "title": title, "dept": dept, "class": doc_class, "content": content})
    return out


def _embedding_for(query):
    from data.embeddings import embed_query
    return embed_query(query)

def _fetch_candidates(qvec, org_id, limit):
    conn = get_conn(); cur = conn.cursor()
    # leaves only (parents are context, never retrieval keys); old NULL-level rows count as leaves
    cur.execute(
        """SELECT c.id, c.content, c.doc_id, d.title, d.dept, d.class,
                  (c.embedding <=> %s::vector) AS distance, c.parent_id
           FROM chunks c JOIN documents d ON d.id=c.doc_id
           WHERE c.org_id=%s AND c.embedding IS NOT NULL
             AND (c.chunk_level IS NULL OR c.chunk_level='leaf')
           ORDER BY c.embedding <=> %s::vector LIMIT %s;""",
        (qvec, org_id, qvec, limit),
    )
    rows = cur.fetchall(); cur.close(); conn.close()
    return [{"chunk_id": r[0], "content": r[1], "doc_id": r[2], "title": r[3], "dept": r[4], "class": r[5], "distance": float(r[6]), "parent_id": r[7]} for r in rows]

def _keyword_candidates(query, org_id):
    kws = query.strip().replace("%","")
    toks = [t for t in kws.split() if len(t)>=2][:6]
    if not toks: return []
    conn = get_conn(); cur = conn.cursor()
    # union of title/content ilike per token, per doc
    q = " OR ".join(["(d.title ILIKE %s OR c.content ILIKE %s)"]*len(toks))
    params=[]; 
    for t in toks: params += [f"%{t}%", f"%{t}%"]
    cur.execute(f"""SELECT DISTINCT ON (c.id) c.id, c.content, c.doc_id, d.title, d.dept, d.class, c.parent_id
           FROM chunks c JOIN documents d ON d.id=c.doc_id
           WHERE c.org_id=%s AND (c.chunk_level IS NULL OR c.chunk_level='leaf') AND ({q})
           LIMIT 20;""", (org_id, *params))
    rows = cur.fetchall(); cur.close(); conn.close()
    # mark keyword hits
    return [{"chunk_id": r[0], "content": r[1], "doc_id": r[2], "title": r[3], "dept": r[4], "class": r[5], "distance": None, "keyword_hit": True, "parent_id": r[6]} for r in rows]

def _rrf(lists, k=60):
    # lists: list of ranked id->item lists; fused by reciprocal rank
    scores={}; by_id={}
    for lst in lists:
        for rank, it in enumerate(lst):
            cid=it["chunk_id"]
            by_id[cid]=it
            scores[cid]=scores.get(cid,0)+ 1/(k+rank+1)
    ranked=sorted(scores, key=lambda cid: scores[cid], reverse=True)
    return [by_id[cid] for cid in ranked]

def hybrid_search(query, user_dept="operations", limit=5, org_id="default", queries=None, relevance_floor=0.35):
    """Simple RAG: hybrid RRF + keyword pin, low floor so short queries still find docs."""
    queries = queries or [query]
    # embed each query
    ranked_lists=[]
    for q in queries[:3]:
        try:
            qvec=_embedding_for(q)
            ranked_lists.append(_fetch_candidates(qvec, org_id, 12))
        except Exception:
            continue
    # keyword leg on original + rewritten
    for q in queries[:2]:
        ks=_keyword_candidates(q, org_id)
        if ks: ranked_lists.append(ks)
    if not ranked_lists:
        return search_docs(query, user_dept, limit, org_id)
    fused=_rrf(ranked_lists)
    # keyword pin: best keyword hit to top if not already
    pinned=None
    for it in fused:
        if it.get("keyword_hit"):
            pinned=it; break
    if pinned and fused[0]["chunk_id"]!=pinned["chunk_id"]:
        fused=[pinned]+[x for x in fused if x["chunk_id"]!=pinned["chunk_id"]]
    # filter only by dept — keep top fused regardless of distance (simple working RAG)
    out=[]
    for it in fused:
        if not check_access(user_dept, it["dept"], it["class"]):
            continue
        out.append(it)
        if len(out)>=limit: break
    if not out:
        kws=search_docs(query, user_dept, limit, org_id)
        return [{"content":k.get("content",""), "doc_id":k["id"], "title":k["title"], "dept":k["dept"], "class":k["class"], "distance":None, "keyword_hit":True, "chunk_id":k["id"]} for k in kws]
    return stitch_parents(out)


def stitch_parents(items):
    """Attach parent_content to leaf hits in one query. Parentless leaves pass through untouched."""
    pids = list({it["parent_id"] for it in items if it.get("parent_id")})
    if not pids:
        return items
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT id, content FROM chunks WHERE id = ANY(%s);", (pids,))
    pmap = {r[0]: r[1] for r in cur.fetchall()}
    cur.close(); conn.close()
    for it in items:
        if it.get("parent_id") and it["parent_id"] in pmap:
            it["parent_content"] = pmap[it["parent_id"]]
    return items

def vector_search(query, user_dept="operations", limit=5, org_id="default"):
    return hybrid_search(query, user_dept, limit, org_id, queries=[query])


def ingest_doc(title, content, org_id="default", dept="operations", doc_class="open"):
    """Transactional hierarchical ingest: doc + parents + children in one tx, vectors on leaves only."""
    from data.db import get_conn
    from data.chunking import chunk_hierarchical
    _ensure_org(org_id)
    pairs = chunk_hierarchical(content)
    conn = get_conn(); cur = conn.cursor()
    # 1) doc + parents + null children in one transaction — child always has a parent row
    cur.execute("INSERT INTO documents (title, dept, class, content, org_id) VALUES (%s,%s,%s,%s,%s) RETURNING id;",
                (title, dept, doc_class, content, org_id))
    doc_id = cur.fetchone()[0]
    child_idx, child_texts = [], []
    idx = 0
    for ptext, children in pairs:
        cur.execute("INSERT INTO chunks (org_id, doc_id, chunk_index, content, embedding, parent_id, chunk_level) VALUES (%s,%s,%s,%s,NULL,NULL,'parent') RETURNING id;",
                    (org_id, doc_id, idx, ptext))
        pid = cur.fetchone()[0]
        idx += 1
        for ch in children:
            cur.execute("INSERT INTO chunks (org_id, doc_id, chunk_index, content, embedding, parent_id, chunk_level) VALUES (%s,%s,%s,%s,NULL,%s,'leaf');",
                        (org_id, doc_id, idx, ch, pid))
            child_idx.append(idx)
            child_texts.append(ch)
            idx += 1
    conn.commit()
    if not child_texts:
        cur.close(); conn.close()
        return doc_id
    # 2) embed leaves only — parents are context carriers, never retrieval keys
    try:
        from data.embeddings import embed_texts
        vecs = embed_texts(child_texts)
        for ci, vec in zip(child_idx, vecs):
            cur.execute("UPDATE chunks SET embedding=%s::vector WHERE doc_id=%s AND chunk_index=%s;", (vec, doc_id, ci))
        conn.commit()
    except Exception:
        pass  # NULLs remain, vector_search will use keyword leg
    cur.close(); conn.close()
    return doc_id


def backfill_embeddings(limit=32):
    """Fill NULL embeddings on leaves only (parents stay vectorless by design). Call after warmup."""
    from data.embeddings import embed_texts
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT id, content FROM chunks WHERE embedding IS NULL AND (chunk_level IS NULL OR chunk_level='leaf') LIMIT %s;", (limit,))
    rows = cur.fetchall()
    if not rows: cur.close(); conn.close(); return 0
    ids, texts = zip(*[(r[0], r[1]) for r in rows])
    vecs = embed_texts(list(texts))
    for _id, vec in zip(ids, vecs):
        cur.execute("UPDATE chunks SET embedding=%s::vector WHERE id=%s;", (vec, _id))
    conn.commit(); cur.close(); conn.close()
    return len(ids)
