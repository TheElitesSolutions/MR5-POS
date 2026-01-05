-- Comprehensive diagnostic for delivery order totals

-- 1. Check ALL delivery orders
SELECT
    orderNumber,
    type,
    subtotal,
    deliveryFee,
    total,
    (SELECT SUM(totalPrice) FROM order_items WHERE orderId = orders.id) as itemsSum,
    CASE
        WHEN total = 0 AND (SELECT COUNT(*) FROM order_items WHERE orderId = orders.id) > 0 THEN 'ZERO_WITH_ITEMS'
        WHEN total != ((SELECT COALESCE(SUM(totalPrice), 0) FROM order_items WHERE orderId = orders.id) + COALESCE(deliveryFee, 0)) THEN 'MISMATCH'
        ELSE 'OK'
    END as status,
    createdAt
FROM orders
WHERE type = 'DELIVERY'
ORDER BY createdAt DESC
LIMIT 20;
