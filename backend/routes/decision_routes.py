"""Decision DNA endpoints — thin routes, logic lives in brain/decision.py."""
from flask import Blueprint, g, jsonify, session
from auth.service import is_member as _is_member
from brain.decision import get_by_request, list_by_conversation

decision_bp = Blueprint("decision", __name__)


def _require_org():
    uid = session.get("user_id")
    if not uid:
        return False, jsonify({"error": "not authenticated"}), None
    org = g.get("org_id", "default")
    if not _is_member(uid, org):
        return False, jsonify({"error": "not a member of this org"}), None
    return True, org, uid


@decision_bp.get("/decisions/by-request/<request_id>")
def by_request(request_id):
    ok, res, _ = _require_org()
    if not ok:
        return res, res.status_code
    d = get_by_request(request_id, res)
    if not d:
        return jsonify({"error": "not found"}), 404
    return jsonify(d)


@decision_bp.get("/conversations/<int:cid>/decisions")
def by_conversation(cid):
    ok, res, uid = _require_org()
    if not ok:
        return res, res.status_code
    ds = list_by_conversation(cid, res, uid)
    if ds is None:
        return jsonify({"error": "not found"}), 404
    return jsonify({"decisions": ds})
