-- Contract-year revenue trend from the governed METRIC VIEW. Time series, so the
-- frontend renders it left-to-right (IBCS: time horizontal).
-- MEASURE() results arrive as STRINGs at runtime — Number() them.
SELECT
  `contract_year` AS contract_year,
  MEASURE(`Total Revenue`) AS total_revenue_eur,
  MEASURE(`Project Count`) AS project_count,
  MEASURE(`Strategic Project Count`) AS strategic_project_count
FROM serverless_stable_cps4hg_catalog.ddi_hackathon.vanderlande_warehousing_metrics
GROUP BY ALL
ORDER BY contract_year
