"""
config.py - Centralized Application Configuration

All environment variables and settings live here.
Change behavior by setting environment variables — no code changes needed.
"""

import os


class Config:
    """
    Application configuration class.
    Reads values from environment variables with sensible defaults.
    In Docker, these come from docker-compose.yml or a .env file.
    """

    # ─── Database ─────────────────────────────────────────────────────────────
    # Full PostgreSQL connection string, e.g.:
    # postgresql://user:password@hostname:5432/dbname
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        "postgresql://inventory_user:inventory_pass@localhost:5432/inventory_db"
    )

    # Disable SQLAlchemy event system (saves memory; we don't need it)
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # ─── Flask ────────────────────────────────────────────────────────────────
    # Secret key for sessions/cookies. Override this in production!
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")

    # Debug mode: True locally, False in production
    DEBUG = os.environ.get("FLASK_DEBUG", "false").lower() == "true"

    # ─── App Settings ─────────────────────────────────────────────────────────
    # How many times to retry DB connection on startup
    DB_CONNECT_RETRIES = int(os.environ.get("DB_CONNECT_RETRIES", "10"))

    # Seconds to wait between DB connection retries
    DB_CONNECT_RETRY_DELAY = int(os.environ.get("DB_CONNECT_RETRY_DELAY", "3"))
