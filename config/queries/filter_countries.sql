-- Distinct countries for filter dropdowns, alphabetical.
-- NOTE: the source data deliberately contains country spelling variants
-- (e.g. USA / US), so this list mirrors the data rather than a clean dimension.
SELECT country, COUNT(*) AS module_rows
FROM serverless_stable_cps4hg_catalog.ddi_hackathon.fact_project_module_intelligence
GROUP BY country
ORDER BY country
