-- Inventory Service schema (Flyway runs this inside the `inventory` schema).
-- All money is NUMERIC(12,2) BDT; timestamps are timestamptz to match Hibernate's Instant mapping.
-- Tables follow the design ER diagram (Data Models -> Inventory Service).

CREATE TABLE supplier_profile (
    id                  UUID PRIMARY KEY,
    user_id             UUID NOT NULL,
    business_name       VARCHAR(255) NOT NULL,
    trade_license_no    VARCHAR(255),
    bank_account        VARCHAR(255),
    verification_status VARCHAR(255) NOT NULL,
    rejection_reason    VARCHAR(255)
);
CREATE INDEX idx_supplier_profile_user ON supplier_profile (user_id);

CREATE TABLE product (
    id              UUID PRIMARY KEY,
    supplier_id     UUID NOT NULL REFERENCES supplier_profile (id),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    category        VARCHAR(255) NOT NULL,
    base_price      NUMERIC(12, 2) NOT NULL,
    moq             INTEGER NOT NULL,
    available_stock INTEGER NOT NULL,
    status          VARCHAR(255) NOT NULL,
    avg_rating      NUMERIC(3, 2),
    updated_at      TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_product_supplier ON product (supplier_id);
CREATE INDEX idx_product_status ON product (status);

CREATE TABLE pricing_tier (
    id         UUID PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES product (id),
    min_qty    INTEGER NOT NULL,
    max_qty    INTEGER NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL
);
CREATE INDEX idx_pricing_tier_product ON pricing_tier (product_id);

CREATE TABLE product_image (
    id         UUID PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES product (id),
    url        VARCHAR(1024) NOT NULL,
    sort_order INTEGER NOT NULL
);
CREATE INDEX idx_product_image_product ON product_image (product_id);

CREATE TABLE cart (
    id          UUID PRIMARY KEY,
    retailer_id UUID NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_cart_retailer ON cart (retailer_id);

CREATE TABLE cart_item (
    id                  UUID PRIMARY KEY,
    cart_id             UUID NOT NULL REFERENCES cart (id),
    product_id          UUID NOT NULL REFERENCES product (id),
    supplier_id         UUID NOT NULL,
    quantity            INTEGER NOT NULL,
    resolved_unit_price NUMERIC(12, 2) NOT NULL,
    subtotal            NUMERIC(12, 2) NOT NULL,
    reservation_id      VARCHAR(255)
);
CREATE INDEX idx_cart_item_cart ON cart_item (cart_id);

CREATE TABLE orders (
    id          UUID PRIMARY KEY,
    retailer_id UUID NOT NULL,
    order_total NUMERIC(12, 2) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_orders_retailer ON orders (retailer_id);

CREATE TABLE sub_order (
    id                 UUID PRIMARY KEY,
    order_id           UUID NOT NULL REFERENCES orders (id),
    supplier_id        UUID NOT NULL,
    retailer_id        UUID NOT NULL,
    sub_order_total    NUMERIC(12, 2) NOT NULL,
    status             VARCHAR(255) NOT NULL,
    tracking_reference VARCHAR(255),
    status_changed_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_sub_order_order ON sub_order (order_id);
CREATE INDEX idx_sub_order_supplier ON sub_order (supplier_id);

CREATE TABLE order_line (
    id            UUID PRIMARY KEY,
    sub_order_id  UUID NOT NULL REFERENCES sub_order (id),
    product_id    UUID NOT NULL,
    quantity      INTEGER NOT NULL,
    unit_price    NUMERIC(12, 2) NOT NULL,
    line_subtotal NUMERIC(12, 2) NOT NULL
);
CREATE INDEX idx_order_line_sub_order ON order_line (sub_order_id);

CREATE TABLE status_history (
    id           UUID PRIMARY KEY,
    sub_order_id UUID NOT NULL REFERENCES sub_order (id),
    status       VARCHAR(255) NOT NULL,
    changed_at   TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_status_history_sub_order ON status_history (sub_order_id);

CREATE TABLE review (
    id          UUID PRIMARY KEY,
    product_id  UUID NOT NULL REFERENCES product (id),
    retailer_id UUID NOT NULL,
    rating      INTEGER NOT NULL,
    body        TEXT,
    hidden      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_review_product ON review (product_id);
