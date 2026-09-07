"""Health endpoint — thin route, logic lives in service."""
from flask import Blueprint, jsonify
from brain.service import get_router_info

health_bp = Blueprint("health", __name__)


def build_health():
    return {"ok": True, "router": get_router_info()}


@health_bp.get("/health")
def health():
    return jsonify(build_health())
