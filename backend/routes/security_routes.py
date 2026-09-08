"""Security endpoints — thin routes, logic lives in security/service.py."""
import os
from flask import Blueprint, g, jsonify, request
from security.service import status, guarded_fetch, BlockedEgress, MODEL_API_HOST

security_bp = Blueprint("security", __name__)

DEMO_TARGET = os.getenv("DEMO_EGRESS_TARGET", "https://example.com/healthz")


def _org():
    return g.get("org_id", "default") or "default"


@security_bp.get("/security/status")
def get_status():
    return jsonify({"org_id": _org(), **status(_org())})


@security_bp.post("/security/demo-egress")
def demo_egress():
    """SIH demo trigger: attempt a fetch to a non-allowlisted host through the
    guard. Expected outcome is denial + a ledger row — proof the deny path works."""
    d = request.get_json(force=True, silent=True) or {}
    target = (d.get("target") or DEMO_TARGET).strip()
    try:
        guarded_fetch(target, source="demo-trigger")
        return jsonify({"blocked": False, "target": target, "note": "target was allowlisted, nothing to deny"})
    except BlockedEgress as e:
        return jsonify({"blocked": True, "target": target, "host": e.host}), 200


@security_bp.get("/security/allowlist")
def allowlist():
    """Declares exactly what may leave the machine. Rendered verbatim in the UI."""
    return jsonify({
        "local": ["localhost", "127.0.0.1", "::1"],
        "model_api": MODEL_API_HOST,
        "policy": "deny-by-default; denials are recorded before any socket opens",
    })
