-- @param solution STRING
-- @param family STRING
-- Configuration compliance KPIs. An exception is a module sold on a project whose
-- solution (FASTPICK/STOREPICK) the module is not eligible for per solution_module_matrix.
-- NOTE: exception_rate uses ROUND() and arrives as a STRING at runtime — Number() it.
SELECT
  COUNT(*) AS total_modules,
  COUNT(CASE WHEN NOT is_solution_compatible THEN 1 END) AS exception_modules,
  ROUND(100.0 * COUNT(CASE WHEN NOT is_solution_compatible THEN 1 END) / NULLIF(COUNT(*), 0), 2) AS exception_rate,
  COUNT(DISTINCT CASE WHEN NOT is_solution_compatible THEN project_id END) AS affected_projects,
  COUNT(DISTINCT CASE WHEN NOT is_solution_compatible THEN customer_name END) AS affected_customers,
  COALESCE(SUM(CASE WHEN NOT is_solution_compatible THEN sales_value_eur ELSE 0 END), 0) AS exception_value_eur,
  COALESCE(SUM(sales_value_eur), 0) AS total_value_eur
FROM serverless_stable_cps4hg_catalog.ddi_hackathon.fact_project_module_intelligence
WHERE (:solution = 'all' OR solution_name = :solution)
  AND (:family = 'all' OR product_family = :family)
