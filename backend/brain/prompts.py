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
        body = e["content"]
        if e.get("parent_content") and e["parent_content"].strip() != (e["content"] or "").strip():
            body = f"Matched passage: {e['content']}\nSurrounding section: {e['parent_content']}"
        lines.append(f"{meta}\n{body}")
    return "\n---\n".join(lines)


BUILDER_TEMPLATE = """You are a tool builder for BigBrain. Write ONE Python tool that solves the task.

FROZEN INPUTS (single source of truth — use EXACTLY these arg names, no more, no fewer):
{sample}

Requirements (strict):
- File MUST start with triple-quoted module docstring on line 1. First line = concise tool desc, then Args/Returns matching frozen inputs exactly.
  Example:
  \"\"\"Blast load calculator - computes blast pressure on wall
  Args: charge_kg (float), distance_m (float)
  Returns: pressure_kPa (float)
  \"\"\"
- Define def main(...): with EXACT param names from frozen inputs. Do not invent new params, do not rename. If frozen inputs is {{}}, use no args or one generic arg.
- Allowed libs only: math. No file/network. No __import__/open.
- Keep it pure, minimal: solve ONLY what is asked, no drag coefficients or extra physics unless in frozen inputs.

Task: {task}

Return ONLY the Python code, no markdown, no explanation, starting with \"\"\" on first character.
"""

def build_builder_prompt(task, sample=""):
    # sample is the frozen inputs dict from judge — show as JSON for exact arg names
    import json
    frozen = json.dumps(sample, indent=2) if isinstance(sample, dict) and sample else repr(sample) if sample else "{} (no inputs - use minimal args)"
    return BUILDER_TEMPLATE.format(task=task, sample=frozen)

def build_fix_prompt(task, code, error, sample=""):
    import json
    frozen = json.dumps(sample, indent=2) if isinstance(sample, dict) and sample else repr(sample)
    return f"""Previous attempt for task: {task}
Failed with error: {error}
Frozen inputs (MUST match def main params exactly): {frozen}

Previous code:
{code}

Fix: use EXACT param names from frozen inputs, no invented args. Return ONLY Python code.
"""


def build_rag_prompt(query, evidence):
    return PROMPT_TEMPLATE.format(
        evidence_block=format_evidence(evidence),
        query=query,
    )
