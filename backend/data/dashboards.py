"""Dashboard Maker ("Boards") — data ops for conversational zone/general dashboards.

Drafts are real rows (status='draft') so bot-led proposals are resumable and
auditable. Staff fill values via the board form; each save appends readings.
"Current value" of a metric = its latest reading. recorded_at drives every
"last updated" label. Org-scoped everywhere — callers pass org_id in.
"""
import json
import re
import uuid


def _new_id(prefix):
    return prefix + "-" + uuid.uuid4().hex[:6]


def _slug(label):
    s = re.sub(r"[^a-z0-9]+", "_", (label or "").strip().lower()).strip("_")
    return s or "metric"


def _parse_metrics(raw):
    try:
        m = json.loads(raw) if raw else []
        return m if isinstance(m, list) else []
    except Exception:
        return []


def normalize_metrics(metrics):
    """Validate + normalize a metric list. Returns list or raises ValueError."""
    if not isinstance(metrics, list) or not metrics:
        raise ValueError("a dashboard needs at least one metric")
    seen = set()
    out = []
    for m in metrics:
        if not isinstance(m, dict):
            raise ValueError("each metric needs a label")
        label = str(m.get("label", "")).strip()
        if not label:
            raise ValueError("each metric needs a label")
        key = str(m.get("key", "")).strip() or _slug(label)
        key = re.sub(r"[^a-z0-9_]", "_", key.lower()).strip("_") or _slug(label)
        if key in seen:
            raise ValueError(f"duplicate metric key: {key}")
        seen.add(key)
        kind = str(m.get("kind", "number")).lower()
        if kind not in ("number", "text"):
            kind = "number"
        out.append({"key": key, "label": label,
                    "unit": str(m.get("unit", "")).strip(), "kind": kind})
    return out


def _row_to_board(r):
    return {
        "id": r[0], "org_id": r[1], "name": r[2], "zone": r[3],
        "status": r[4], "metrics": _parse_metrics(r[5]),
        "created_by": r[6], "created_at": str(r[7]), "updated_at": str(r[8]),
    }


def propose_dashboard(org_id, name, zone="", metrics=None, created_by=""):
    """Create a draft board. Returns the board dict."""
    from data.db import get_conn
    name = (name or "").strip()
    if not name:
        raise ValueError("dashboard needs a name")
    metrics = normalize_metrics(metrics or [])
    conn = get_conn()
    cur = conn.cursor()
    bid = _new_id("B")
    cur.execute(
        """INSERT INTO dashboards
           (id, org_id, name, zone, status, metrics, created_by)
           VALUES (%s,%s,%s,%s,'draft',%s,%s) RETURNING
           id, org_id, name, zone, status, metrics, created_by,
           created_at, updated_at;""",
        (bid, org_id or "default", name, (zone or "").strip(),
         json.dumps(metrics), created_by or ""),
    )
    board = _row_to_board(cur.fetchone())
    conn.commit()
    cur.close()
    conn.close()
    return board


def get_dashboard(board_id, org_id):
    """One board or None."""
    from data.db import get_conn
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """SELECT id, org_id, name, zone, status, metrics, created_by,
                  created_at, updated_at
           FROM dashboards WHERE id=%s AND org_id=%s;""",
        (board_id, org_id or "default"),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    return _row_to_board(row) if row else None


def list_dashboards(org_id):
    """All boards for an org, drafts first then newest."""
    from data.db import get_conn
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """SELECT id, org_id, name, zone, status, metrics, created_by,
                  created_at, updated_at
           FROM dashboards WHERE org_id=%s
           ORDER BY CASE status WHEN 'draft' THEN 0 ELSE 1 END, updated_at DESC;""",
        (org_id or "default",),
    )
    boards = [_row_to_board(r) for r in cur.fetchall()]
    cur.close()
    conn.close()
    return boards


def update_dashboard(board_id, org_id, name=None, zone=None, metrics=None):
    """Iterate a draft's schema. Returns updated board or None. Live boards
    can be renamed but their metric keys are frozen (history integrity)."""
    board = get_dashboard(board_id, org_id)
    if not board:
        return None
    if board["status"] == "live" and metrics is not None:
        raise ValueError("live board metric schema is frozen — rename only")
    if metrics is not None:
        metrics = normalize_metrics(metrics)
    else:
        metrics = board["metrics"]
    name = board["name"] if name is None else (name or "").strip() or board["name"]
    zone = board["zone"] if zone is None else (zone or "").strip()
    from data.db import get_conn
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """UPDATE dashboards SET name=%s, zone=%s, metrics=%s, updated_at=now()
           WHERE id=%s AND org_id=%s RETURNING
           id, org_id, name, zone, status, metrics, created_by,
           created_at, updated_at;""",
        (name, zone, json.dumps(metrics), board_id, org_id or "default"),
    )
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    return _row_to_board(row) if row else None


def finalize_dashboard(board_id, org_id):
    """Draft -> live. Returns board or None."""
    board = get_dashboard(board_id, org_id)
    if not board:
        return None
    if board["status"] == "live":
        return board
    if not board["metrics"]:
        raise ValueError("cannot finalize a board with no metrics")
    from data.db import get_conn
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """UPDATE dashboards SET status='live', updated_at=now()
           WHERE id=%s AND org_id=%s RETURNING
           id, org_id, name, zone, status, metrics, created_by,
           created_at, updated_at;""",
        (board_id, org_id or "default"),
    )
    row = cur.fetchone()
    conn.commit()
    cur.close()
    conn.close()
    return _row_to_board(row) if row else None


def submit_readings(board_id, org_id, values, recorded_by=""):
    """Append one reading per metric. values: [{metric_key, value}].
    Only live boards accept readings. Returns count saved."""
    board = get_dashboard(board_id, org_id)
    if not board:
        return None
    if board["status"] != "live":
        raise ValueError("board is still a draft — finalize it first")
    if not isinstance(values, list) or not values:
        raise ValueError("no readings submitted")
    schema = {m["key"]: m for m in board["metrics"]}
    rows = []
    for v in values:
        if not isinstance(v, dict):
            continue
        key = str(v.get("metric_key", "")).strip()
        if key not in schema:
            raise ValueError(f"unknown metric: {key}")
        raw = v.get("value", "")
        num = None
        if schema[key]["kind"] == "number":
            try:
                num = float(str(raw).replace(",", "").strip())
            except (ValueError, TypeError):
                raise ValueError(f"{schema[key]['label']} needs a number")
        rows.append((board_id, key, num, str(raw), recorded_by or ""))
    from data.db import get_conn
    conn = get_conn()
    cur = conn.cursor()
    for r in rows:
        cur.execute(
            """INSERT INTO readings
               (dashboard_id, metric_key, value_num, value_text, recorded_by)
               VALUES (%s,%s,%s,%s,%s);""",
            r,
        )
    cur.execute("UPDATE dashboards SET updated_at=now() WHERE id=%s;", (board_id,))
    conn.commit()
    cur.close()
    conn.close()
    return len(rows)


def get_latest(board_id, org_id):
    """Board + current value per metric (None when never filled)."""
    board = get_dashboard(board_id, org_id)
    if not board:
        return None
    from data.db import get_conn
    conn = get_conn()
    cur = conn.cursor()
    latest = []
    for m in board["metrics"]:
        cur.execute(
            """SELECT value_num, value_text, recorded_by, recorded_at
               FROM readings
               WHERE dashboard_id=%s AND metric_key=%s
               ORDER BY recorded_at DESC LIMIT 1;""",
            (board_id, m["key"]),
        )
        r = cur.fetchone()
        latest.append({
            "key": m["key"], "label": m["label"], "unit": m["unit"],
            "kind": m["kind"],
            "value_num": r[0] if r else None,
            "value_text": r[1] if r else None,
            "recorded_by": r[2] if r else None,
            "recorded_at": str(r[3]) if r else None,
        })
    cur.close()
    conn.close()
    board["latest"] = latest
    return board


def get_history(board_id, org_id, metric_key, days=30):
    """Readings for one metric, oldest first. Empty list when metric unknown."""
    board = get_dashboard(board_id, org_id)
    if not board:
        return None
    if metric_key not in {m["key"] for m in board["metrics"]}:
        return []
    try:
        days = max(1, min(365, int(days)))
    except (ValueError, TypeError):
        days = 30
    from data.db import get_conn
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """SELECT value_num, value_text, recorded_by, recorded_at
           FROM readings
           WHERE dashboard_id=%s AND metric_key=%s
             AND recorded_at >= now() - (%s || ' days')::interval
           ORDER BY recorded_at;""",
        (board_id, metric_key, str(days)),
    )
    out = [{"value_num": r[0], "value_text": r[1],
            "recorded_by": r[2], "recorded_at": str(r[3])}
           for r in cur.fetchall()]
    cur.close()
    conn.close()
    return out
