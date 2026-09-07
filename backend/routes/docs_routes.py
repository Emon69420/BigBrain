"""Doc endpoints — thin routes, logic lives in data/service.py."""
from flask import Blueprint, g, jsonify, request, session
from auth.service import is_member as _is_member
from data.service import ingest_doc, list_docs, delete_doc

docs_bp = Blueprint("docs", __name__)


def _require_org():
    uid = session.get("user_id")
    if not uid:
        return False, jsonify({"error": "not authenticated"}), 401
    org = g.get("org_id", "default")
    if not _is_member(uid, org):
        return False, jsonify({"error": "not a member of this org"}), 403
    return True, org, uid


def handle_ingest(data):
    ok, res, _ = _require_org()
    if not ok:
        return res, res.status_code
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
    ok, res, _ = _require_org()
    if not ok:
        return res
    return jsonify({"org_id": res, "docs": list_docs(res)})


@docs_bp.delete("/docs/<int:doc_id>")
def remove(doc_id):
    ok, res, _ = _require_org()
    if not ok:
        return res
    if not delete_doc(doc_id, res):
        return jsonify({"error": "not found"}), 404
    return jsonify({"ok": True})
