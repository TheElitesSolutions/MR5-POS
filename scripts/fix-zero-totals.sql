-- Migration script to fix orders with $0.00 totals
-- This recalculates order totals from their items

-- Show orders that will be fixed
SELECT
    o.orderNumber,
    o.total as current_total,
    (SELECT SUM(totalPrice) FROM order_items WHERE orderId = o.id) as calculated_total
FROM orders o
WHERE o.total = 0
    AND EXISTS (
        SELECT 1 FROM order_items oi WHERE oi.orderId = o.id
    );

-- Update orders with correct totals (including delivery fee)
UPDATE orders
SET
    subtotal = (SELECT SUM(totalPrice) FROM order_items WHERE orderId = orders.id),
    total = (SELECT SUM(totalPrice) FROM order_items WHERE orderId = orders.id) + COALESCE(deliveryFee, 0)
WHERE total = 0
    AND EXISTS (
        SELECT 1 FROM order_items oi WHERE oi.orderId = orders.id
    );

-- Verify the fix
SELECT
    COUNT(*) as fixed_orders_count,
    SUM(total) as total_recovered_amount
FROM orders
WHERE id IN (
    SELECT o.id
    FROM orders o
    WHERE EXISTS (SELECT 1 FROM order_items WHERE orderId = o.id)
        AND o.total > 0
);
