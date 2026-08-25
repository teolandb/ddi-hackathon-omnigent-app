-- Multi-project customers — the strategic accounts for the explorer dropdown.
-- Ordered by portfolio value so the biggest relationships surface first.
SELECT
  customer_name,
  customer_segment,
  COUNT(DISTINCT project_id) AS projects,
  COUNT(DISTINCT country) AS countries,
  COALESCE(SUM(sales_value_eur), 0) AS total_value_eur,
  COUNT(CASE WHEN is_t9_now OR is_t4_then_t6_now THEN 1 END) AS at_risk_modules
FROM serverless_stable_cps4hg_catalog.ddi_hackathon.fact_project_module_intelligence
GROUP BY customer_name, customer_segment
HAVING COUNT(DISTINCT project_id) >= 2
ORDER BY total_value_eur DESC
