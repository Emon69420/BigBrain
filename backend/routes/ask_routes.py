"""Ask endpoint — thin route, logic lives in brain/service.py."""
from flask import Blueprint, g, jsonify, request
from brain.service import ask_question

ask_bp = Blueprint("ask", __name__)


def handle_ask(data):
    text = (data or {}).get("text", "").strip()
    if not text:
        return {"error": "text is required"}, 400
    dept = (data or {}).get("user_dept", "operations")
    retrieve = bool((data or {}).get("retrieve"))
    out = ask_question(text, dept, org_id=g.get("org_id", "default"), retrieve=retrieve)
    return out, 200


@ask_bp.post("/ask")
def ask():
    body, status = handle_ask(request.get_json(force=True, silent=True))
    return jsonify(body), status
