"""BigBrain Flask app — only wires blueprints. No business logic here."""
import os
from flask import Flask, g, jsonify, request
from flask_cors import CORS

from routes.health_routes import health_bp
from routes.ask_routes import ask_bp
from routes.tool_routes import tool_bp
from routes.docs_routes import docs_bp
from auth.routes import auth_bp
from chat.routes import chat_bp

ALLOWED_ORIGINS = ["http://localhost:3000"]


def create_app():
    app = Flask(__name__)
    app.secret_key = os.getenv("SECRET_KEY", "dev-secret-change-me")
    CORS(app, origins=ALLOWED_ORIGINS, supports_credentials=True)

    @app.before_request
    def stash_org():
        g.org_id = request.headers.get("X-Org-Id", "default")

    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({"error": "bad request"}), 400

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "not found"}), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"error": "internal error"}), 500

    app.register_blueprint(health_bp)
    app.register_blueprint(ask_bp)
    app.register_blueprint(tool_bp)
    app.register_blueprint(docs_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(chat_bp)
    return app


app = create_app()

if __name__ == "__main__":
    # debug=True with reloader causes endless restarts when torch/tf site-packages change
    app.run(port=8000, debug=True, use_reloader=False)
