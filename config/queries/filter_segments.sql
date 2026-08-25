-- Distinct customer segments for filter dropdowns.
SELECT customer_segment, COUNT(DISTINCT customer_name) AS customers
FROM serverless_stable_cps4hg_catalog.ddi_hackathon.fact_project_module_intelligence
GROUP BY customer_segment
ORDER BY customer_segment
