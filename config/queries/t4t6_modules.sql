-- @param country STRING
-- @param segment STRING
-- T4 -> T6 transitions: modules sold while freely sellable (T4) that have since
-- moved to End of Sales (T6). Proactive customer engagement candidates.
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
  sales_date
FROM serverless_stable_cps4hg_catalog.ddi_hackathon.fact_project_module_intelligence
WHERE is_t4_then_t6_now = true
  AND (:country = 'all' OR country = :country)
  AND (:segment = 'all' OR customer_segment = :segment)
ORDER BY sales_value_eur DESC
