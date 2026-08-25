-- @param customer STRING
-- Headline metrics for the selected strategic account.
SELECT
  COUNT(DISTINCT project_id) AS projects,
  COUNT(DISTINCT country) AS countries,
  COUNT(*) AS modules,
  COALESCE(SUM(sales_value_eur), 0) AS total_value_eur,
  COUNT(CASE WHEN is_t9_now THEN 1 END) AS t9_count,
  COUNT(CASE WHEN is_t4_then_t6_now THEN 1 END) AS t4_t6_count,
  COUNT(CASE WHEN NOT is_solution_compatible THEN 1 END) AS exception_count,
  COUNT(DISTINCT CASE WHEN solution_name = 'FASTPICK' THEN project_id END) AS fastpick_projects,
  COUNT(DISTINCT CASE WHEN solution_name = 'STOREPICK' THEN project_id END) AS storepick_projects,
  MIN(contract_date) AS first_contract,
  MAX(contract_date) AS latest_contract
FROM serverless_stable_cps4hg_catalog.ddi_hackathon.fact_project_module_intelligence
WHERE customer_name = :customer
