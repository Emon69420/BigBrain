"""Dashboard-Maker builder intents — pre-check for ask_question.

Split design (mechanic-proof): an SLM extracts builder intent from free-form
text into strict JSON; deterministic code validates + writes. The LLM
understands, code enforces. Low-confidence turns get a clarifying question,
never a junk draft. Template replies only: no factual claims.
Returns None when the text is not a builder turn.
"""
import json
import re

BOARD_WORD = r"(?:dashboard|board)"

ZONE_RE = re.compile(r"\bzone\s+[a-z0-9]+\b", re.I)

EXTRACT_SYSTEM = """You extract dashboard-builder intent for BigBrain. Respond STRICT JSON only, no other text.

Actions: propose (new board), add (metrics to a draft), remove (metrics from a draft), rename (a draft), finalize (draft goes live), none (not about building dashboards).

Context lists the org's draft and live boards. Resolve "it / this / the dashboard" against them.

Rules:
- Extract ONLY what the user stated. Never invent metrics, names, units, or zones.
- metrics: [{"label": "...", "unit": "bar, kL, ... or empty", "kind": "number or text"}]. kind=text for status/notes/names/shifts/people/amounts-described-in-words.
- Keep equipment/line identifiers in labels: "L09 pipeline pressure", not bare "Pressure". Board name is usually the zone or topic ("Zone C").
- A zone is a named area (Zone C). Debt/owe/people tracking are normal text or number metrics.
- remove_targets: metric labels to drop. finalize/rename need no metrics.
- confidence 0..1 — be honest; below ~0.6 the bot asks a clarifying question.

JSON shape: {"action":"propose|add|remove|rename|finalize|none","name":"","zone":"","metrics":[],"remove_targets":[],"confidence":0.0}"""

ITERATE_VERBS = re.compile(
    r"\b(add|remove|drop|delete|finali[sz]e|rename|track|monitor|measure|watch)\b", re.I)


def _ws_norm(s):
    return re.sub(r"\s+", " ", str(s or "")).strip().lower()


def extract_board_turn(text, org_id):
    """SLM parse of a builder turn. Returns dict or {"action":"none","confidence":0}."""
    from config import load_registry
    from brain.groq_provider import GroqBrain
    from utils.observability import log_llm_call, new_request_id, timed, elapsed_ms
    try:
        from data import dashboards as boards
        all_b = boards.list_dashboards(org_id)
    except Exception:
        all_b = []
    drafts = [{"name": d["name"],
               "metrics": [m["label"] for m in d["metrics"]]}
              for d in all_b if d["status"] == "draft"]
    live = [{"name": b["name"], "zone": b["zone"]}
            for b in all_b if b["status"] == "live"]
    user_block = (f"Message: {text}\nDrafts: {json.dumps(drafts) or '[]'}\n"
                  f"Live boards: {json.dumps(live) or '[]'}")
    reg = load_registry()
    brain = GroqBrain(reg)
    req_id = new_request_id()
    t0 = timed()
    try:
        raw, usage = brain.chat_full(
            "groq-slm",
            [{"role": "system", "content": EXTRACT_SYSTEM},
             {"role": "user", "content": user_block}], temperature=0)
        latency = elapsed_ms(t0)
        m = re.search(r"\{.*\}", raw, re.S)
        data = json.loads(m.group(0)) if m else {}
        log_llm_call(req_id, org_id, "operations",
                     {"task_type": "board_extract", "complexity": "low"},
                     "groq-slm",
                     brain.registry.get("groq-slm", {}).get("model_id", ""),
                     user_block, raw, usage, latency)
    except Exception as e:
        latency = elapsed_ms(t0)
        try:
            log_llm_call(req_id, org_id, "operations",
                         {"task_type": "board_extract", "complexity": "low"},
                         "groq-slm", "", user_block, None, None, latency,
                         error=str(e))
        except Exception:
            pass
        return {"action": "none", "confidence": 0.0}
    action = str(data.get("action", "none")).lower()
    if action not in {"propose", "add", "remove", "rename", "finalize", "none"}:
        action = "none"
    try:
        conf = float(data.get("confidence", 0.0))
    except (ValueError, TypeError):
        conf = 0.0
    return {"action": action,
            "name": str(data.get("name", "") or "").strip(),
            "zone": str(data.get("zone", "") or "").strip(),
            "metrics": data.get("metrics") if isinstance(data.get("metrics"), list) else [],
            "remove_targets": data.get("remove_targets") if isinstance(data.get("remove_targets"), list) else [],
            "confidence": max(0.0, min(1.0, conf))}


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


def _resolve_draft(text, org_id, hint_name=""):
    """Named draft in text (or LLM-resolved name), else single draft, else hint."""
    drafts = _drafts(org_id)
    if not drafts:
        return None, "no draft board yet"
    if hint_name:
        for d in drafts:
            if _ws_norm(d["name"]) == _ws_norm(hint_name):
                return d, ""
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


def _is_builder_turn(text, org_id):
    """Cheap deterministic gate: board word, known board name/zone, or
    iterate verbs while a draft exists. The LLM parses; gate only routes."""
    low = text.lower()
    if re.search(BOARD_WORD, low):
        return True
    try:
        from data import dashboards as boards
        all_b = boards.list_dashboards(org_id)
    except Exception:
        return False
    for b in all_b:
        if b["name"].lower() in low or (b["zone"] and b["zone"].lower() in low):
            return True
    if any(b["status"] == "draft" for b in all_b) and ITERATE_VERBS.search(low):
        return True
    return False


def _judge(tag):
    return {"decision": "board_builder", "reason": tag, "tool_task": ""}


def _preview_pointer(name):
    return f"\n\nSee it taking shape in Boards > {name}."


def handle_builder(text, org_id):
    """Builder turn? Returns (answer, judge, evidence, trace) or None."""
    from data import dashboards as boards
    if not _is_builder_turn(text, org_id):
        return None

    # fast path: finalize with no drafts needs no parse
    if re.search(r"finali[sz]e", text, re.I) and not _drafts(org_id):
        return (f"No draft board to finalize. Say 'create a Zone C "
                f"dashboard tracking ...' first.",
                _judge("finalize with no draft"), [],
                ["builder: finalize, no draft"])

    ext = extract_board_turn(text, org_id)
    action, conf = ext["action"], ext["confidence"]
    if action == "none" or conf < 0.6:
        drafts = _drafts(org_id)
        hint = ("Current drafts: " + ", ".join(d["name"] for d in drafts) + "."
                if drafts else "No drafts yet.")
        return (f"I couldn't pin that down. {hint} Try: 'create a <name> "
                f"dashboard tracking <metric> in <unit>'.",
                _judge(f"clarify (action={action}, conf={conf:.2f})"), [],
                [f"builder: clarify, action={action} conf={conf:.2f}"])

    # --- finalize ---
    if action == "finalize":
        draft, hint = _resolve_draft(text, org_id, ext["name"])
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
                [f"builder: finalized {live['id']} (slm extract)"])

    # --- iterate: add metric (LLM-parsed, code-validated) ---
    if action == "add":
        draft, hint = _resolve_draft(text, org_id, ext["name"])
        if not draft:
            return (f"No draft board to add to. {hint}.",
                    {"decision": "board_builder",
                     "reason": "add with no draft", "tool_task": ""}, [],
                    ["builder: add, no draft"])
        # echo-guard: never accept a metric that just repeats the board name
        new_ms = [m for m in ext["metrics"]
                  if _ws_norm(m.get("label", "")) != _ws_norm(draft["name"])]
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
                  f"Reply 'add ...', 'remove ...', or 'finalize'."
                  + _preview_pointer(upd["name"]))
        return (answer,
                {"decision": "board_builder",
                 "reason": f"added metrics to {upd['id']}", "tool_task": ""},
                _board_evidence(upd),
                [f"builder: added {len(new_ms)} metric(s) to {upd['id']}"])

    # --- iterate: remove metric (LLM-parsed targets, fuzzy code match) ---
    if action == "remove":
        draft, hint = _resolve_draft(text, org_id, ext["name"])
        if not draft:
            return (f"No draft board to change. {hint}.",
                    {"decision": "board_builder",
                     "reason": "remove with no draft", "tool_task": ""}, [],
                    ["builder: remove, no draft"])
        targets = [_ws_norm(t) for t in ext["remove_targets"] if str(t).strip()]
        if not targets:
            return (f"Which metric should go? Current metrics on "
                    f"{draft['name']}:\n{_schema_lines(draft)}",
                    {"decision": "board_builder",
                     "reason": "remove no targets", "tool_task": ""},
                    _board_evidence(draft), ["builder: remove no targets"])
        kept = [m for m in draft["metrics"]
                if not any(t in _ws_norm(m["label"]) or t in _ws_norm(m["key"])
                           for t in targets)]
        if len(kept) == len(draft["metrics"]):
            return (f"Nothing matching '{', '.join(ext['remove_targets'])}' on "
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
                  f"Reply 'add ...', 'remove ...', or 'finalize'."
                  + _preview_pointer(upd["name"]))
        return (answer,
                {"decision": "board_builder",
                 "reason": f"removed metric from {upd['id']}", "tool_task": ""},
                _board_evidence(upd),
                [f"builder: removed metric from {upd['id']}"])

    # --- iterate: rename draft ---
    if action == "rename":
        draft, hint = _resolve_draft(text, org_id, ext["name"])
        if not draft:
            return (f"No draft board to rename. {hint}.",
                    _judge("rename with no draft"), [],
                    ["builder: rename, no draft"])
        if not ext["name"]:
            return (f"What should {draft['name']} be called?",
                    _judge("rename unnamed"),
                    _board_evidence(draft), ["builder: rename unnamed"])
        upd = boards.update_dashboard(draft["id"], org_id, name=ext["name"])
        if not upd:
            return (f"Could not rename.", _judge("rename failed"),
                    [], ["builder: rename failed"])
        return (f"Renamed to {upd['name']} (draft)."
                + _preview_pointer(upd["name"]),
                _judge(f"renamed to {upd['id']}"),
                _board_evidence(upd),
                [f"builder: renamed {upd['id']} (slm extract)"])

    # --- propose (LLM-parsed name/zone/metrics, code-validated) ---
    if action == "propose":
        name = ext["name"]
        zone = ext["zone"]
        if not zone:
            zone_m = ZONE_RE.search(name) or ZONE_RE.search(text)
            zone = zone_m.group(0) if zone_m else ""
        if not name:
            name = zone or "Untitled board"
        metrics = [m for m in ext["metrics"]
                   if _ws_norm(m.get("label", "")) != _ws_norm(name)]
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
                      f"Reply 'add ...', 'remove ...', or 'finalize' to make it live."
                      + _preview_pointer(draft["name"]))
        else:
            answer = (f"Drafted {draft['name']} (draft) with no metrics yet. "
                      f"What should it track? Say 'add pipe pressure in bar'.")
        return (answer,
                {"decision": "board_builder",
                 "reason": f"proposed {draft['id']}", "tool_task": ""},
                _board_evidence(draft),
                [f"builder: proposed {draft['id']} (slm extract)"])

    return None
