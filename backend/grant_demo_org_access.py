"""Grant existing local demo users access to the synthetic oil organisation.

This is intentionally separate from normal registration. It is for the local
demo corpus only and is safe to rerun because membership insertion is
idempotent.
"""
import argparse
import os

from dotenv import load_dotenv

from auth.service import join_org
from data.db import get_conn

ROOT = os.path.dirname(os.path.dirname(__file__))
load_dotenv(os.path.join(ROOT, ".env"))


def grant(org_id="indianoil-demo", email=None):
    conn = get_conn()
    cur = conn.cursor()
    if email:
        cur.execute("SELECT id, email FROM users WHERE email=%s;", (email.lower().strip(),))
    else:
        cur.execute("SELECT id, email FROM users ORDER BY id;")
    users = cur.fetchall()
    cur.close()
    conn.close()
    for user_id, user_email in users:
        join_org(user_id, org_id, "member")
        print(f"granted {user_email} -> {org_id}")
    if not users:
        print("no matching users found")
    return len(users)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Grant local users access to the oil demo org")
    parser.add_argument("--org-id", default="indianoil-demo")
    parser.add_argument("--email", help="grant only this user; default grants all existing local users")
    args = parser.parse_args()
    grant(args.org_id, args.email)
