"""Dashboard-Maker builder intents — deterministic pre-check for ask_question.

Handles the conversational loop: propose (create draft) -> iterate
(add/remove/rename on the draft) -> finalize (draft -> live). Template
replies only: no factual claims, no LLM call. Returns None when the text
is not a builder turn so the normal pipeline continues.
"""
import re

BOARD_WORD = r"(?:dashboard|board)"

KNOWN_UNITS = {
    "bar", "psi", "kpa", "mpa", "pa", "kl", "l", "ml", "litre", "litres",
    "liter", "liters", "gallon", "gallons", "kg", "g", "tonne", "tonnes",
    "ton", "tons", "t", "%", "percent", "ppm", "c", "f", "mm", "cm", "m",
    "km", "rpm", "hz", "v", "a", "kw", "kwh", "m3",
}

TEXT_HINT = re.compile(r"status|remark|note|name|shift|operator|incharge|vendor", re.I)
ZONE_RE = re.compile(r"\bzone\s+[a-z0-9]+\b", re.I)


def _strip_unit(phrase):
    """Split 'pipe pressure in bar' -> ('pipe pressure', 'bar')."""
    m = re.search(r"(?:\bin\s+|\()\s*([a-zA-Z%°]+)\s*\)?\s*$", phrase)
    if m and m.group(1).lower() in KNOWN_UNITS:
        return phrase[:m.start()].strip(" ()"), m.group(1)
    return phrase.strip(" ()"), ""


def extract_metrics(text):
    """Pull candidate metric phrases after with/tracking/for/including."""
    m = re.search(
        r"(?:with|tracking|tracks?|for|including|metrics?\s*:|to\s+track)\s+(.+)$",
        text, re.I | re.S)
    if not m:
        return []
    chunk = m.group(1).strip().rstrip(".")
    parts = re.split(r"\s*(?:,|;|\band\b|\+|&|\bplus\b)\s*", chunk)
    out = []
    for p in parts:
        p = re.sub(r"^(?:the|a|an)\s+", "", p.strip(), flags=re.I)
        if not p or len(p) > 60:
            continue
        label, unit = _strip_unit(p)
        if not label:
            continue
        label = label[0].upper() + label[1:]
        kind = "text" if TEXT_HINT.search(label) else "number"
        out.append({"label": label, "unit": unit, "kind": kind})
    return out


def extract_name(text):
    """Board name from 'dashboard for X' / 'X dashboard' / quoted '...'."""
    m = re.search(r"dashboard\s+for\s+([\"']?)([\w\s\-]+?)\1\s*(?:with|tracking|for |,|$)",
                  text, re.I)
    if m:
        return m.group(2).strip()
    m = re.search(r"([\w][\w\s\-]*?)\s+" + BOARD_WORD + r"\b", text, re.I)
    if m:
        cand = m.group(1).strip()
        prev = None
        while prev != cand:
            prev = cand
            cand = re.sub(r"^(?:create|make|build|set\s+up|new|a|an|the)\s+",
                          "", cand, flags=re.I)
        if cand:
            return cand
    m = re.search(r"\"([^\"]+)\"", text)
    if m:
        return m.group(1).strip()
    return ""


def _strip_board_ref(s, board_name=""):
    """Drop trailing 'to/for/from the dashboard' + board name from add/remove args."""
    s = re.sub(r"\b(?:to|on|for|in|from|of)\s+(?:the|this|that|my)?\s*"
               r"(?:dashboard|board)\b.*$", "", s, flags=re.I)
    if board_name:
        s = re.sub(re.escape(board_name) + r"\s*$", "", s, flags=re.I)
    return s.strip().rstrip(".")


def _short_ts(ts):
    """Human-short timestamp for LLM evidence: '9 Sep, 04:02'.
    Full precision stays in recorded_at; short form avoids digit soup
    that models mangle (and redteam then flags)."""
    if not ts:
        return "unknown time"
    try:
        from datetime import datetime
        dt = datetime.fromisoformat(str(ts))
        return f"{dt.day} {dt.strftime('%b')}, {dt.strftime('%H:%M')}"
    except Exception:
        return str(ts)[:16]


VALUE_WORDS = re.compile(
    r"\b(what|how\s+much|how\s+many|current|latest|value|values|reading|"
    r"readings|pressure|amount|status|show|tell|give|report)\b", re.I)
READER_BUILDER_VERBS = re.compile(
    r"\b(create|make|build|set\s+up|add|remove|drop|delete|finali[sz]e|rename)\b",
    re.I)


def handle_board_reader(text, org_id):
    """Live-board lookup for value questions.
    Returns (evidence_list, trace_note). Empty when no live board matches,
    so the normal RAG pipeline continues untouched."""
    if READER_BUILDER_VERBS.search(text):
        return [], ""
    if not VALUE_WORDS.search(text):
        return [], ""
    from data import dashboards as boards
    low = text.lower()
    hits = []
    seen = set()
    for b in boards.list_dashboards(org_id):
        if b["status"] != "live" or b["id"] in seen:
            continue
        if b["name"].lower() in low or (b["zone"] and b["zone"].lower() in low):
            hits.append(b)
            seen.add(b["id"])
    if not hits:
        return [], ""
    out = []
    for b in hits:
        full = boards.get_latest(b["id"], org_id)
        lines = []
        vals = []
        for m in full["latest"]:
            if m["recorded_at"]:
                unit = f" {m['unit']}" if m.get("unit") else ""
                by = f" by {m['recorded_by']}" if m.get("recorded_by") else ""
                lines.append(f"- {m['label']} = {m['value_text']}{unit} "
                             f"(recorded {_short_ts(m['recorded_at'])}{by})")
                if m["value_num"] is not None:
                    vals.append(m["value_num"])
            else:
                lines.append(f"- {m['label']}: no readings yet")
        out.append({
            "content": f"Board {b['name']} [live]:\n" + "\n".join(lines),
            "doc_id": b["id"], "title": f"board:{b['name']}",
            "dept": "operations", "class": "open", "distance": 0.0,
            "board": True, "board_values": vals,
        })
    return out, f"boards: attached latest from {', '.join(h['name'] for h in hits)}"


def _drafts(org_id):
    from data.dashboards import list_dashboards
    return [b for b in list_dashboards(org_id) if b["status"] == "draft"]


def _resolve_draft(text, org_id):
    """Named draft in text, else the single draft, else None + hint."""
    drafts = _drafts(org_id)
    if not drafts:
        return None, "no draft board yet"
    low = text.lower()
    for d in drafts:
        if d["name"].lower() in low:
            return d, ""
    if len(drafts) == 1:
        return drafts[0], ""
    names = ", ".join(d["name"] for d in drafts)
    return None, f"which board? drafts: {names}"


def _schema_lines(board):
    return "\n".join(
        f"- {m['label']}" + (f" ({m['unit']})" if m.get("unit") else "")
        for m in board["metrics"])


def _board_evidence(board):
    return [{
        "content": f"Board {board['name']} [{board['status']}]: "
                   + "; ".join(m["label"] for m in board["metrics"]),
        "doc_id": board["id"], "title": f"board:{board['name']}",
        "dept": "operations", "class": "open", "distance": 0.0,
        "board": True,
    }]


def handle_builder(text, org_id):
    """Builder turn? Returns (answer, judge, evidence, trace) or None."""
    low = text.lower()
    if not re.search(BOARD_WORD, low):
        return None
    from data import dashboards as boards

    # --- finalize ---
    if re.search(r"finali[sz]e", low):
        draft, hint = _resolve_draft(text, org_id)
        if not draft:
            if hint == "no draft board yet":
                return (f"No draft board to finalize. Say 'create a Zone C "
                        f"dashboard with ...' first.",
                        {"decision": "board_builder",
                         "reason": "finalize with no draft",
                         "tool_task": ""}, [], ["builder: finalize, no draft"])
            return (f"Multiple drafts — say which to finalize. {hint}.",
                    {"decision": "board_builder",
                     "reason": "finalize ambiguous draft",
                     "tool_task": ""}, [], ["builder: finalize ambiguous"])
        try:
            live = boards.finalize_dashboard(draft["id"], org_id)
        except ValueError as e:
            return (f"Cannot finalize yet: {e}. Add metrics first.",
                    {"decision": "board_builder",
                     "reason": "finalize blocked: " + str(e),
                     "tool_task": ""}, _board_evidence(draft),
                    ["builder: finalize blocked"])
        answer = (f"{live['name']} is live.\n{_schema_lines(live)}\n\n"
                  f"Staff can fill values from Boards > {live['name']}.\n"
                  f"Ask me things like 'current {live['name']} pressure?' and "
                  f"I will quote the latest reading with its timestamp.")
        return (answer,
                {"decision": "board_builder",
                 "reason": f"finalized {live['id']}",
                 "tool_task": ""}, _board_evidence(live),
                [f"builder: finalized {live['id']} (template, no LLM call)"])

    # --- iterate: add metric ---
    m_add = re.search(r"\badd\b(.+)$", text, re.I | re.S)
    if m_add and not re.search(r"\bcreat|mak|build|new\b", low):
        draft, hint = _resolve_draft(text, org_id)
        if not draft:
            return (f"No draft board to add to. {hint}.",
                    {"decision": "board_builder",
                     "reason": "add with no draft", "tool_task": ""}, [],
                    ["builder: add, no draft"])
        new_ms = extract_metrics(
            "track " + _strip_board_ref(m_add.group(1), draft["name"]))
        if not new_ms:
            return (f"What should I add to {draft['name']}? "
                    f"Say 'add oil sold this month in kL'.",
                    {"decision": "board_builder",
                     "reason": "add unparsed", "tool_task": ""},
                    _board_evidence(draft), ["builder: add unparsed"])
        have = {m["key"] for m in draft["metrics"]}
        merged = list(draft["metrics"])
        for nm in boards.normalize_metrics(new_ms):
            if nm["key"] not in have:
                merged.append(nm)
                have.add(nm["key"])
        try:
            upd = boards.update_dashboard(draft["id"], org_id, metrics=merged)
        except ValueError as e:
            return (f"Could not add: {e}.",
                    {"decision": "board_builder",
                     "reason": "add failed: " + str(e), "tool_task": ""},
                    _board_evidence(draft), ["builder: add failed"])
        answer = (f"{upd['name']} (draft) — updated:\n{_schema_lines(upd)}\n\n"
                  f"Reply 'add ...', 'remove ...', or 'finalize'.")
        return (answer,
                {"decision": "board_builder",
                 "reason": f"added metrics to {upd['id']}", "tool_task": ""},
                _board_evidence(upd),
                [f"builder: added {len(new_ms)} metric(s) to {upd['id']}"])

    # --- iterate: remove metric ---
    m_rm = re.search(r"\b(?:remove|drop|delete|take\s+off)\b(.+)$", text, re.I | re.S)
    if m_rm:
        draft, hint = _resolve_draft(text, org_id)
        if not draft:
            return (f"No draft board to change. {hint}.",
                    {"decision": "board_builder",
                     "reason": "remove with no draft", "tool_task": ""}, [],
                    ["builder: remove, no draft"])
        target = _strip_board_ref(m_rm.group(1), draft["name"]).lower()
        kept = [m for m in draft["metrics"]
                if target not in m["label"].lower() and target not in m["key"]]
        if len(kept) == len(draft["metrics"]):
            return (f"Nothing matching '{target}' on "
                    f"{draft['name']}. Current metrics:\n{_schema_lines(draft)}",
                    {"decision": "board_builder",
                     "reason": "remove no match", "tool_task": ""},
                    _board_evidence(draft), ["builder: remove no match"])
        if not kept:
            return (f"That would leave {draft['name']} empty — a board needs "
                    f"at least one metric.",
                    {"decision": "board_builder",
                     "reason": "remove blocked empty", "tool_task": ""},
                    _board_evidence(draft), ["builder: remove blocked"])
        upd = boards.update_dashboard(draft["id"], org_id, metrics=kept)
        answer = (f"{upd['name']} (draft) — updated:\n{_schema_lines(upd)}\n\n"
                  f"Reply 'add ...', 'remove ...', or 'finalize'.")
        return (answer,
                {"decision": "board_builder",
                 "reason": f"removed metric from {upd['id']}", "tool_task": ""},
                _board_evidence(upd),
                [f"builder: removed metric from {upd['id']}"])

    # --- propose ---
    if re.search(r"\b(?:create|make|build|set\s*up|new)\b", low):
        name = extract_name(text) or "Untitled board"
        zone_m = ZONE_RE.search(name) or ZONE_RE.search(text)
        zone = zone_m.group(0) if zone_m else ""
        metrics = extract_metrics(text)
        try:
            draft = boards.propose_dashboard(org_id, name, zone=zone,
                                             metrics=metrics or [],
                                             created_by="chat")
        except ValueError as e:
            return (f"Could not draft the board: {e}.",
                    {"decision": "board_builder",
                     "reason": "propose failed: " + str(e), "tool_task": ""},
                    [], ["builder: propose failed"])
        if metrics:
            answer = (f"Drafted {draft['name']} (draft):\n{_schema_lines(draft)}\n\n"
                      f"Reply 'add ...', 'remove ...', or 'finalize' to make it live.")
        else:
            answer = (f"Drafted {draft['name']} (draft) with no metrics yet. "
                      f"What should it track? Say 'add pipe pressure in bar'.")
        return (answer,
                {"decision": "board_builder",
                 "reason": f"proposed {draft['id']}", "tool_task": ""},
                _board_evidence(draft),
                [f"builder: proposed {draft['id']} (template, no LLM call)"])

    return None
