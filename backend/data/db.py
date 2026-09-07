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
    return conn


def check_access(user_dept, doc_dept, doc_class):
    """Pure function — easy to test. Same-dept or open only."""
    if doc_class == "open":
        return True
    return user_dept == doc_dept


def init_db():
    """Create minimal tables. Safe to run twice."""
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    cur.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id SERIAL PRIMARY KEY,
            title TEXT,
            dept TEXT,
            class TEXT DEFAULT 'open',
            content TEXT
        );
    """)
    conn.commit()
    cur.close()
    conn.close()
    return True
