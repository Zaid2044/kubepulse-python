import time
import logging

from flask import Flask, jsonify, Response, request, g
from flask_cors import CORS

from config import Config
from models import db
from routes import products_bp

from prometheus_client import (
    Counter,
    Histogram,
    Gauge,
    generate_latest,
    CONTENT_TYPE_LATEST
)

HTTP_REQUESTS = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint"]
)

HTTP_RESPONSES = Counter(
    "http_responses_total",
    "Total HTTP responses",
    ["method", "endpoint", "status"]
)

REQUEST_DURATION = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency",
    ["method", "endpoint"]
)

APP_UP = Gauge(
    "app_up",
    "Application availability"
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

    APP_UP.set(1)

    @app.before_request
    def before_request():
        g.start_time = time.time()
        endpoint = request.endpoint or "unknown"
        HTTP_REQUESTS.labels(
            method=request.method,
            endpoint=endpoint
        ).inc()

    @app.after_request
    def after_request(response):
        endpoint = request.endpoint or "unknown"

        HTTP_RESPONSES.labels(
            method=request.method,
            endpoint=endpoint,
            status=response.status_code
        ).inc()

        if hasattr(g, "start_time"):
            REQUEST_DURATION.labels(
                method=request.method,
                endpoint=endpoint
            ).observe(time.time() - g.start_time)

        return response

    @app.route("/live")
    def live():
        return jsonify({
            "status": "alive"
        }), 200

    @app.route("/ready")
    def ready():
        try:
            db.session.execute(db.text("SELECT 1"))
            return jsonify({
                "status": "ready",
                "database": "connected"
            }), 200
        except Exception as e:
            logger.error(f"Readiness check failed: {e}")
            return jsonify({
                "status": "not-ready",
                "database": "disconnected"
            }), 503

    @app.route("/health")
    def health():
        try:
            db.session.execute(db.text("SELECT 1"))
            return jsonify({
                "status": "healthy",
                "database": "connected"
            }), 200
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return jsonify({
                "status": "unhealthy",
                "database": "disconnected"
            }), 503

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
                "uptime_seconds": uptime_seconds
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