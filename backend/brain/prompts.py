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


BUILDER_TEMPLATE = """You are a tool builder for BigBrain. Write ONE Python tool that solves the task.

Requirements (strict):
- File MUST start with triple-quoted module docstring on line 1. First line = concise tool desc, then Args/Returns.
  Example:
  \"\"\"Blast load calculator - computes blast pressure on wall
  Args: charge_kg (float), distance_m (float)
  Returns: pressure_kPa (float)
  \"\"\"
- Define def main(...): as entrypoint. Allowed libs only: math. No file/network.
- Do NOT use __import__ or open. Use import math directly.
- Keep it pure, deterministic.

Task: {task}
Sample input (for testing): {sample}

Return ONLY the Python code, no markdown, no explanation, starting with \"\"\" on first character.
"""

def build_builder_prompt(task, sample=""):
    return BUILDER_TEMPLATE.format(task=task, sample=repr(sample) if sample else "none — choose reasonable demo args")

def build_fix_prompt(task, code, error, sample=""):
    return f"""Previous attempt for task: {task}
Failed with error: {error}
Sample: {repr(sample)}

Previous code:
{code}

Fix the code to pass. Keep the same docstring contract and def main. Return ONLY Python code.
"""


def build_rag_prompt(query, evidence):
    return PROMPT_TEMPLATE.format(
        evidence_block=format_evidence(evidence),
        query=query,
    )
