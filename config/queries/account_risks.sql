-- @param customer STRING
-- Every at-risk module across the selected account's installed base, worst first.
SELECT
  country,
  project_id,
  project_name,
  solution_name,
  module_name,
  product_family,
  quantity,
  sales_value_eur,
  sales_date,
  CASE
    WHEN is_t9_now THEN 'T9 - No Support'
    WHEN is_t4_then_t6_now THEN 'T4 to T6 - End of Sales'
    WHEN is_t6_at_sale THEN 'T6 at Sale - Policy Exception'
    ELSE 'Config Exception'
  END AS risk_type
FROM serverless_stable_cps4hg_catalog.ddi_hackathon.fact_project_module_intelligence
WHERE customer_name = :customer
  AND (is_t9_now OR is_t4_then_t6_now OR is_t6_at_sale OR NOT is_solution_compatible)
ORDER BY sales_value_eur DESC
