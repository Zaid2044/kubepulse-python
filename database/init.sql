-- ─────────────────────────────────────────────────────────────────────────────
-- database/init.sql
-- PostgreSQL Database Initialization Script
--
-- This script runs automatically when the PostgreSQL container starts
-- for the FIRST time (via the docker-entrypoint-initdb.d/ mechanism).
-- It seeds the database with sample data so you can explore the app
-- immediately after docker compose up.
-- ─────────────────────────────────────────────────────────────────────────────

-- Create the products table
-- SQLAlchemy also creates this via db.create_all(), but having it here
-- ensures the schema exists before the backend connects on first run.
CREATE TABLE IF NOT EXISTS products (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    category    VARCHAR(100),
    quantity    INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    price       DOUBLE PRECISION NOT NULL DEFAULT 0.0 CHECK (price >= 0),
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index on category for faster category-based filtering
CREATE INDEX IF NOT EXISTS ix_products_category ON products (category);

-- ─── Seed Data ────────────────────────────────────────────────────────────────
-- Insert sample products so the dashboard isn't empty on first run.
INSERT INTO products (name, description, category, quantity, price) VALUES
    ('MacBook Pro 14"',      'Apple M3 Pro chip, 18GB RAM, 512GB SSD',          'Electronics',  12,  1999.00),
    ('Sony WH-1000XM5',      'Wireless noise-cancelling headphones',             'Electronics',   8,   349.99),
    ('Standing Desk Pro',    'Electric height-adjustable, 60" wide',             'Furniture',     5,   699.00),
    ('Ergonomic Chair',      'Mesh back, lumbar support, adjustable armrests',   'Furniture',     3,   489.00),
    ('USB-C Hub 10-in-1',    '4K HDMI, 100W PD, SD card reader',                'Electronics',  45,    59.99),
    ('Mechanical Keyboard',  'Gateron Red switches, RGB backlight, TKL layout',  'Electronics',  20,   129.99),
    ('Logitech MX Master 3', 'Wireless ergonomic mouse, 70-day battery',         'Electronics',  30,    99.99),
    ('27" 4K Monitor',       'IPS panel, 144Hz, USB-C 90W charging',            'Electronics',   7,   599.00),
    ('VESA Monitor Arm',     'Single monitor arm, full motion, 9kg capacity',    'Furniture',    18,    49.99),
    ('Webcam 4K',            'Wide-angle lens, built-in ring light, auto-focus', 'Electronics',  14,   149.00),
    ('Notebook A5 Pack',     'Dotted grid, 160 pages, 3-pack',                  'Stationery',   80,    22.99),
    ('Whiteboard 48x36"',    'Magnetic dry-erase board with aluminum frame',    'Office',        6,   109.00),
    ('Cable Management Kit', 'Velcro straps, cable clips, cable sleeves bundle', 'Accessories',  60,    18.99),
    ('Desk Mat XL',          'Non-slip base, stitched edges, 90x40cm',          'Accessories',  25,    34.99),
    ('LED Desk Lamp',        'Wireless charging base, 5 brightness levels',     'Electronics',  11,    79.99)
ON CONFLICT DO NOTHING;

-- Log that initialization completed
DO $$
BEGIN
    RAISE NOTICE 'Database initialized with % products.', (SELECT COUNT(*) FROM products);
END $$;
