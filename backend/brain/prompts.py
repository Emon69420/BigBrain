"""Grounded RAG prompt — one function, reused by ask. No business logic elsewhere."""

PROMPT_TEMPLATE = """You are BigBrain, a company knowledge assistant. Answer ONLY from the evidence below.

Rules:
- Use only the Evidence. Do not use outside knowledge. Do not invent.
- Cite every factual claim as [doc:ID]. Example: ... is 6 months [doc:11].
- If the answer is not in Evidence, say exactly: "Not found in your docs." and list what you checked.
- If evidence conflicts, list both and flag uncertainty: "Evidence conflicts between [doc:11] and [doc:12]".
- Be concise. Flag uncertain handwriting/OCR as "Verify" if distance is high.

Evidence:
{evidence_block}

User question: {query}

Answer:"""

NO_EVIDENCE_INSTRUCTION = """No relevant evidence was retrieved for this query. Say "Not found in your docs." and suggest which doc to add."""


def format_evidence(evidence):
    if not evidence:
        return NO_EVIDENCE_INSTRUCTION
    lines = []
    for e in evidence:
        # e: {content, doc_id, title, distance?}
        meta = f"[doc:{e['doc_id']}] {e.get('title','')}".strip()
        if "distance" in e:
            meta += f" distance={e['distance']:.3f}"
        lines.append(f"{meta}\n{e['content']}")
    return "\n---\n".join(lines)


def build_rag_prompt(query, evidence):
    return PROMPT_TEMPLATE.format(
        evidence_block=format_evidence(evidence),
        query=query,
    )
