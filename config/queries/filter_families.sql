-- Distinct product families for filter dropdowns.
SELECT product_family, COUNT(*) AS module_rows
FROM serverless_stable_cps4hg_catalog.ddi_hackathon.fact_project_module_intelligence
GROUP BY product_family
ORDER BY product_family
