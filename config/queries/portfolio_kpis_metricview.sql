-- Governed portfolio KPIs sourced from the Unity Catalog METRIC VIEW
-- serverless_stable_cps4hg_catalog.ddi_hackathon.vanderlande_warehousing_metrics.
-- Using the metric view (rather than re-deriving these in SQL here) keeps the
-- headline numbers consistent with the dashboard and Genie space.
-- Measures MUST be wrapped in MEASURE(); SELECT * is not supported on metric views.
-- FASTPICK Rate is DECIMAL(38,14) and the SUM/AVG measures are large — every one
-- of these arrives as a STRING at runtime, so Number() before any arithmetic.
SELECT
  MEASURE(`Total Revenue`) AS total_revenue_eur,
  MEASURE(`Project Count`) AS project_count,
  MEASURE(`Customer Count`) AS customer_count,
  MEASURE(`Module Sales Count`) AS module_sales_count,
  MEASURE(`Strategic Project Count`) AS strategic_project_count,
  MEASURE(`FASTPICK Rate`) AS fastpick_rate,
  MEASURE(`T9 Risk Count`) AS t9_risk_count,
  MEASURE(`T4 Then T6 Risk Count`) AS t4_t6_risk_count,
  MEASURE(`T6 at Sale Count`) AS t6_at_sale_count,
  MEASURE(`Compatibility Exception Count`) AS compatibility_exception_count,
  MEASURE(`Average Project Value`) AS avg_project_value_eur,
  MEASURE(`Revenue per Project`) AS revenue_per_project_eur,
  MEASURE(`Modules per Project`) AS modules_per_project
FROM serverless_stable_cps4hg_catalog.ddi_hackathon.vanderlande_warehousing_metrics
