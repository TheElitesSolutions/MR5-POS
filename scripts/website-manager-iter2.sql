-- ================================================================
-- Website Manager — Iteration 2
--
-- Adds the destructive "Reset Website" RPC. Hides ALL items + categories
-- from the public Menu and wipes the website-display fields (description,
-- image_url, image_lqip, is_featured, display_order). POS-side data
-- (name, price, category, etc.) is untouched.
--
-- Idempotent. Safe to re-run.
-- ================================================================

CREATE OR REPLACE FUNCTION reset_website_state()
RETURNS TABLE (items_reset INT, categories_reset INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items      INT;
  v_categories INT;
BEGIN
  WITH updated AS (
    UPDATE item
       SET "isVisibleOnWebsite" = false,
           is_featured           = false,
           display_order         = 0,
           image_url             = null,
           image_lqip            = null,
           description           = null,
           updated_at            = now()
     WHERE deleted_at IS NULL
     RETURNING 1
  )
  SELECT count(*)::INT INTO v_items FROM updated;

  WITH updated AS (
    UPDATE category
       SET is_visible    = false,
           display_order = 0,
           image_url     = null,
           updated_at    = now()
     WHERE deleted_at IS NULL
     RETURNING 1
  )
  SELECT count(*)::INT INTO v_categories FROM updated;

  RETURN QUERY SELECT v_items, v_categories;
END;
$$;

REVOKE EXECUTE ON FUNCTION reset_website_state() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION reset_website_state() TO service_role;

-- Verification
SELECT proname, pronargs, pg_get_function_result(oid) AS returns
  FROM pg_proc
 WHERE proname = 'reset_website_state'
   AND pronamespace = 'public'::regnamespace;
