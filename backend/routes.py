import logging
from flask import Blueprint, request, jsonify
from models import db, Product

logger = logging.getLogger(__name__)
products_bp = Blueprint("products", __name__)

def success_response(data, status_code=200):
    return jsonify({"success": True, "data": data}), status_code

def error_response(message, status_code=400):
    return jsonify({"success": False, "message": message}), status_code

def validate_product_data(data, is_update=False):

    errors = []

    name = data.get("name")
    if not is_update and not name:
        errors.append("Product name is required.")
    elif name is not None and not str(name).strip():
        errors.append("Product name cannot be blank.")

    quantity = data.get("quantity")
    if not is_update and quantity is None:
        errors.append("Quantity is required.")
    elif quantity is not None:
        try:
            quantity = int(quantity)
            if quantity < 0:
                errors.append("Quantity cannot be negative.")
        except (ValueError, TypeError):
            errors.append("Quantity must be a whole number.")

    price = data.get("price")
    if not is_update and price is None:
        errors.append("Price is required.")
    elif price is not None:
        try:
            price = float(price)
            if price < 0:
                errors.append("Price cannot be negative.")
        except (ValueError, TypeError):
            errors.append("Price must be a valid number.")

    if errors:
        return None, " | ".join(errors)

    cleaned = {}
    if name is not None:
        cleaned["name"] = str(name).strip()
    if data.get("description") is not None:
        cleaned["description"] = str(data["description"]).strip() or None
    if data.get("category") is not None:
        cleaned["category"] = str(data["category"]).strip() or None
    if quantity is not None:
        cleaned["quantity"] = quantity
    if price is not None:
        cleaned["price"] = round(price, 2)

    return cleaned, None

@products_bp.route("/api/products", methods=["POST"])
def create_product():
    data = request.get_json()
    if not data:
        return error_response("Request body must be valid JSON.", 400)

    cleaned, err = validate_product_data(data, is_update=False)
    if err:
        return error_response(err, 400)

    try:
        product = Product(**cleaned)
        db.session.add(product)
        db.session.commit()
        logger.info(f"Created product id={product.id} name={product.name!r}")
        return success_response(product.to_dict(), 201)

    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to create product: {e}")
        return error_response("Failed to create product. Please try again.", 500)


@products_bp.route("/api/products", methods=["GET"])
def get_products():
    query = Product.query

    category = request.args.get("category")
    if category:
        query = query.filter(Product.category.ilike(f"%{category}%"))

    search = request.args.get("search")
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            db.or_(
                Product.name.ilike(search_term),
                Product.description.ilike(search_term)
            )
        )

    products = query.order_by(Product.created_at.desc()).all()
    return success_response([p.to_dict() for p in products])


@products_bp.route("/api/products/<int:product_id>", methods=["GET"])
def get_product(product_id):
    product = Product.query.get(product_id)
    if not product:
        return error_response(f"Product with id={product_id} not found.", 404)
    return success_response(product.to_dict())


@products_bp.route("/api/products/<int:product_id>", methods=["PUT"])
def update_product(product_id):

    product = Product.query.get(product_id)
    if not product:
        return error_response(f"Product with id={product_id} not found.", 404)

    data = request.get_json()
    if not data:
        return error_response("Request body must be valid JSON.", 400)

    cleaned, err = validate_product_data(data, is_update=True)
    if err:
        return error_response(err, 400)

    if not cleaned:
        return error_response("No valid fields provided for update.", 400)

    try:
        for field, value in cleaned.items():
            setattr(product, field, value)

        from datetime import datetime
        product.updated_at = datetime.utcnow()

        db.session.commit()
        logger.info(f"Updated product id={product.id}")
        return success_response(product.to_dict())

    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to update product id={product_id}: {e}")
        return error_response("Failed to update product. Please try again.", 500)


@products_bp.route("/api/products/<int:product_id>", methods=["DELETE"])
def delete_product(product_id):
    product = Product.query.get(product_id)
    if not product:
        return error_response(f"Product with id={product_id} not found.", 404)

    try:
        product_name = product.name
        db.session.delete(product)
        db.session.commit()
        logger.info(f"Deleted product id={product_id} name={product_name!r}")
        return success_response({"message": f"Product '{product_name}' deleted successfully."})

    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to delete product id={product_id}: {e}")
        return error_response("Failed to delete product. Please try again.", 500)