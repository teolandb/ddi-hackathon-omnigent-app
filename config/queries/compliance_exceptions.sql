-- @param solution STRING
-- @param family STRING
-- Detailed configuration-exception list: modules sold outside their eligible
-- solution matrix. This is the VP-approval worklist for quarterly business review.
SELECT
  customer_name,
  customer_segment,
  country,
  project_id,
  project_name,
  solution_name,
  module_name,
  module_group,
  product_family,
  quantity,
  sales_value_eur,
  sales_date,
  project_status
FROM serverless_stable_cps4hg_catalog.ddi_hackathon.fact_project_module_intelligence
WHERE is_solution_compatible = false
  AND (:solution = 'all' OR solution_name = :solution)
  AND (:family = 'all' OR product_family = :family)
ORDER BY sales_date DESC
