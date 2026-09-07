"""Doc endpoints — thin routes, logic lives in data/service.py."""
from flask import Blueprint, g, jsonify, request
from data.service import ingest_doc, list_docs

docs_bp = Blueprint("docs", __name__)


def handle_ingest(data):
    org_id = g.get("org_id", "default")
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
    return jsonify({"org_id": g.get("org_id", "default"),
                    "docs": list_docs(g.get("org_id", "default"))})
