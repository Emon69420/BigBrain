"""Dashboard Maker endpoints — thin routes, logic lives in data/dashboards.py."""
from flask import Blueprint, g, jsonify, request, session
from auth.service import is_member as _is_member
from data import dashboards as boards

dashboard_bp = Blueprint("dashboard", __name__)


def _require_org():
    uid = session.get("user_id")
    if not uid:
        return False, (jsonify({"error": "not authenticated"}), 401), None
    org = g.get("org_id", "default")
    if not _is_member(uid, org):
        return False, (jsonify({"error": "not a member of this org"}), 403), None
    return True, org, uid


def _bad(msg):
    return jsonify({"error": msg}), 400


@dashboard_bp.get("/dashboards")
def list_all():
    ok, res, _ = _require_org()
    if not ok:
        return res
    return jsonify({"dashboards": boards.list_dashboards(res)})


@dashboard_bp.post("/dashboards/propose")
def propose():
    ok, res, uid = _require_org()
    if not ok:
        return res
    body = request.get_json(force=True, silent=True) or {}
    try:
        b = boards.propose_dashboard(
            res, body.get("name", ""),
            zone=body.get("zone", ""),
            metrics=body.get("metrics", []),
            created_by=uid)
    except ValueError as e:
        return _bad(str(e))
    return jsonify(b), 201


@dashboard_bp.get("/dashboards/<board_id>")
def one(board_id):
    ok, res, _ = _require_org()
    if not ok:
        return res
    b = boards.get_latest(board_id, res)
    if not b:
        return jsonify({"error": "not found"}), 404
    return jsonify(b)


@dashboard_bp.patch("/dashboards/<board_id>")
def update(board_id):
    ok, res, _ = _require_org()
    if not ok:
        return res
    body = request.get_json(force=True, silent=True) or {}
    try:
        b = boards.update_dashboard(
            board_id, res,
            name=body.get("name"), zone=body.get("zone"),
            metrics=body.get("metrics") if "metrics" in body else None)
    except ValueError as e:
        return _bad(str(e))
    if not b:
        return jsonify({"error": "not found"}), 404
    return jsonify(b)


@dashboard_bp.post("/dashboards/<board_id>/finalize")
def finalize(board_id):
    ok, res, _ = _require_org()
    if not ok:
        return res
    try:
        b = boards.finalize_dashboard(board_id, res)
    except ValueError as e:
        return _bad(str(e))
    if not b:
        return jsonify({"error": "not found"}), 404
    return jsonify(b)


@dashboard_bp.post("/dashboards/<board_id>/readings")
def submit(board_id):
    ok, res, uid = _require_org()
    if not ok:
        return res
    body = request.get_json(force=True, silent=True) or {}
    try:
        n = boards.submit_readings(board_id, res, body.get("values", []),
                                   recorded_by=uid)
    except ValueError as e:
        return _bad(str(e))
    if n is None:
        return jsonify({"error": "not found"}), 404
    return jsonify({"saved": n})


@dashboard_bp.get("/dashboards/<board_id>/history")
def history(board_id):
    ok, res, _ = _require_org()
    if not ok:
        return res
    metric = request.args.get("metric", "")
    days = request.args.get("days", "30")
    h = boards.get_history(board_id, res, metric, days)
    if h is None:
        return jsonify({"error": "not found"}), 404
    return jsonify({"readings": h})
