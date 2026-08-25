-- @param country STRING
-- @param segment STRING
-- Installed-base lifecycle risk KPIs, optionally scoped to a country and/or customer segment.
-- 'all' is the sentinel meaning "no filter" (SelectItem cannot use an empty value).
SELECT
  COUNT(*) AS total_modules,
  COUNT(DISTINCT project_id) AS total_projects,
  COUNT(CASE WHEN is_t9_now OR is_t4_then_t6_now OR is_t6_at_sale OR NOT is_solution_compatible THEN 1 END) AS at_risk_modules,
  COUNT(CASE WHEN is_t9_now THEN 1 END) AS t9_count,
  COUNT(CASE WHEN is_t4_then_t6_now THEN 1 END) AS t4_t6_count,
  COUNT(CASE WHEN is_t6_at_sale THEN 1 END) AS t6_at_sale_count,
  COUNT(CASE WHEN NOT is_solution_compatible THEN 1 END) AS exception_count,
  COALESCE(SUM(CASE WHEN is_t9_now THEN sales_value_eur ELSE 0 END), 0) AS t9_value_eur,
  COALESCE(SUM(CASE WHEN is_t4_then_t6_now THEN sales_value_eur ELSE 0 END), 0) AS t4_t6_value_eur,
  COUNT(DISTINCT CASE WHEN is_t9_now THEN customer_name END) AS t9_customers,
  COUNT(DISTINCT CASE WHEN is_t9_now THEN project_id END) AS t9_projects
FROM serverless_stable_cps4hg_catalog.ddi_hackathon.fact_project_module_intelligence
WHERE (:country = 'all' OR country = :country)
  AND (:segment = 'all' OR customer_segment = :segment)
