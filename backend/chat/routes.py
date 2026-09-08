"""Chat routes — threads + history."""
from flask import Blueprint, g, jsonify, request, session
from auth.service import is_member
from chat.service import create_conversation, list_conversations, get_messages, add_message

chat_bp = Blueprint("chat", __name__)


def _uid():
    return session.get("user_id")


def _check_org():
    uid = _uid()
    if not uid: return False, jsonify({"error": "not authenticated"}), 401
    org = g.get("org_id", "default")
    if not is_member(uid, org):
        return False, jsonify({"error": "not a member of this org"}), 403
    return True, org, uid


@chat_bp.post("/conversations")
def create():
    ok, res, uid = _check_org()
    if not ok: return res
    org = res
    title = (request.get_json(silent=True) or {}).get("title", "New chat")
    cid = create_conversation(org, uid, title)
    return jsonify({"id": cid, "org_id": org}), 201


@chat_bp.get("/conversations")
def list_all():
    ok, res, uid = _check_org()
    if not ok: return res
    return jsonify({"conversations": list_conversations(res, uid)})


@chat_bp.get("/conversations/<int:cid>/messages")
def msgs(cid):
    ok, res, uid = _check_org()
    if not ok: return res
    m = get_messages(cid, res, uid)
    if m is None: return jsonify({"error": "not found"}), 404
    return jsonify({"messages": m})


@chat_bp.post("/conversations/<int:cid>/messages")
def post_msg(cid):
    ok, res, uid = _check_org()
    if not ok: return res
    d = request.get_json(force=True, silent=True) or {}
    mid = add_message(cid, d.get("role", "user"), d.get("content", ""), d.get("model_key"), d.get("evidence"), d.get("request_id"), d.get("tool_used"), d.get("tool_trace"), d.get("judge"))
    return jsonify({"id": mid}), 201
