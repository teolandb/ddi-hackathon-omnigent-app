-- The solution eligibility matrix itself — the rule set that defines an exception.
-- Shown so users can see WHY a module counts as non-compliant.
SELECT
  product_family,
  module_group,
  module_name,
  eligible_fastpick,
  eligible_storepick
FROM serverless_stable_cps4hg_catalog.ddi_hackathon.solution_module_matrix
ORDER BY product_family, module_name
