"""Chunking — split docs for RAG. Pure function, easy to test."""


def chunk_text(text, size=500, overlap=50):
    """Split on paragraph/word boundaries. Returns list of chunk strings."""
    text = (text or "").strip()
    if not text:
        return []
    paras, chunks, buf = text.split("\n"), [], ""
    for p in paras:
        p = p.strip()
        if not p:
            continue
        if len(buf) + len(p) + 1 <= size:
            buf = (buf + "\n" + p).strip()
        else:
            if buf:
                chunks.append(buf)
            while len(p) > size:
                chunks.append(p[:size])
                p = p[size - overlap:]
            buf = p
    if buf:
        chunks.append(buf)
    # word-level overlap between neighbours
    out = [chunks[0]] if chunks else []
    for c in chunks[1:]:
        tail = " ".join(out[-1].split()[-10:])
        out.append((tail + " " + c).strip() if tail else c)
    return out


def chunk_hierarchical(text, parent_size=900, parent_overlap=100, child_size=250, child_overlap=30):
    """Split into parents, then children per parent. Returns [(parent_text, [child_texts])].

    Retrieval embeds children (precise); prompts receive the parent (context).
    Old flat chunks are equivalent to childless parents — stitching treats them standalone.
    """
    parents = chunk_text(text, size=parent_size, overlap=parent_overlap)
    out = []
    for p in parents:
        children = chunk_text(p, size=child_size, overlap=child_overlap)
        out.append((p, children if children else [p]))
    return out
