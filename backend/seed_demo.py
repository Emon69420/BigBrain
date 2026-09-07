"""Seed demo users/orgs for ui-perplexity manual testing."""
import os
from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))
from auth.service import create_user, join_org, get_orgs_for_user
from data.db import get_conn

def seed():
    # create two demo users (idempotent by try)
    try:
        uid1 = create_user("ops@refineryA.in", "Refinery A Ops", "demo1234")
        print(f"created refineryA user {uid1}")
    except Exception as e:
        print(f"refineryA exists or failed: {e}")
        # fetch existing
        conn=get_conn(); cur=conn.cursor(); cur.execute("SELECT id FROM users WHERE email=%s;",("ops@refinerya.in",)); r=cur.fetchone(); uid1=r[0] if r else None; cur.close(); conn.close()
    try:
        uid2 = create_user("ops@refineryB.in", "Refinery B Ops", "demo1234")
        print(f"created refineryB user {uid2}")
    except Exception as e:
        print(f"refineryB exists or failed: {e}")
        conn=get_conn(); cur=conn.cursor(); cur.execute("SELECT id FROM users WHERE email=%s;",("ops@refineryb.in",)); r=cur.fetchone(); uid2=r[0] if r else None; cur.close(); conn.close()
    # ensure orgs
    if uid1:
        join_org(uid1, "refinery-a", "owner")
        join_org(uid1, "default", "member")
        print(f"refineryA orgs: {get_orgs_for_user(uid1)}")
    if uid2:
        join_org(uid2, "refinery-b", "owner")
        join_org(uid2, "default", "member")
        print(f"refineryB orgs: {get_orgs_for_user(uid2)}")
    print("seed done — login with ops@refineryA.in / demo1234 or ops@refineryB.in / demo1234")

if __name__=="__main__":
    seed()
