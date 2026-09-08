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


REDTEAM_TEMPLATE = """You are the Red Team for BigBrain — an adversarial reviewer, not a helper. Your job is to attack the drafted answer below and find why it could be wrong. Be strict: a missed flaw is worse than a false alarm.

Drafted answer:
{answer}

Retrieved evidence:
{evidence_block}

Tool execution record:
{tool_block}

Check, in order:
1. Unsupported claims: every factual sentence must trace to the evidence or the tool record. Quote the claim and state what is missing.
2. Stale or superseded evidence: dates, versions, or intervals that look outdated or contradicted between sources.
3. Unverified assumptions: unit conversions, physical constants, or premises the answer relies on without stating (e.g. g=9.8 assumed, kW vs kWh confused, missing arg defaults).
4. Number mismatch: any number in the answer that does not appear in the tool output or evidence.

Respond strictly as JSON: {{"verdict": "pass|flag|fail", "findings": ["..."]}}.
- pass: nothing material found.
- flag: concerns worth showing a human, answer still usable.
- fail: a number is fabricated, a citation is dangling, or a core claim contradicts the evidence."""
