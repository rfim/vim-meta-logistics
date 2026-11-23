-- Toast · lot traceability, bag to cup (CONCEPT) · a QR "bean passport" per lot
-- PostgreSQL. Lot traceability in Toast is a concept; this is how I'd model it.

CREATE TABLE lot (
  lot_id        text        PRIMARY KEY,          -- printed on the bag as a QR code
  product_id    bigint      NOT NULL REFERENCES product,
  origin        text        NOT NULL,             -- farm / region
  roast_date    date,
  received_at   timestamptz NOT NULL,
  qty_received  numeric(12,3) NOT NULL CHECK (qty_received > 0),
  status        text        NOT NULL DEFAULT 'available' CHECK (status IN ('available','on_hold','recalled','used'))
);

CREATE TABLE stock_move (
  move_id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lot_id        text        NOT NULL REFERENCES lot,
  from_loc      text,                             -- NULL = received from supplier
  to_loc        text,                             -- NULL = consumed (sold in a drink)
  qty           numeric(12,3) NOT NULL CHECK (qty > 0),
  order_id      text,                             -- set when consumed by an order
  moved_by      text        NOT NULL,
  moved_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON stock_move (lot_id, moved_at);

-- On hand per lot and location, from the moves (no mutable "quantity" column to drift)
CREATE VIEW lot_on_hand AS
SELECT lot_id, loc, SUM(qty) AS qty_on_hand
FROM (
  SELECT lot_id, to_loc AS loc,  qty FROM stock_move WHERE to_loc   IS NOT NULL
  UNION ALL
  SELECT lot_id, from_loc,      -qty FROM stock_move WHERE from_loc IS NOT NULL
) m
GROUP BY lot_id, loc
HAVING SUM(qty) > 0;

-- The bean passport: scan a cup's order, get the whole path back to the farm
SELECT o.order_id, l.lot_id, l.origin, l.roast_date, l.received_at,
       array_agg(DISTINCT m.to_loc) FILTER (WHERE m.to_loc IS NOT NULL) AS path,
       max(m.moved_at) AS last_touched, (array_agg(m.moved_by ORDER BY m.moved_at DESC))[1] AS last_touched_by
FROM   stock_move o
JOIN   lot l        ON l.lot_id = o.lot_id
JOIN   stock_move m ON m.lot_id = o.lot_id AND m.moved_at <= o.moved_at
WHERE  o.order_id = :order_id
GROUP  BY o.order_id, l.lot_id, l.origin, l.roast_date, l.received_at;

-- Recall: every order that used a lot, so venues can be told within minutes
UPDATE lot SET status = 'recalled' WHERE lot_id = :lot_id;
SELECT DISTINCT order_id, moved_at FROM stock_move
WHERE  lot_id = :lot_id AND to_loc IS NULL AND order_id IS NOT NULL
ORDER  BY moved_at;
