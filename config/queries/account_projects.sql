-- @param customer STRING
-- Full project portfolio for the selected account, newest contract first.
-- ANY_VALUE(total_project_value_eur) because it is constant per project_id.
SELECT
  project_id,
  project_name,
  country,
  region,
  solution_name,
  project_status,
  project_size_category,
  MIN(contract_date) AS contract_date,
  ANY_VALUE(total_project_value_eur) AS project_value_eur,
  COUNT(*) AS modules,
  COUNT(CASE WHEN is_t9_now THEN 1 END) AS t9_modules,
  COUNT(CASE WHEN is_t4_then_t6_now THEN 1 END) AS t4_t6_modules,
  COUNT(CASE WHEN NOT is_solution_compatible THEN 1 END) AS exception_modules
FROM serverless_stable_cps4hg_catalog.ddi_hackathon.fact_project_module_intelligence
WHERE customer_name = :customer
GROUP BY project_id, project_name, country, region, solution_name, project_status, project_size_category
ORDER BY contract_date DESC
