"""Doc endpoints — thin routes, logic lives in data/service.py + data/graph.py."""
from flask import Blueprint, g, jsonify, request, session
from auth.service import is_member as _is_member
from data.service import ingest_doc, list_docs, delete_doc
from data.graph import get_graph

docs_bp = Blueprint("docs", __name__)


def _require_org():
    uid = session.get("user_id")
    if not uid:
        return False, {"error": "not authenticated"}, 401
    org = g.get("org_id", "default")
    if not _is_member(uid, org):
        return False, {"error": "not a member of this org"}, 403
    return True, org, uid


def handle_ingest(data):
    ok, res, status = _require_org()
    if not ok:
        return res, status
    org_id = res
    content = ((data or {}).get("content") or "").strip()
    if not content:
        return {"error": "content is required"}, 400
    doc_id = ingest_doc(
        title=(data or {}).get("title", "untitled"),
        content=content,
        org_id=org_id,
        dept=(data or {}).get("dept", "operations"),
        doc_class=(data or {}).get("class", "open"),
    )
    return {"id": doc_id, "org_id": org_id}, 201


@docs_bp.post("/docs")
def ingest():
    body, status = handle_ingest(request.get_json(force=True, silent=True))
    return jsonify(body), status


@docs_bp.get("/docs")
def list_all():
    ok, res, status = _require_org()
    if not ok:
        return jsonify(res), status
    return jsonify({"org_id": res, "docs": list_docs(res)})


@docs_bp.delete("/docs/<int:doc_id>")
def remove(doc_id):
    ok, res, status = _require_org()
    if not ok:
        return jsonify(res), status
    if not delete_doc(doc_id, res):
        return jsonify({"error": "not found"}), 404
    return jsonify({"ok": True})


@docs_bp.get("/graph")
def graph():
    ok, res, status = _require_org()
    if not ok:
        return jsonify(res), status
    dept = request.args.get("dept", "operations")
    return jsonify({"org_id": res, **get_graph(res, dept)})
