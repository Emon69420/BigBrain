"""Migration runner. One command:  python backend/migrate.py
Applies pending backend/migrations/*.sql in order, tracks versions in
schema_migrations. Safe to re-run. Docker entrypoint calls this too.
"""
import os
import sys

import psycopg
from dotenv import load_dotenv

MIGRATIONS_DIR = os.path.join(os.path.dirname(__file__), "migrations")


def run_migrations():
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))
    url = os.getenv("DATABASE_URL", "")
    if not url:
        raise SystemExit("DATABASE_URL missing — copy .env.example to .env first")
    files = sorted(f for f in os.listdir(MIGRATIONS_DIR) if f.endswith(".sql"))
    conn = psycopg.connect(url)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("CREATE TABLE IF NOT EXISTS schema_migrations "
                "(version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now());")
    cur.execute("SELECT version FROM schema_migrations;")
    applied = {r[0] for r in cur.fetchall()}
    for f in files:
        version = f.replace(".sql", "")
        if version in applied:
            print(f"skip {version} (already applied)")
            continue
        with open(os.path.join(MIGRATIONS_DIR, f)) as fh:
            cur.execute(fh.read())
        cur.execute("INSERT INTO schema_migrations (version) VALUES (%s);", (version,))
        print(f"applied {version}")
    cur.close()
    conn.close()
    return True


if __name__ == "__main__":
    run_migrations()
