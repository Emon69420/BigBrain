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
