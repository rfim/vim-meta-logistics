-- FIFO pick: oldest available lot first, until the order is filled.
-- PostgreSQL. The same logic runs on the Spares page and in the notebook.

WITH ranked AS (
  SELECT h.lot_id, l.received_at, h.qty_on_hand,
         SUM(h.qty_on_hand) OVER (ORDER BY l.received_at, h.lot_id
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running
  FROM   lot_on_hand h
  JOIN   lot l USING (lot_id)
  WHERE  l.product_id = :product_id
    AND  h.loc        = :location
    AND  l.status     = 'available'               -- on_hold and recalled lots are never picked
)
SELECT lot_id, received_at,
       LEAST(qty_on_hand, :order_qty - (running - qty_on_hand)) AS pick_qty
FROM   ranked
WHERE  running - qty_on_hand < :order_qty          -- only the lots needed to cover the order
ORDER  BY received_at, lot_id;

-- Check: FIFO was followed. Any pick from a newer lot while an older one had stock is a breach.
SELECT m.move_id, m.lot_id, m.moved_at
FROM   stock_move m
JOIN   lot l ON l.lot_id = m.lot_id
WHERE  m.to_loc IS NULL                            -- consumed
  AND  EXISTS (
         SELECT 1 FROM lot o
         JOIN   lot_on_hand h ON h.lot_id = o.lot_id AND h.loc = m.from_loc
         WHERE  o.product_id = l.product_id
           AND  o.received_at < l.received_at
           AND  o.status = 'available');
