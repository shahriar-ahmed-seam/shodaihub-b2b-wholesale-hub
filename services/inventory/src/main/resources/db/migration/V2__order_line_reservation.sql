-- Carry the Redis reservation id from each cart line onto its order line at checkout.
-- Reservations persist (not released) after checkout (Deep-Dive 3; Req 10.4, 11.3), so the order
-- line must remember which reservation backs it. This lets payment confirm convert the reservation
-- to a permanent decrement (Req 7.7) and lets cancellation of a PENDING sub-order release the
-- still-active reservation back to sellable stock (Req 12.5).
ALTER TABLE order_line ADD COLUMN reservation_id VARCHAR(255);
