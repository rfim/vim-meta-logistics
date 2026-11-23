// Toast, step by step, on real PostgreSQL (PGlite runs Postgres in the browser).
// Synthetic sample: names and numbers are made up. Lot traceability is a concept in Toast.
import type { Step } from "../components/Runner";

export const TOAST_STEPS: Step[] = [
  {
    title: "Create the ERP tables and the audit trail",
    why: "Suppliers and products, plus one append-only audit table. A trigger writes every change there, so no code path can skip it. A second trigger rejects any AI assistant's change that no person approved.",
    code: `CREATE TABLE supplier (
  supplier_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text    NOT NULL,
  country     char(2) NOT NULL,
  status      text    NOT NULL DEFAULT 'pending'
);
CREATE TABLE product (
  product_id  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku         text NOT NULL UNIQUE,
  name        text NOT NULL,
  supplier_id bigint NOT NULL REFERENCES supplier,
  unit_price  numeric(12,2) NOT NULL CHECK (unit_price >= 0)
);
CREATE TABLE audit_event (
  event_id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name  text NOT NULL,
  row_id      bigint NOT NULL,
  action      text NOT NULL,
  changed_by  text NOT NULL,
  changed_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
  before      jsonb,
  after       jsonb,
  approved_by text
);

CREATE FUNCTION write_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO audit_event (table_name, row_id, action, changed_by, before, after, approved_by)
  VALUES (TG_TABLE_NAME,
          COALESCE((to_jsonb(NEW) ->> TG_ARGV[0])::bigint, (to_jsonb(OLD) ->> TG_ARGV[0])::bigint),
          TG_OP, current_setting('app.user', true),
          CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
          CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END,
          NULLIF(current_setting('app.approved_by', true), ''));
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE FUNCTION require_human_approval() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.user', true) LIKE 'assistant:%'
     AND COALESCE(current_setting('app.approved_by', true), '') = '' THEN
    RAISE EXCEPTION 'AI change to % needs a human approver', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER audit_supplier AFTER INSERT OR UPDATE OR DELETE ON supplier
  FOR EACH ROW EXECUTE FUNCTION write_audit('supplier_id');
CREATE TRIGGER audit_product AFTER INSERT OR UPDATE OR DELETE ON product
  FOR EACH ROW EXECUTE FUNCTION write_audit('product_id');
CREATE TRIGGER human_gate BEFORE INSERT OR UPDATE ON product
  FOR EACH ROW EXECUTE FUNCTION require_human_approval();

SELECT 'tables and triggers ready' AS status;`,
  },
  {
    title: "A buyer adds a supplier and two products",
    why: "Every write says who is making it. The trigger records it without the app having to remember.",
    code: `SELECT set_config('app.user', 'buyer:amira', false);

INSERT INTO supplier (name, country, status) VALUES ('Kopi Nusantara', 'ID', 'approved');
INSERT INTO product (sku, name, supplier_id, unit_price) VALUES
  ('BEAN-GAYO-1KG',   'Gayo Arabica 1 kg',   1, 24.50),
  ('BEAN-TORAJA-1KG', 'Toraja Arabica 1 kg', 1, 27.00);

SELECT table_name, row_id, action, changed_by, after ->> 'name' AS name
FROM audit_event ORDER BY event_id;`,
  },
  {
    title: "Change a price, then ask who touched it last",
    why: "The operating principle in one query: where is it, who touched it last, and what changed.",
    code: `SELECT set_config('app.user', 'buyer:amira', false);
UPDATE product SET unit_price = 26.00 WHERE sku = 'BEAN-GAYO-1KG';

SELECT changed_at::time(0) AS at, changed_by, action,
       before ->> 'unit_price' AS price_before,
       after  ->> 'unit_price' AS price_after
FROM audit_event
WHERE table_name = 'product' AND row_id = 1
ORDER BY event_id DESC;`,
  },
  {
    title: "An AI assistant tries a change with no approval",
    why: "The guardrail lives in the database, not just in the app. Expect an error: that's the point.",
    code: `SELECT set_config('app.user', 'assistant:procurement', false);
SELECT set_config('app.approved_by', '', false);

UPDATE product SET unit_price = 21.00 WHERE sku = 'BEAN-GAYO-1KG';`,
    expectError: true,
  },
  {
    title: "The same change, approved by a person",
    why: "Once a person approves it, the change goes through, and the audit trail shows both the assistant and the approver.",
    code: `SELECT set_config('app.user', 'assistant:procurement', false);
SELECT set_config('app.approved_by', 'ops-lead:dewi', false);

UPDATE product SET unit_price = 25.00 WHERE sku = 'BEAN-GAYO-1KG';

SELECT changed_by, approved_by, before ->> 'unit_price' AS price_before, after ->> 'unit_price' AS price_after
FROM audit_event WHERE table_name = 'product' AND row_id = 1
ORDER BY event_id DESC LIMIT 2;`,
  },
  {
    title: "Lots and stock moves (concept)",
    why: "Stock is derived from moves, so there's no quantity column to drift. Each bag's lot is its QR bean passport.",
    code: `CREATE TABLE lot (
  lot_id      text PRIMARY KEY,
  product_id  bigint NOT NULL REFERENCES product,
  origin      text NOT NULL,
  roast_date  date,
  received_at date NOT NULL,
  status      text NOT NULL DEFAULT 'available'
);
CREATE TABLE stock_move (
  move_id  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lot_id   text NOT NULL REFERENCES lot,
  from_loc text,            -- NULL = received
  to_loc   text,            -- NULL = used in a drink
  qty      numeric(12,3) NOT NULL CHECK (qty > 0),
  order_id text
);
CREATE VIEW lot_on_hand AS
SELECT lot_id, loc, SUM(qty) AS qty_on_hand FROM (
  SELECT lot_id, to_loc AS loc, qty FROM stock_move WHERE to_loc IS NOT NULL
  UNION ALL
  SELECT lot_id, from_loc, -qty FROM stock_move WHERE from_loc IS NOT NULL
) m GROUP BY lot_id, loc HAVING SUM(qty) > 0;

INSERT INTO lot VALUES
  ('L-0718', 1, 'Gayo, Aceh', '2026-07-10', '2026-07-18', 'available'),
  ('L-0803', 1, 'Gayo, Aceh', '2026-07-28', '2026-08-03', 'available'),
  ('L-0920', 1, 'Gayo, Aceh', '2026-09-12', '2026-09-20', 'available'),
  ('L-1011', 1, 'Gayo, Aceh', '2026-10-02', '2026-10-11', 'available');
INSERT INTO stock_move (lot_id, from_loc, to_loc, qty, order_id) VALUES
  ('L-0718', NULL, 'London-Bar', 24, NULL), ('L-0803', NULL, 'London-Bar', 40, NULL),
  ('L-0920', NULL, 'London-Bar', 40, NULL), ('L-1011', NULL, 'London-Bar', 60, NULL),
  ('L-0718', 'London-Bar', NULL, 0.018, 'ORD-5531'), ('L-0718', 'London-Bar', NULL, 0.018, 'ORD-5532');

SELECT h.lot_id, l.received_at, h.loc, h.qty_on_hand
FROM lot_on_hand h JOIN lot l USING (lot_id) ORDER BY l.received_at;`,
  },
  {
    title: "FIFO pick: 50 kg, oldest lot first",
    why: "A running total over lots ordered by receipt date picks only the lots needed to cover the order.",
    code: `WITH ranked AS (
  SELECT h.lot_id, l.received_at, h.qty_on_hand,
         SUM(h.qty_on_hand) OVER (ORDER BY l.received_at, h.lot_id) AS running
  FROM lot_on_hand h JOIN lot l USING (lot_id)
  WHERE l.product_id = 1 AND h.loc = 'London-Bar' AND l.status = 'available'
)
SELECT lot_id, received_at, qty_on_hand,
       LEAST(qty_on_hand, 50 - (running - qty_on_hand)) AS pick_qty
FROM ranked
WHERE running - qty_on_hand < 50
ORDER BY received_at, lot_id;`,
  },
  {
    title: "Recall a lot: which orders used it?",
    why: "Because every move records its lot, a recall reaches every order within seconds, not days.",
    code: `UPDATE lot SET status = 'recalled' WHERE lot_id = 'L-0718';

SELECT DISTINCT m.order_id, l.lot_id, l.origin, l.roast_date
FROM stock_move m JOIN lot l USING (lot_id)
WHERE m.lot_id = 'L-0718' AND m.to_loc IS NULL AND m.order_id IS NOT NULL
ORDER BY m.order_id;`,
  },
];
