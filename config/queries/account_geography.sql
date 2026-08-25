-- @param customer STRING
-- Geographic footprint of the selected account — where Vanderlande is installed.
SELECT
  country,
  region,
  COUNT(DISTINCT project_id) AS projects,
  COALESCE(SUM(sales_value_eur), 0) AS value_eur,
  COUNT(CASE WHEN is_t9_now OR is_t4_then_t6_now THEN 1 END) AS at_risk_modules
FROM serverless_stable_cps4hg_catalog.ddi_hackathon.fact_project_module_intelligence
WHERE customer_name = :customer
GROUP BY country, region
ORDER BY value_eur DESC
