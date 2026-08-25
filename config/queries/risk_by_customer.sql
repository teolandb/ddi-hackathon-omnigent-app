-- @param country STRING
-- @param segment STRING
-- Accounts ranked by installed-base risk exposure — the outreach worklist.
SELECT
  customer_name,
  customer_segment,
  COUNT(DISTINCT country) AS countries,
  COUNT(DISTINCT project_id) AS projects,
  COUNT(CASE WHEN is_t9_now THEN 1 END) AS t9_modules,
  COUNT(CASE WHEN is_t4_then_t6_now THEN 1 END) AS t4_t6_modules,
  COUNT(CASE WHEN NOT is_solution_compatible THEN 1 END) AS exception_modules,
  COALESCE(SUM(CASE WHEN is_t9_now OR is_t4_then_t6_now THEN sales_value_eur ELSE 0 END), 0) AS at_risk_value_eur
FROM serverless_stable_cps4hg_catalog.ddi_hackathon.fact_project_module_intelligence
WHERE (:country = 'all' OR country = :country)
  AND (:segment = 'all' OR customer_segment = :segment)
GROUP BY customer_name, customer_segment
HAVING COUNT(CASE WHEN is_t9_now OR is_t4_then_t6_now OR NOT is_solution_compatible THEN 1 END) > 0
ORDER BY at_risk_value_eur DESC
