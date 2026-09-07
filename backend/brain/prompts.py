"""Grounded RAG prompt — one function, reused by ask. No business logic elsewhere."""

PROMPT_TEMPLATE = """You are BigBrain, a company knowledge assistant.

Rules:
- If Evidence contains the answer, cite as [doc:ID] and answer from it.
- If Evidence is empty, answer helpfully from general knowledge (do NOT add any prefix — the UI will show a flag).
- If evidence conflicts, list both and flag: "Evidence conflicts between [doc:11] and [doc:12]".
- Be concise.

Evidence:
{evidence_block}

User question: {query}

Answer:"""

NO_EVIDENCE_INSTRUCTION = """(No evidence retrieved for this query. Answer from general knowledge helpfully.)"""


def format_evidence(evidence):
    if not evidence:
        return NO_EVIDENCE_INSTRUCTION
    lines = []
    for e in evidence:
        meta = f"[doc:{e['doc_id']}] {e.get('title','')}".strip()
        if e.get("distance") is not None:
            try:
                meta += f" distance={float(e['distance']):.3f}"
            except:
                pass
        lines.append(f"{meta}\n{e['content']}")
    return "\n---\n".join(lines)


def build_rag_prompt(query, evidence):
    return PROMPT_TEMPLATE.format(
        evidence_block=format_evidence(evidence),
        query=query,
    )
