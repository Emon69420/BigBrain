"""Ask endpoint — thin route, logic lives in brain/service.py."""
from flask import Blueprint, jsonify, request
from brain.service import ask_question

ask_bp = Blueprint("ask", __name__)


def handle_ask(data):
    text = data.get("text", "")
    dept = data.get("user_dept", "operations")
    return ask_question(text, dept)


@ask_bp.post("/ask")
def ask():
    return jsonify(handle_ask(request.get_json(force=True)))
