/**
 * Page 4 — Solution & Geography Insights.
 *
 * Persona: Regional Director comparing their region against the global average,
 * to find growth segments and under-penetrated markets.
 *
 * Composition: analytic genre, parallel structure (country / region / segment are
 * peer facets of the same comparison). The headline KPI row comes from the Unity
 * Catalog METRIC VIEW so the portfolio numbers agree with the dashboard and Genie.
 * IBCS: shared scale across the peer charts, structure vertical, part-to-whole via
 * stacked bars rather than pies.
 */
import { useMemo, useState } from 'react';
import { BarChart, LineChart, useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { sql } from '@databricks/appkit-ui/js';
import { Boxes, Percent, TrendingUp, Users } from 'lucide-react';
import {
  DataState,
  ExportButton,
  FilterSelect,
  InfoNote,
  KpiCard,
  PageHeader,
  SectionCard,
  SourceNote,
} from '../components/kit';
import { RecordTable } from '../components/RecordTable';
import { downloadCSV, formatEUR, formatEURCompact, formatNumber, formatPercent, toCSV, toNum } from '../lib/format';

/** Countries shown in the adoption chart — enough for comparison without clutter. */
const TOP_COUNTRIES = 12;

export function GeographyPage() {
  const [segment, setSegment] = useState('all');

  const segmentParams = useMemo(() => ({ segment: sql.string(segment) }), [segment]);
  const noParams = useMemo(() => ({}), []);

  const portfolio = useAnalyticsQuery('portfolio_kpis_metricview', noParams);
  const byCountry = useAnalyticsQuery('geo_country_solution', segmentParams);
  const byRegion = useAnalyticsQuery('geo_region_solution', segmentParams);
  const bySegment = useAnalyticsQuery('geo_segment_solution', noParams);
  const byYear = useAnalyticsQuery('revenue_by_year_metricview', noParams);
  const segments = useAnalyticsQuery('filter_segments', noParams);

  const kpi = portfolio.data?.[0];
  // Memoized: `?? []` would otherwise be a fresh array each render, invalidating
  // the useMemo hooks below on every pass.
  const countryRows = useMemo(() => byCountry.data ?? [], [byCountry.data]);

  const segmentOptions = useMemo(
    () =>
      (segments.data ?? []).map((row) => ({
        value: row.customer_segment,
        label: row.customer_segment,
      })),
    [segments.data],
  );

  // Top-N by project count, so the chart compares the markets that matter.
  const topCountries = useMemo(() => countryRows.slice(0, TOP_COUNTRIES), [countryRows]);

  /**
   * Concrete market contrast for the insight callout. France skews STOREPICK
   * (traditional retail / food distribution); Spain skews FASTPICK (e-commerce
   * growth). Rendered only when both are present in the current scope.
   */
  const contrast = useMemo(() => {
    const find = (name: string) => countryRows.find((row) => row.country === name);
    const france = find('France');
    const spain = find('Spain');
    if (!france || !spain) return null;
    return {
      france: toNum(france.fastpick_pct),
      spain: toNum(spain.fastpick_pct),
      franceProjects: toNum(france.total_projects),
      spainProjects: toNum(spain.total_projects),
    };
  }, [countryRows]);

  // FASTPICK Rate is DECIMAL(38,14) from the metric view — a STRING at runtime.
  const fastpickRate = kpi ? toNum(kpi.fastpick_rate) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Solution & Geography Insights"
        message={
          kpi
            ? `${formatPercent(fastpickRate, 1)} of the ${formatNumber(kpi.project_count)}-project portfolio runs FASTPICK, but adoption is driven by segment mix and varies sharply by market.`
            : 'FASTPICK vs STOREPICK adoption across countries, regions and customer segments.'
        }
      />

      {/* Governed portfolio KPIs — sourced from the metric view, not re-derived. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Portfolio revenue"
          value={kpi ? formatEURCompact(kpi.total_revenue_eur) : '—'}
          sublabel={kpi ? `${formatNumber(kpi.module_sales_count)} module sale lines` : undefined}
          loading={portfolio.loading}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <KpiCard
          label="FASTPICK rate"
          value={kpi ? formatPercent(fastpickRate, 1) : '—'}
          sublabel="Share of projects on shuttle-based piece picking"
          loading={portfolio.loading}
          icon={<Percent className="h-4 w-4" />}
        />
        <KpiCard
          label="Projects"
          value={kpi ? formatNumber(kpi.project_count) : '—'}
          sublabel={
            kpi ? `${formatNumber(kpi.strategic_project_count)} strategic (> €20M)` : undefined
          }
          loading={portfolio.loading}
          icon={<Boxes className="h-4 w-4" />}
        />
        <KpiCard
          label="Customers"
          value={kpi ? formatNumber(kpi.customer_count) : '—'}
          sublabel={
            kpi ? `${formatEURCompact(kpi.revenue_per_project_eur)} module revenue per project` : undefined
          }
          loading={portfolio.loading}
          icon={<Users className="h-4 w-4" />}
        />
      </div>

      <SourceNote>
        KPI row sourced from the governed metric view{' '}
        <code>serverless_stable_cps4hg_catalog.ddi_hackathon.vanderlande_warehousing_metrics</code> via{' '}
        <code>MEASURE()</code>, so these figures match the dashboard and the Genie space. Breakdowns below
        query <code>fact_project_module_intelligence</code> directly.
      </SourceNote>

      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect
          label="Customer segment"
          value={segment}
          onChange={setSegment}
          options={segmentOptions}
          allLabel="All segments"
        />
      </div>

      <SectionCard
        title={`FASTPICK vs STOREPICK adoption — top ${TOP_COUNTRIES} countries by project count`}
        description="Part-to-whole per market, stacked so the total project count stays readable."
        actions={
          <ExportButton
            label="Export countries"
            onClick={() =>
              downloadCSV(
                'vanderlande-country-solution-mix',
                toCSV(countryRows, [
                  { key: 'country', label: 'Country' },
                  { key: 'region', label: 'Region' },
                  { key: 'fastpick_projects', label: 'FASTPICK projects' },
                  { key: 'storepick_projects', label: 'STOREPICK projects' },
                  { key: 'total_projects', label: 'Total projects' },
                  { key: 'fastpick_pct', label: 'FASTPICK share (%)' },
                  { key: 'value_eur', label: 'Module value (EUR)' },
                ]),
              )
            }
            disabled={countryRows.length === 0}
          />
        }
      >
        <DataState
          loading={byCountry.loading}
          error={byCountry.error}
          isEmpty={countryRows.length === 0}
          emptyTitle="No countries in scope"
          emptyDescription="No projects match this segment. Try 'All segments'."
        >
          <BarChart
            data={topCountries}
            xKey="country"
            yKey={['fastpick_projects', 'storepick_projects']}
            stacked
            showLegend
            height={340}
            colorPalette="categorical"
            ariaLabel="FASTPICK versus STOREPICK project count by country"
          />
        </DataState>
      </SectionCard>

      {contrast && (
        <SectionCard
          title="Market insight — why France and Spain diverge"
          description="The clearest illustration that solution choice follows end-customer demand, not geography alone."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-md border p-4">
              <p className="text-sm font-medium text-foreground">
                France — {formatPercent(contrast.france, 1)} FASTPICK
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Skews STOREPICK across {formatNumber(contrast.franceProjects)} projects: traditional retail
                and food &amp; beverage distribution favour dense pallet and case storage with palletizing.
              </p>
            </div>
            <div className="rounded-md border p-4">
              <p className="text-sm font-medium text-foreground">
                Spain — {formatPercent(contrast.spain, 1)} FASTPICK
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Skews FASTPICK across {formatNumber(contrast.spainProjects)} projects: e-commerce growth
                drives high-throughput piece picking on shuttle-based storage and sortation.
              </p>
            </div>
          </div>
        </SectionCard>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard
          title="Regional adoption — peer comparison"
          description="Each region's solution split, for comparison against the global FASTPICK rate above."
        >
          <DataState
            loading={byRegion.loading}
            error={byRegion.error}
            isEmpty={(byRegion.data ?? []).length === 0}
            emptyTitle="No regions in scope"
          >
            <BarChart
              queryKey="geo_region_solution"
              parameters={segmentParams}
              xKey="region"
              yKey={['fastpick_projects', 'storepick_projects']}
              stacked
              showLegend
              height={300}
              colorPalette="categorical"
              ariaLabel="FASTPICK versus STOREPICK project count by region"
            />
          </DataState>
        </SectionCard>

        <SectionCard
          title="Segment drives solution choice"
          description="Solution split per customer segment — the mechanism behind the geographic variation."
        >
          <DataState
            loading={bySegment.loading}
            error={bySegment.error}
            isEmpty={(bySegment.data ?? []).length === 0}
            emptyTitle="No segments available"
          >
            <BarChart
              queryKey="geo_segment_solution"
              parameters={noParams}
              xKey="customer_segment"
              yKey={['fastpick_projects', 'storepick_projects']}
              stacked
              showLegend
              height={300}
              colorPalette="categorical"
              ariaLabel="FASTPICK versus STOREPICK project count by customer segment"
            />
          </DataState>
        </SectionCard>
      </div>

      <SectionCard
        title="Portfolio revenue by contract year"
        description="Governed revenue trend from the metric view. Time runs left to right."
      >
        <DataState
          loading={byYear.loading}
          error={byYear.error}
          isEmpty={(byYear.data ?? []).length === 0}
          emptyTitle="No contract history available"
        >
          <LineChart
            queryKey="revenue_by_year_metricview"
            parameters={noParams}
            xKey="contract_year"
            yKey="total_revenue_eur"
            smooth
            height={300}
            colorPalette="categorical"
            ariaLabel="Portfolio module revenue by contract year"
          />
        </DataState>
      </SectionCard>

      <SectionCard
        title="Country detail — adoption and opportunity"
        description="Sorted by project count. A low FASTPICK share in a growing e-commerce market signals an under-penetrated opportunity."
      >
        <DataState
          loading={byCountry.loading}
          error={byCountry.error}
          isEmpty={countryRows.length === 0}
          emptyTitle="No countries in scope"
        >
          <RecordTable
            rows={countryRows}
            rowKey={(row) => row.country}
            maxRows={40}
            columns={[
              {
                key: 'country',
                header: 'Country',
                render: (row) => <span className="font-medium">{row.country}</span>,
              },
              { key: 'region', header: 'Region', render: (row) => row.region },
              {
                key: 'projects',
                header: 'Projects',
                numeric: true,
                render: (row) => formatNumber(row.total_projects),
              },
              {
                key: 'fastpick',
                header: 'FASTPICK',
                numeric: true,
                render: (row) => formatNumber(row.fastpick_projects),
              },
              {
                key: 'storepick',
                header: 'STOREPICK',
                numeric: true,
                render: (row) => formatNumber(row.storepick_projects),
              },
              {
                key: 'share',
                header: 'FASTPICK share',
                numeric: true,
                render: (row) => formatPercent(row.fastpick_pct, 1),
              },
              {
                key: 'value',
                header: 'Module value',
                numeric: true,
                render: (row) => formatEUR(row.value_eur),
              },
            ]}
          />
        </DataState>
      </SectionCard>

      <InfoNote>
        FASTPICK is shuttle-based high-throughput piece picking (e-commerce, parcel, pharma, fashion).
        STOREPICK is dense pallet and case storage with palletizing (food &amp; beverage, industrial,
        wholesale). Country labels come from the source data, which deliberately contains spelling variants.
        Synthetic demonstration data.
      </InfoNote>
    </div>
  );
}
