"""Tool endpoints — thin routes, logic lives in tools/factory.py + tools/runner.py."""
from flask import Blueprint, jsonify, request
from tools.runner import run_python
from tools.factory import create_tool, list_tools

tool_bp = Blueprint("tools", __name__)


def handle_run(data):
    return run_python(data.get("code", ""))


def handle_create(data):
    return create_tool(data.get("name", "custom_tool"),
                       data.get("code", ""),
                       data.get("sample_input", ""))


@tool_bp.post("/tools/run")
def run():
    return jsonify(handle_run(request.get_json(force=True)))


@tool_bp.post("/tools/create")
def create():
    return jsonify(handle_create(request.get_json(force=True)))


@tool_bp.get("/tools")
def list_all():
    return jsonify({"tools": list_tools()})
