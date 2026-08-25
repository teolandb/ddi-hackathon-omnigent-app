-- @param country STRING
-- @param segment STRING
-- T9 (End of Support) modules in the installed base — no spare parts, no service.
-- Highest-priority migration candidates for customer outreach.
SELECT
  customer_name,
  customer_segment,
  country,
  region,
  project_id,
  project_name,
  solution_name,
  module_name,
  product_family,
  quantity,
  sales_value_eur,
  sales_date,
  lifecycle_stage_at_sale
FROM serverless_stable_cps4hg_catalog.ddi_hackathon.fact_project_module_intelligence
WHERE is_t9_now = true
  AND (:country = 'all' OR country = :country)
  AND (:segment = 'all' OR customer_segment = :segment)
ORDER BY sales_value_eur DESC
