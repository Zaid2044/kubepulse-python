# ─── Backend Dockerfile ───────────────────────────────────────────────────────
# Builds the Python Flask API container.
# Uses a lightweight Python base image to keep the image small.

# Start from the official Python 3.12 slim image
# "slim" = Debian-based but with fewer pre-installed packages → smaller image
FROM python:3.12-slim

# Set the working directory inside the container
# All subsequent commands run from here
WORKDIR /app

# ─── Install System Dependencies ──────────────────────────────────────────────
# We need gcc and libpq-dev to compile psycopg2 (PostgreSQL driver)
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*
# Clean up apt cache to reduce image size

# ─── Install Python Dependencies ──────────────────────────────────────────────
# Copy requirements FIRST (before source code).
# Docker caches layers — if requirements.txt doesn't change,
# this expensive pip install step is skipped on rebuilds.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ─── Copy Application Source ──────────────────────────────────────────────────
# Copy the rest of the backend code into the container
COPY . .

# ─── Environment Defaults ─────────────────────────────────────────────────────
ENV FLASK_APP=app.py
ENV FLASK_DEBUG=false
ENV PYTHONUNBUFFERED=1
# PYTHONUNBUFFERED=1 ensures print/log output appears immediately in Docker logs

# ─── Expose Port ──────────────────────────────────────────────────────────────
EXPOSE 5000

# ─── Startup Command ──────────────────────────────────────────────────────────
# Use gunicorn (production WSGI server) instead of Flask dev server.
# --workers 2: 2 worker processes handle requests concurrently
# --bind 0.0.0.0:5000: listen on all network interfaces at port 5000
# app:create_app(): calls the create_app() factory in app.py
CMD ["gunicorn", "--workers", "2", "--bind", "0.0.0.0:5000", "--timeout", "120", "--access-logfile", "-", "app:create_app()"]
