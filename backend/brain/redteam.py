"""Red Team — adversarial review of a drafted answer BEFORE it finalizes.

Two layers, cheap first:
1. deterministic_checks (pure Python, zero Groq cost): citation IDs exist,
   every cited number traces to tool stdout or quoted evidence, errored tools
   must not be cited.
2. llm_review (120b, only if deterministic passes): unsupported claims,
   stale/superseded evidence, unverified assumptions.

verdict: pass | flag | fail. Flag-and-deliver: a fail triggers ONE bounded
regenerate with findings injected, then delivers flagged. Never loops.
"""
import json
import re

NUM_RE = re.compile(r"-?\d[\d,]*\.?\d*\s?%?")
_FW_OPEN = chr(0x3010)
_FW_CLOSE = chr(0x3011)
CITE_RE = re.compile(
    r"\[(doc|tool):([^\]]+)\]"
    r"|" + _FW_OPEN + r"(doc|tool):([^" + _FW_CLOSE + r"]+)" + _FW_CLOSE
)
# Matches ASCII [doc:17] and fullwidth [doc:17] (U+3010/U+3011, which LLMs emit).
# Fullwidth chars are built with chr() so the source stays pure ASCII.
TAG_RE = re.compile(r"\b[A-Z]{1,4}[-‐‑]?\d+[A-Z]?\b")  # equipment tags (P-204, L-204A): IDs, not claims
HEDGE_RE = re.compile(r"roughly|about|~|≈|approximately|around|almost|nearly|close to|up to|or so", re.I)


def _norm(text):
    """Normalize unicode that fragments number tokenization.
    U+202F/U+00A0 between digits are thousand separators -> removed.
    U+2010/U+2011 hyphens -> ASCII hyphen (equipment tags like P-204)."""
    t = text or ""
    t = re.sub("(?<=\\d)[  ](?=\\d)", "", t)
    t = t.replace("‑", "-").replace("‐", "-").replace(" ", " ")
    return t


def _numbers(text):
    vals = []
    for m in NUM_RE.finditer(text or ""):
        raw = m.group(0).strip().rstrip("%").replace(",", "")
        try:
            vals.append(float(raw))
        except ValueError:
            continue
    return vals


def _citations(text):
    # alternation puts ASCII refs in groups 1-2, fullwidth refs in groups 3-4
    return [((m.group(1) or m.group(3)), (m.group(2) or m.group(4))) for m in CITE_RE.finditer(text or "")]


def deterministic_checks(answer, evidence, tool_used, question=""):
    """Returns {verdict, findings}. No LLM calls."""
    findings = []
    evidence = evidence or []
    doc_ids = {str(e.get("doc_id")) for e in evidence}
    tool_names = {str(e.get("doc_id")) for e in evidence if e.get("tool")}
    if isinstance(tool_used, dict) and tool_used.get("name") and not tool_used.get("error"):
        for part in str(tool_used["name"]).split(" -> "):
            tool_names.add(part.strip())

    for kind, ref in _citations(answer):
        if kind == "doc" and ref not in doc_ids:
            findings.append(f"citation [doc:{ref}] has no matching evidence — dangling citation")
        if kind == "tool" and ref not in tool_names:
            findings.append(f"citation [tool:{ref}] has no executed tool behind it — unverified number")

    if isinstance(tool_used, dict) and tool_used.get("error") and _citations(answer):
        findings.append(f"tool {tool_used.get('name')} errored but answer still cites sources — numbers unexecuted")

    # number provenance: every multi-digit answer number must appear in tool output or evidence text.
    # Excluded (not claims): citation markers ([doc:17]), equipment tags (P-204),
    # and numbers the user supplied in the question itself.
    # All texts are unicode-normalized first so U+202F thousand groups (11 320)
    # tokenize as single numbers instead of phantom fragments (11, 320).
    answer_norm = _norm(answer)
    answer_claims = TAG_RE.sub("", CITE_RE.sub("", answer_norm))
    question_nums = set(_numbers(_norm(question)))
    sources_text = _norm(" ".join(
        [str((tool_used or {}).get("result") or "")] +
        [str(e.get("content") or "") for e in evidence]
    ))
    source_nums = _numbers(sources_text)

    def _span_around(m):
        s = max(0, m.start() - 40)
        e = min(len(answer_claims), m.end() + 20)
        return answer_claims[s:e].strip()

    for m in NUM_RE.finditer(answer_claims):
        try:
            n = float(m.group(0).strip().rstrip("%").replace(",", ""))
        except ValueError:
            continue
        if abs(n) < 10:
            continue  # single digits (counts, list indices) are noise, not claims
        if any(abs(n - q) <= max(1e-6, abs(q) * 1e-6) for q in question_nums):
            continue  # user-supplied entity, not a model claim
        # hedge-aware tolerance: hedged approximations ("about 11320", "≈11 321")
        # match within 2%; exact claims keep 1e-6 tolerance.
        window = answer_claims[max(0, m.start() - 30):m.start()]
        hedged = bool(HEDGE_RE.search(window))
        def _close(a, b):
            tol = 0.02 * max(1.0, abs(b)) if hedged else max(1e-6, abs(b) * 1e-6)
            return abs(a - b) <= tol
        if not any(_close(n, s) for s in source_nums):
            findings.append(f"number {n:g} (\"{_span_around(m)}\") traces to no tool output or evidence — possibly guessed")

    if findings:
        return {"verdict": "fail", "findings": findings}
    return {"verdict": "pass", "findings": []}


def _tool_contract(tool_used):
    """Human-readable tool record: execution result PLUS the tool's own contract
    (name/desc/Args), so the reviewer can verify units instead of guessing."""
    if not isinstance(tool_used, dict) or not tool_used.get("name"):
        return "(no tool used)"
    lines = [f"Executed tool: {tool_used.get('name')}", f"Result: {tool_used.get('result')}"]
    try:
        from tools.factory import list_registry
        for t in list_registry():
            if t.get("name") == tool_used.get("name"):
                lines.append(f"Contract desc: {t.get('desc','')}")
                full = t.get("full_desc", "") or ""
                if full:
                    lines.append(f"Contract details: {full[:400]}")
                break
    except Exception:
        pass
    return "\n".join(lines)


STYLE_PAT = re.compile(r"styl|format|citation style|wording|minor mismatch", re.I)


def llm_review(answer, evidence, tool_used, org_id="default"):
    """120b adversarial pass. Returns {verdict, findings, request_id}. Fail-open on infra error."""
    from config import load_registry
    from brain.groq_provider import GroqBrain
    from brain.prompts import REDTEAM_TEMPLATE
    from utils.observability import log_llm_call, new_request_id, timed, elapsed_ms
    reg = load_registry()
    brain = GroqBrain(reg)
    ev_block = "\n---\n".join(
        f"[doc:{e.get('doc_id')}] {e.get('title','')}\n{e.get('content','')[:600]}" for e in (evidence or [])
    ) or "(no evidence)"
    tool_block = _tool_contract(tool_used)
    prompt = REDTEAM_TEMPLATE.format(answer=answer, evidence_block=ev_block, tool_block=tool_block)
    req_id = new_request_id()
    t0 = timed()
    try:
        raw, usage = brain.chat_full("groq-llm", [{"role": "user", "content": prompt}], temperature=0)
        latency = elapsed_ms(t0)
        m = re.search(r"\{.*\}", raw, re.S)
        data = json.loads(m.group(0)) if m else {}
        verdict = data.get("verdict", "flag")
        if verdict not in ("pass", "flag", "fail"):
            verdict = "flag"
        findings = data.get("findings", []) or []
        # calibration fuse: style-only complaints can never force a fail + regenerate
        if verdict == "fail" and findings and all(STYLE_PAT.search(str(f)) for f in findings):
            verdict = "flag"
        log_llm_call(req_id, org_id, "red-team", {"task_type": "red_team", "complexity": "high"},
                     "groq-llm", brain.registry.get("groq-llm", {}).get("model_id", ""),
                     prompt, raw, usage, latency)
        import logging
        logging.getLogger("bigbrain").info("redteam req=%s verdict=%s findings=%d", req_id, verdict, len(findings))
        return {"verdict": verdict, "findings": findings, "request_id": req_id}
    except Exception as e:
        latency = elapsed_ms(t0)
        try:
            log_llm_call(req_id, org_id, "red-team", {"task_type": "red_team", "complexity": "high"},
                         "groq-llm", "", prompt, None, None, latency, error=str(e))
        except Exception:
            pass
        return {"verdict": "flag", "findings": [f"red-team LLM unavailable, treating as needs-review: {e}"], "request_id": req_id}


def _needs_review(answer, evidence, tool_used, decision):
    """Skip the LLM pass when there's nothing risky to check."""
    if decision == "general":
        return False
    if tool_used:
        return True
    if _numbers(answer):
        return True
    return bool(_citations(answer))


def review(answer, evidence, tool_used, decision, org_id="default", question=""):
    """Full review. Returns {verdict, findings}. Never raises."""
    try:
        det = deterministic_checks(answer, evidence, tool_used, question)
        if det["verdict"] == "fail":
            return det
        if not _needs_review(answer, evidence, tool_used, decision):
            return {"verdict": "pass", "findings": []}
        return llm_review(answer, evidence, tool_used, org_id)
    except Exception as e:
        return {"verdict": "flag", "findings": [f"red-team harness error, needs human review: {e}"]}
