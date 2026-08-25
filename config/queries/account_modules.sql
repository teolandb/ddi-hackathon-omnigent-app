-- @param customer STRING
-- Module portfolio for the selected account, with a derived risk status per module.
-- risk_status ranks worst-first: T9 (no support) > T6 (end of sales) > OK.
SELECT
  product_family,
  module_name,
  COUNT(*) AS sale_lines,
  SUM(quantity) AS units,
  COALESCE(SUM(sales_value_eur), 0) AS value_eur,
  MAX(
    CASE
      WHEN is_t9_now THEN 'T9 - No Support'
      WHEN is_t4_then_t6_now OR is_t6_at_sale THEN 'T6 - End of Sales'
      ELSE 'OK'
    END
  ) AS risk_status
FROM serverless_stable_cps4hg_catalog.ddi_hackathon.fact_project_module_intelligence
WHERE customer_name = :customer
GROUP BY product_family, module_name
ORDER BY value_eur DESC
