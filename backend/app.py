"""BigBrain Flask app — only wires blueprints. No business logic here."""
from flask import Flask
from flask_cors import CORS

from routes.health_routes import health_bp
from routes.ask_routes import ask_bp
from routes.tool_routes import tool_bp


def create_app():
    app = Flask(__name__)
    CORS(app)
    app.register_blueprint(health_bp)
    app.register_blueprint(ask_bp)
    app.register_blueprint(tool_bp)
    return app


app = create_app()

if __name__ == "__main__":
    app.run(port=8000, debug=True)
