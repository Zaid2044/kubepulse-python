import time
import logging
from flask import Flask, jsonify, Response
from flask_cors import CORS
from config import Config
from models import db
from routes import products_bp
from prometheus_client import Counter, generate_latest, CONTENT_TYPE_LATEST

REQUESTS = Counter(
    "app_requests_total",
    "Total application requests"
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

logger = logging.getLogger(__name__)

APP_START_TIME = time.time()


def create_app():
    app = Flask(__name__)

    app.config.from_object(Config)

    CORS(app, resources={r"/*": {"origins": "*"}})

    db.init_app(app)

    app.register_blueprint(products_bp)

    @app.before_request
    def count_requests():
        REQUESTS.inc()

    @app.route("/health")
    def health():
        return jsonify({"status": "healthy"}), 200

    @app.route("/app-metrics")
    def app_metrics():
        from models import Product

        db_status = "connected"
        total_products = 0

        try:
            total_products = Product.query.count()
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            db_status = "disconnected"

        uptime_seconds = round(time.time() - APP_START_TIME, 2)

        return jsonify({
            "success": True,
            "data": {
                "total_products": total_products,
                "database_status": db_status,
                "uptime_seconds": uptime_seconds,
            }
        }), 200

    @app.route("/metrics")
    def metrics():
        return Response(
            generate_latest(),
            mimetype=CONTENT_TYPE_LATEST
        )

    with app.app_context():
        db.create_all()
        logger.info("Database tables verified/created successfully.")

    logger.info("Flask application initialized successfully.")

    return app


app = create_app()

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=Config.DEBUG
    )