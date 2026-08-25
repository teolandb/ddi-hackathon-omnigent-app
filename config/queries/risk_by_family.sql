-- @param country STRING
-- @param segment STRING
-- Lifecycle risk composition by product family — where the installed-base
-- exposure concentrates. Structural comparison, sorted by total risk.
SELECT
  product_family,
  COUNT(CASE WHEN is_t9_now THEN 1 END) AS t9_modules,
  COUNT(CASE WHEN is_t4_then_t6_now THEN 1 END) AS t4_t6_modules,
  COUNT(CASE WHEN is_t6_at_sale THEN 1 END) AS t6_at_sale_modules
FROM serverless_stable_cps4hg_catalog.ddi_hackathon.fact_project_module_intelligence
WHERE (:country = 'all' OR country = :country)
  AND (:segment = 'all' OR customer_segment = :segment)
GROUP BY product_family
ORDER BY t9_modules + t4_t6_modules + t6_at_sale_modules DESC
