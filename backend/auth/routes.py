"""Auth routes — register/login/me + org membership. Thin routes."""
from flask import Blueprint, g, jsonify, request, session
from auth.service import create_user, verify_user, get_user, get_orgs_for_user

auth_bp = Blueprint("auth", __name__)


def _current():
    uid = session.get("user_id")
    if not uid: return None
    return get_user(uid)


@auth_bp.post("/auth/register")
def register():
    d = request.get_json(force=True, silent=True) or {}
    email, name, pw = (d.get("email") or "").strip(), (d.get("name") or "").strip(), d.get("password") or ""
    if not email or not pw or not name: return jsonify({"error": "email, name, password required"}), 400
    try:
        uid = create_user(email, name, pw)
    except Exception as e:
        if "unique" in str(e).lower() or "duplicate" in str(e).lower():
            return jsonify({"error": "email already registered"}), 409
        return jsonify({"error": "register failed"}), 500
    session["user_id"] = uid
    return jsonify({"id": uid, "email": email.lower(), "name": name}), 201


@auth_bp.post("/auth/login")
def login():
    d = request.get_json(force=True, silent=True) or {}
    u = verify_user(d.get("email") or "", d.get("password") or "")
    if not u: return jsonify({"error": "invalid credentials"}), 401
    session["user_id"] = u["id"]
    return jsonify(u)


@auth_bp.post("/auth/logout")
def logout():
    session.clear()
    return jsonify({"ok": True})


@auth_bp.get("/auth/me")
def me():
    u = _current()
    if not u: return jsonify({"user": None})
    return jsonify({"user": u, "orgs": get_orgs_for_user(u["id"])})
