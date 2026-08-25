-- @param segment STRING
-- Country-level FASTPICK vs STOREPICK adoption. fastpick_pct uses ROUND() so it
-- arrives as a STRING at runtime — Number() before arithmetic or .toFixed().
SELECT
  country,
  region,
  COUNT(DISTINCT CASE WHEN solution_name = 'FASTPICK' THEN project_id END) AS fastpick_projects,
  COUNT(DISTINCT CASE WHEN solution_name = 'STOREPICK' THEN project_id END) AS storepick_projects,
  COUNT(DISTINCT project_id) AS total_projects,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN solution_name = 'FASTPICK' THEN project_id END)
    / NULLIF(COUNT(DISTINCT project_id), 0), 1) AS fastpick_pct,
  COALESCE(SUM(sales_value_eur), 0) AS value_eur
FROM serverless_stable_cps4hg_catalog.ddi_hackathon.fact_project_module_intelligence
WHERE (:segment = 'all' OR customer_segment = :segment)
GROUP BY country, region
ORDER BY total_projects DESC
