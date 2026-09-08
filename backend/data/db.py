"""Data switch — permission-aware retrieval. Postgres+pgvector now and local later."""
import os
import psycopg
from pgvector.psycopg import register_vector


def get_conn():
    conn = psycopg.connect(os.getenv("DATABASE_URL", ""))
    try:
        register_vector(conn)
    except Exception:
        pass  # extension not installed yet — init_db() installs it
    try:
        from urllib.parse import urlparse
        from security.service import record, check_host
        db_host = (urlparse(os.getenv("DATABASE_URL", "")).hostname or "localhost").lower()
        _, verdict, host = check_host(db_host)
        record("database", host, verdict, source="db:connect")
    except Exception:
        pass  # accounting must never break data access
    return conn


def check_access(user_dept, doc_dept, doc_class):
    """Pure function — easy to test. Same-dept or open only."""
    if doc_class == "open":
        return True
    return user_dept == doc_dept


def init_db():
    """Legacy shim — delegates to migrate.py. Keep for callers."""
    import migrate as _m
    return _m.run_migrations()
