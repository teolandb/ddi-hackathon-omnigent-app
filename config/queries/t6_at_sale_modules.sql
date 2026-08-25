-- @param country STRING
-- @param segment STRING
-- T6-at-sale: modules sold while ALREADY at End of Sales. These are policy
-- exceptions (sales should be blocked at T6) and indicate process control issues.
SELECT
  customer_name,
  customer_segment,
  country,
  project_id,
  project_name,
  solution_name,
  module_name,
  product_family,
  quantity,
  sales_value_eur,
  sales_date,
  lifecycle_stage_current
FROM serverless_stable_cps4hg_catalog.ddi_hackathon.fact_project_module_intelligence
WHERE is_t6_at_sale = true
  AND (:country = 'all' OR country = :country)
  AND (:segment = 'all' OR customer_segment = :segment)
ORDER BY sales_value_eur DESC
