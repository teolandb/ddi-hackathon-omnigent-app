/**
 * Page 1 — Installed-Base Risk Monitor (landing page).
 *
 * Persona: Product Lifecycle Manager, Monday morning. Check what in the installed
 * base is at lifecycle risk, export the T9 list for service-manager outreach, and
 * record who has already been contacted.
 *
 * Composition: analytic genre, stratified layout (KPI row -> risk mix -> detail
 * tables). IBCS: message-in-title, structure vertical, one consistent severity
 * notation (T9 = destructive, T6/T4->T6 = warning) reused on every page.
 */
import { useMemo, useState } from 'react';
import { useAnalyticsQuery, BarChart, Badge, Alert, AlertDescription, AlertTitle } from '@databricks/appkit-ui/react';
import { sql } from '@databricks/appkit-ui/js';
import { AlertTriangle, Info, ShieldAlert, Siren, Wrench } from 'lucide-react';
import {
  DataState,
  ExportButton,
  FilterSelect,
  InfoNote,
  KpiCard,
  LifecycleBadge,
  PageHeader,
  SectionCard,
  SourceNote,
} from '../components/kit';
import { RecordTable, type Column } from '../components/RecordTable';
import { MigrationActionControl } from '../components/MigrationAction';
import { ActivityFeed } from '../components/ActivityFeed';
import { SavedViewsControl } from '../components/SavedViews';
import {
  downloadCSV,
  formatDate,
  formatEUR,
  formatEURCompact,
  formatNumber,
  toCSV,
  toNum,
} from '../lib/format';
import { useActivity, useMigrationActions, useSavedViews } from '../lib/state';

/** A module row as returned by the t9 / t4t6 / t6-at-sale queries. */
interface RiskRow {
  customer_name: string;
  customer_segment?: string;
  country: string;
  project_id: string;
  project_name: string;
  solution_name: string;
  module_name: string;
  product_family: string;
  quantity: number;
  sales_value_eur: number;
  sales_date: string;
}

const RISK_CSV_COLUMNS = [
  { key: 'customer_name', label: 'Customer' },
  { key: 'country', label: 'Country' },
  { key: 'project_id', label: 'Project ID' },
  { key: 'project_name', label: 'Project' },
  { key: 'solution_name', label: 'Solution' },
  { key: 'module_name', label: 'Module' },
  { key: 'product_family', label: 'Product family' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'sales_value_eur', label: 'Sales value (EUR)' },
  { key: 'sales_date', label: 'Sales date' },
];

export function RiskMonitorPage() {
  const [country, setCountry] = useState('all');
  const [segment, setSegment] = useState('all');

  // Memoized so the hook doesn't see a new object every render (infinite refetch).
  const filterParams = useMemo(
    () => ({ country: sql.string(country), segment: sql.string(segment) }),
    [country, segment],
  );
  const noParams = useMemo(() => ({}), []);

  const kpis = useAnalyticsQuery('risk_kpis', filterParams);
  const t9 = useAnalyticsQuery('t9_modules', filterParams);
  const t4t6 = useAnalyticsQuery('t4t6_modules', filterParams);
  const t6AtSale = useAnalyticsQuery('t6_at_sale_modules', filterParams);
  const byCustomer = useAnalyticsQuery('risk_by_customer', filterParams);
  const countries = useAnalyticsQuery('filter_countries', noParams);
  const segments = useAnalyticsQuery('filter_segments', noParams);

  const actions = useMigrationActions();
  const activity = useActivity();
  const savedViews = useSavedViews('risk');

  const kpi = kpis.data?.[0];
  const t9Rows = t9.data ?? [];
  const t4t6Rows = t4t6.data ?? [];
  const t6Rows = t6AtSale.data ?? [];

  const countryOptions = useMemo(
    () => (countries.data ?? []).map((row) => ({ value: row.country, label: row.country })),
    [countries.data],
  );
  const segmentOptions = useMemo(
    () =>
      (segments.data ?? []).map((row) => ({
        value: row.customer_segment,
        label: row.customer_segment,
      })),
    [segments.data],
  );

  /** Stable identity for a module instance, used as the state primary key. */
  const itemKeyFor = (row: RiskRow, risk: string) =>
    `${risk}|${row.project_id}|${row.module_name}|${row.sales_date}`;

  /** Risk tables share one column set; only the risk label on the action differs. */
  const riskColumns = (risk: string): Column<RiskRow>[] => [
    { key: 'customer', header: 'Customer', render: (row) => <span className="font-medium">{row.customer_name}</span> },
    { key: 'country', header: 'Country', render: (row) => row.country },
    { key: 'project', header: 'Project', render: (row) => row.project_name },
    { key: 'module', header: 'Module', render: (row) => row.module_name },
    { key: 'family', header: 'Product family', render: (row) => row.product_family },
    { key: 'qty', header: 'Qty', numeric: true, render: (row) => formatNumber(row.quantity) },
    {
      key: 'value',
      header: 'Sales value',
      numeric: true,
      render: (row) => formatEUR(row.sales_value_eur),
    },
    { key: 'date', header: 'Sold', render: (row) => formatDate(row.sales_date) },
    {
      key: 'status',
      header: 'Migration status',
      render: (row) =>
        actions.available ? (
          <MigrationActionControl
            itemKey={itemKeyFor(row, risk)}
            customer={row.customer_name}
            project={row.project_name}
            module={row.module_name}
            country={row.country}
            riskType={risk}
            existing={actions.byKey.get(itemKeyFor(row, risk))}
            onSave={actions.save}
          />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
  ];

  const exportRows = (rows: readonly RiskRow[], filename: string) => {
    downloadCSV(filename, toCSVRows(rows));
  };

  const scopeLabel = [
    country === 'all' ? 'all countries' : country,
    segment === 'all' ? 'all segments' : segment,
  ].join(' · ');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Installed-Base Risk Monitor"
        message={
          kpi
            ? `${formatNumber(kpi.t9_count)} installed modules are at T9 (no support) across ${formatNumber(kpi.t9_customers)} customers, worth ${formatEURCompact(kpi.t9_value_eur)} — plus ${formatNumber(kpi.t4_t6_count)} sold-as-current modules that have since been retired to T6.`
            : 'Lifecycle risk across the installed base — T9 modules with no support, T4→T6 retirements, and policy exceptions.'
        }
        actions={
          savedViews.available ? (
            <SavedViewsControl
              views={savedViews.views}
              current={{ name: '', country, segment }}
              onSave={savedViews.save}
              onRemove={savedViews.remove}
              onApply={(view) => {
                setCountry(view.country ?? 'all');
                setSegment(view.segment ?? 'all');
              }}
            />
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect
          label="Country"
          value={country}
          onChange={setCountry}
          options={countryOptions}
          allLabel="All countries"
        />
        <FilterSelect
          label="Customer segment"
          value={segment}
          onChange={setSegment}
          options={segmentOptions}
          allLabel="All segments"
        />
      </div>

      {!actions.available && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Read-only mode</AlertTitle>
          <AlertDescription>
            Persistent storage is unavailable, so migration statuses can&apos;t be recorded right now. All
            risk data below is still live.
          </AlertDescription>
        </Alert>
      )}

      {/* KPI row — each value carries unit, scope and comparison (IBCS). */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="T9 — no support"
          value={kpi ? formatNumber(kpi.t9_count) : '—'}
          sublabel={
            kpi
              ? `${formatEURCompact(kpi.t9_value_eur)} · ${formatNumber(kpi.t9_projects)} projects · ${formatNumber(kpi.t9_customers)} customers`
              : undefined
          }
          tone="destructive"
          loading={kpis.loading}
          icon={<Siren className="h-4 w-4" />}
        />
        <KpiCard
          label="T4 → T6 retired"
          value={kpi ? formatNumber(kpi.t4_t6_count) : '—'}
          sublabel={kpi ? `${formatEURCompact(kpi.t4_t6_value_eur)} sold while current` : undefined}
          tone="warning"
          loading={kpis.loading}
          icon={<Wrench className="h-4 w-4" />}
        />
        <KpiCard
          label="T6 at sale"
          value={kpi ? formatNumber(kpi.t6_at_sale_count) : '—'}
          sublabel="Policy exceptions — sold after end-of-sales"
          tone="warning"
          loading={kpis.loading}
          icon={<ShieldAlert className="h-4 w-4" />}
        />
        <KpiCard
          label="Config exceptions"
          value={kpi ? formatNumber(kpi.exception_count) : '—'}
          sublabel={
            kpi
              ? `of ${formatNumber(kpi.total_modules)} module sales in scope`
              : undefined
          }
          tone="default"
          loading={kpis.loading}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      <SourceNote>
        Source: <code>serverless_stable_cps4hg_catalog.ddi_hackathon.fact_project_module_intelligence</code>{' '}
        (project × module grain), queried live on the SQL warehouse. Scope: {scopeLabel}.
        {actions.summary && actions.summary.total > 0
          ? ` ${formatNumber(actions.summary.addressed)} of ${formatNumber(actions.summary.total)} tracked modules have been actioned by the team.`
          : ''}
      </SourceNote>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard
          title="Risk concentration by product family"
          description="Where lifecycle exposure sits. Stacked by risk type, worst-affected family first."
        >
          <DataState
            loading={false}
            error={null}
            isEmpty={false}
            emptyTitle="No risk recorded in scope"
          >
            <BarChart
              queryKey="risk_by_family"
              parameters={filterParams}
              xKey="product_family"
              yKey={['t9_modules', 't4_t6_modules', 't6_at_sale_modules']}
              stacked
              showLegend
              height={300}
              colorPalette="categorical"
              ariaLabel="Lifecycle risk by product family"
            />
          </DataState>
        </SectionCard>

        <SectionCard
          title="Accounts ranked by risk exposure"
          description="The outreach worklist — accounts holding the most at-risk value."
          actions={
            <ExportButton
              onClick={() =>
                downloadCSV(
                  'vanderlande-risk-by-account',
                  toCSV(byCustomer.data ?? [], [
                    { key: 'customer_name', label: 'Customer' },
                    { key: 'customer_segment', label: 'Segment' },
                    { key: 'countries', label: 'Countries' },
                    { key: 'projects', label: 'Projects' },
                    { key: 't9_modules', label: 'T9 modules' },
                    { key: 't4_t6_modules', label: 'T4->T6 modules' },
                    { key: 'exception_modules', label: 'Config exceptions' },
                    { key: 'at_risk_value_eur', label: 'At-risk value (EUR)' },
                  ]),
                )
              }
              disabled={(byCustomer.data ?? []).length === 0}
            />
          }
        >
          <DataState
            loading={byCustomer.loading}
            error={byCustomer.error}
            isEmpty={(byCustomer.data ?? []).length === 0}
            emptyTitle="No at-risk accounts in scope"
            emptyDescription="Try widening the country or segment filter."
          >
            <RecordTable
              rows={byCustomer.data ?? []}
              rowKey={(row) => row.customer_name}
              maxRows={12}
              columns={[
                {
                  key: 'customer',
                  header: 'Customer',
                  render: (row) => <span className="font-medium">{row.customer_name}</span>,
                },
                { key: 'segment', header: 'Segment', render: (row) => row.customer_segment },
                {
                  key: 't9',
                  header: 'T9',
                  numeric: true,
                  render: (row) =>
                    toNum(row.t9_modules) > 0 ? (
                      <span className="font-semibold text-destructive">{formatNumber(row.t9_modules)}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    ),
                },
                {
                  key: 't4t6',
                  header: 'T4→T6',
                  numeric: true,
                  render: (row) =>
                    toNum(row.t4_t6_modules) > 0 ? (
                      <span className="font-semibold text-warning">{formatNumber(row.t4_t6_modules)}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    ),
                },
                {
                  key: 'value',
                  header: 'At-risk value',
                  numeric: true,
                  render: (row) => formatEUR(row.at_risk_value_eur),
                },
              ]}
            />
          </DataState>
        </SectionCard>
      </div>

      {/* T9 — the highest-severity list, so it leads the detail sections. */}
      <SectionCard
        title="T9 modules — no support available"
        description="Fully retired modules still installed. These customers need migration planning now."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
              {formatNumber(t9Rows.length)} modules
            </Badge>
            <ExportButton
              label="Export T9 list"
              onClick={() => exportRows(t9Rows, 'vanderlande-t9-modules')}
              disabled={t9Rows.length === 0}
            />
          </div>
        }
      >
        <DataState
          loading={t9.loading}
          error={t9.error}
          isEmpty={t9Rows.length === 0}
          emptyTitle="No T9 modules in scope"
          emptyDescription="Nothing in the current filter is at end-of-support. Widen the filter to check other markets."
        >
          <RecordTable
            rows={t9Rows}
            rowKey={(row) => itemKeyFor(row, 'T9')}
            columns={riskColumns('T9')}
          />
        </DataState>
      </SectionCard>

      <SectionCard
        title="T4 → T6 transitions — sold current, since retired"
        description="Sold while freely sellable; now end-of-sales. Proactive engagement candidates."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning">
              {formatNumber(t4t6Rows.length)} modules
            </Badge>
            <ExportButton
              label="Export T4→T6"
              onClick={() => exportRows(t4t6Rows, 'vanderlande-t4-t6-modules')}
              disabled={t4t6Rows.length === 0}
            />
          </div>
        }
      >
        <DataState
          loading={t4t6.loading}
          error={t4t6.error}
          isEmpty={t4t6Rows.length === 0}
          emptyTitle="No T4→T6 transitions in scope"
        >
          <RecordTable
            rows={t4t6Rows}
            rowKey={(row) => itemKeyFor(row, 'T4T6')}
            columns={riskColumns('T4T6')}
          />
        </DataState>
      </SectionCard>

      <SectionCard
        title="T6 at sale — policy exceptions"
        description="Modules sold when they were already end-of-sales. Indicates a process-control gap rather than an installed-base risk."
        actions={
          <ExportButton
            label="Export T6-at-sale"
            onClick={() => exportRows(t6Rows, 'vanderlande-t6-at-sale')}
            disabled={t6Rows.length === 0}
          />
        }
      >
        <DataState
          loading={t6AtSale.loading}
          error={t6AtSale.error}
          isEmpty={t6Rows.length === 0}
          emptyTitle="No T6-at-sale exceptions in scope"
        >
          <RecordTable
            rows={t6Rows}
            rowKey={(row) => itemKeyFor(row, 'T6SALE')}
            maxRows={50}
            columns={[
              {
                key: 'customer',
                header: 'Customer',
                render: (row) => <span className="font-medium">{row.customer_name}</span>,
              },
              { key: 'country', header: 'Country', render: (row) => row.country },
              { key: 'project', header: 'Project', render: (row) => row.project_name },
              { key: 'module', header: 'Module', render: (row) => row.module_name },
              {
                key: 'now',
                header: 'Stage now',
                render: (row) => <LifecycleBadge stage={row.lifecycle_stage_current} />,
              },
              {
                key: 'value',
                header: 'Sales value',
                numeric: true,
                render: (row) => formatEUR(row.sales_value_eur),
              },
              { key: 'date', header: 'Sold', render: (row) => formatDate(row.sales_date) },
            ]}
          />
        </DataState>
      </SectionCard>

      {activity.available && <ActivityFeed entries={activity.entries} />}

      <InfoNote>
        Lifecycle stages: T4 freely sellable · T6 end of sales (supported) · T9 end of support (no spare
        parts, no service). Synthetic demonstration data; queries respect Unity Catalog permissions.
      </InfoNote>
    </div>
  );
}

/** Local CSV helper bound to the risk column set. */
function toCSVRows(rows: readonly RiskRow[]): string {
  return toCSV(rows, RISK_CSV_COLUMNS);
}
