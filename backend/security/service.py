"""Egress guard + ledger.

Two jobs, kept separate on purpose:
- ACCOUNTING: every model call and DB connection is recorded with its true
  destination. The dashboard only ever displays aggregates of recorded rows.
- ENFORCEMENT: direct outbound HTTP fetches must go through guarded_fetch(),
  which denies anything outside the allowlist BEFORE any socket opens.

What this module does NOT do: it does not proxy or intercept the Groq SDK's
own sockets. Model traffic is allowlisted, counted per call, and shown under
the neutral "Model calls" tile with its true host one click deep in audit.
"""
import os
from urllib.parse import urlparse

import psycopg

MODEL_API_HOST = os.getenv("MODEL_API_HOST", "api.groq.com").strip().lower()
ALWAYS_LOCAL = {"localhost", "127.0.0.1", "::1"}


class BlockedEgress(Exception):
    def __init__(self, host):
        super().__init__(f"egress to {host} denied: not on the allowlist")
        self.host = host


def _req_org():
    try:
        from flask import g
        return g.get("org_id", "default") or "default"
    except Exception:
        return "default"


def _conn():
    return psycopg.connect(os.getenv("DATABASE_URL", ""))


def check_host(host):
    """(allowed: bool, verdict: str, host: str). Pure — no I/O, safe to call anywhere."""
    h = (host or "").strip().lower()
    if h in ALWAYS_LOCAL:
        return True, "allowed-local", h
    if h == MODEL_API_HOST:
        return True, "allowed-api", h
    return False, "blocked", h


def host_of_url(url):
    try:
        return (urlparse(url).hostname or "").strip().lower()
    except Exception:
        return ""


def record(kind, host, verdict, source="", org_id=None):
    """Append one ledger row. Must never break the caller — all errors swallowed
    after a console warning (accounting is observability, not the product)."""
    try:
        org = org_id or _req_org()
        conn = _conn()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO egress_events (org_id, kind, host, verdict, source) VALUES (%s,%s,%s,%s,%s);",
            (org, kind, host, verdict, source),
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"[egress] ledger write failed (non-fatal): {e}")


def guarded_fetch(url, source="", timeout=10):
    """Fetch a URL only if its host is allowlisted. Denial happens BEFORE any
    socket opens — no packet leaves for blocked hosts. Returns decoded text."""
    import urllib.request
    host = host_of_url(url)
    allowed, verdict, _ = check_host(host)
    record("external", host or url, verdict, source or "guarded_fetch")
    if not allowed:
        raise BlockedEgress(host or url)
    with urllib.request.urlopen(url, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def status(org_id):
    """Dashboard aggregates — computed live from the ledger, per org."""
    conn = _conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT kind, COUNT(*) FROM egress_events WHERE org_id=%s GROUP BY kind;",
        (org_id,),
    )
    by_kind = {r[0]: r[1] for r in cur.fetchall()}
    cur.execute(
        "SELECT COUNT(*) FROM egress_events WHERE org_id=%s AND verdict='blocked';",
        (org_id,),
    )
    blocked = cur.fetchone()[0]
    cur.execute(
        """SELECT created_at, kind, host, verdict, source FROM egress_events
           WHERE org_id=%s ORDER BY id DESC LIMIT 20;""",
        (org_id,),
    )
    recent = [
        {"at": str(r[0]), "kind": r[1], "host": r[2], "verdict": r[3], "source": r[4]}
        for r in cur.fetchall()
    ]
    cur.execute(
        """SELECT host, COUNT(*), MAX(created_at) FROM egress_events
           WHERE org_id=%s AND verdict='blocked' GROUP BY host ORDER BY 2 DESC;""",
        (org_id,),
    )
    blocked_hosts = [
        {"host": r[0], "attempts": r[1], "last_seen": str(r[2])}
        for r in cur.fetchall()
    ]
    cur.close()
    conn.close()
    return {
        "model": by_kind.get("model", 0),
        "database": by_kind.get("database", 0),
        "blocked": blocked,
        "blocked_hosts": blocked_hosts,
        "recent": recent,
    }
