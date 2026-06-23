"""
models.py - Database Models

Defines the Product table using SQLAlchemy ORM.
SQLAlchemy translates Python classes → SQL tables automatically.
"""

from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

# Create the SQLAlchemy instance.
# This gets initialized with the Flask app in app.py via db.init_app(app).
db = SQLAlchemy()


class Product(db.Model):
    """
    Product model — maps to the 'products' table in PostgreSQL.

    Each attribute below becomes a column in the database table.
    SQLAlchemy handles CREATE TABLE, INSERT, SELECT, UPDATE, DELETE for us.
    """

    __tablename__ = "products"  # Explicit table name (good practice)

    # ─── Columns ──────────────────────────────────────────────────────────────

    # Primary key: auto-incremented integer ID for each product
    id = db.Column(db.Integer, primary_key=True)

    # Product name — required, must be unique
    name = db.Column(db.String(200), nullable=False)

    # Optional description
    description = db.Column(db.Text, nullable=True)

    # Category — optional, e.g. "Electronics", "Clothing"
    category = db.Column(db.String(100), nullable=True)

    # Stock quantity — must be 0 or more
    quantity = db.Column(db.Integer, nullable=False, default=0)

    # Price per unit — stored as float, must be 0 or more
    price = db.Column(db.Float, nullable=False, default=0.0)

    # Timestamp: automatically set when record is first created
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Timestamp: automatically updated whenever record is saved
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    # ─── Index ────────────────────────────────────────────────────────────────
    # Index on category speeds up queries like "show all Electronics"
    __table_args__ = (
        db.Index("ix_products_category", "category"),
    )

    def to_dict(self):
        """
        Converts a Product object to a plain Python dictionary.
        Used to serialize products to JSON in API responses.
        """
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "quantity": self.quantity,
            "price": self.price,
            # Format timestamps as ISO 8601 strings for JSON
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        """String representation for debugging."""
        return f"<Product id={self.id} name={self.name!r}>"
