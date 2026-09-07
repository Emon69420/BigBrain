"""Tool endpoints — thin routes, logic lives in tools/factory.py + tools/runner.py."""
from flask import Blueprint, jsonify, request
from tools.runner import run_python, run_tool
from tools.factory import create_tool, list_tools, list_registry, find_tool

tool_bp = Blueprint("tools", __name__)


def handle_run(data):
    # run by saved name (persisted tool) if name given, else raw code
    if data.get("name"):
        return run_tool(data.get("name"), data.get("args", data.get("sample_input", None)))
    return run_python(data.get("code", ""))


def handle_create(data):
    # sample_input may be list/dict for multi-arg tools; keep None if absent
    return create_tool(data.get("name", "custom_tool"),
                       data.get("code", ""),
                       data.get("sample_input", data.get("args", None)))


@tool_bp.post("/tools/run")
def run():
    return jsonify(handle_run(request.get_json(force=True) or {}))


@tool_bp.post("/tools/create")
def create():
    return jsonify(handle_create(request.get_json(force=True) or {}))


@tool_bp.get("/tools")
def list_all():
    # enriched registry + simple list for compat
    return jsonify({"tools": list_tools(), "registry": list_registry()})


@tool_bp.get("/tools/find")
def find():
    q = request.args.get("q", "")
    hit = find_tool(q)
    return jsonify({"query": q, "hit": hit})


def handle_ensure(data):
    from tools.builder import ensure_tool
    task = (data.get("task") or data.get("q") or "").strip()
    if not task:
        return {"error": "task is required"}, 400
    res = ensure_tool(task, data.get("sample_input", data.get("args", None)), created_by=data.get("created_by", "agent"))
    # ensure_tool already logged via its groq calls (via brain service), trace returned for demo
    return res, 200


@tool_bp.post("/tools/ensure")
def ensure():
    body, status = handle_ensure(request.get_json(force=True) or {})
    return jsonify(body), status
