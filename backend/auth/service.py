"""Auth service — hashing, user + membership ops. Routes never touch SQL directly."""
from werkzeug.security import generate_password_hash, check_password_hash
from data.db import get_conn


def create_user(email, name, password):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("INSERT INTO users (email, name, password_hash) VALUES (%s,%s,%s) RETURNING id;",
                (email.lower().strip(), name.strip(), generate_password_hash(password)))
    uid = cur.fetchone()[0]
    # ensure org exists
    cur.execute("INSERT INTO orgs (id, name) VALUES (%s,%s) ON CONFLICT (id) DO NOTHING;", ("default", "Default org"))
    # auto-join default org as member
    cur.execute("INSERT INTO memberships (user_id, org_id, role) VALUES (%s,%s,'member') ON CONFLICT DO NOTHING;", (uid, "default"))
    conn.commit(); cur.close(); conn.close()
    return uid


def verify_user(email, password):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT id, name, password_hash FROM users WHERE email=%s;", (email.lower().strip(),))
    row = cur.fetchone(); cur.close(); conn.close()
    if not row or not check_password_hash(row[2], password):
        return None
    return {"id": row[0], "email": email.lower().strip(), "name": row[1]}


def get_user(user_id):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT id, email, name FROM users WHERE id=%s;", (user_id,))
    row = cur.fetchone(); cur.close(); conn.close()
    if not row: return None
    return {"id": row[0], "email": row[1], "name": row[2]}


def get_orgs_for_user(user_id):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT o.id, o.name, m.role FROM orgs o JOIN memberships m ON m.org_id=o.id WHERE m.user_id=%s ORDER BY o.id;", (user_id,))
    rows = cur.fetchall(); cur.close(); conn.close()
    return [{"id": r[0], "name": r[1], "role": r[2]} for r in rows]


def is_member(user_id, org_id):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("SELECT 1 FROM memberships WHERE user_id=%s AND org_id=%s;", (user_id, org_id))
    row = cur.fetchone(); cur.close(); conn.close()
    return bool(row)


def join_org(user_id, org_id, role="member"):
    conn = get_conn(); cur = conn.cursor()
    cur.execute("INSERT INTO orgs (id, name) VALUES (%s,%s) ON CONFLICT (id) DO NOTHING;", (org_id, org_id))
    cur.execute("INSERT INTO memberships (user_id, org_id, role) VALUES (%s,%s,%s) ON CONFLICT DO NOTHING;", (user_id, org_id, role))
    conn.commit(); cur.close(); conn.close()
