-- Customer-segment FASTPICK vs STOREPICK split — shows how end-customer demand
-- drives solution architecture choice. fastpick_pct is a ROUND() result (STRING).
SELECT
  customer_segment,
  COUNT(DISTINCT CASE WHEN solution_name = 'FASTPICK' THEN project_id END) AS fastpick_projects,
  COUNT(DISTINCT CASE WHEN solution_name = 'STOREPICK' THEN project_id END) AS storepick_projects,
  COUNT(DISTINCT project_id) AS total_projects,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN solution_name = 'FASTPICK' THEN project_id END)
    / NULLIF(COUNT(DISTINCT project_id), 0), 1) AS fastpick_pct,
  COALESCE(SUM(sales_value_eur), 0) AS value_eur
FROM serverless_stable_cps4hg_catalog.ddi_hackathon.fact_project_module_intelligence
GROUP BY customer_segment
ORDER BY total_projects DESC
