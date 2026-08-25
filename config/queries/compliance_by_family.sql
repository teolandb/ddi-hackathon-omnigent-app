-- @param solution STRING
-- Product families ranked by the configuration exceptions they drive.
-- exception_rate uses ROUND() — arrives as a STRING at runtime, Number() it.
SELECT
  product_family,
  COUNT(CASE WHEN NOT is_solution_compatible THEN 1 END) AS exception_modules,
  COUNT(*) AS total_modules,
  ROUND(100.0 * COUNT(CASE WHEN NOT is_solution_compatible THEN 1 END) / NULLIF(COUNT(*), 0), 2) AS exception_rate,
  COALESCE(SUM(CASE WHEN NOT is_solution_compatible THEN sales_value_eur ELSE 0 END), 0) AS exception_value_eur
FROM serverless_stable_cps4hg_catalog.ddi_hackathon.fact_project_module_intelligence
WHERE (:solution = 'all' OR solution_name = :solution)
GROUP BY product_family
ORDER BY exception_modules DESC
