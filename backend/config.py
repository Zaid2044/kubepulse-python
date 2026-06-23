import os

class Config:
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        "postgresql://inventory_user:inventory_pass@localhost:5432/inventory_db"
    )

    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")
    DEBUG = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    DB_CONNECT_RETRIES = int(os.environ.get("DB_CONNECT_RETRIES", "10"))
    DB_CONNECT_RETRY_DELAY = int(os.environ.get("DB_CONNECT_RETRY_DELAY", "3"))