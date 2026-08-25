/**
 * Page 2 — Configuration Compliance.
 *
 * Persona: Sales Operations, preparing a quarterly business review. Find the
 * module sales that fall outside the solution eligibility matrix, decide which
 * need VP sign-off, and record that decision.
 *
 * An "exception" is a module sold on a project whose solution (FASTPICK or
 * STOREPICK) that module is not eligible for, per solution_module_matrix.
 */
import { useMemo, useState } from 'react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  BarChart,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useAnalyticsQuery,
} from '@databricks/appkit-ui/react';
import { sql } from '@databricks/appkit-ui/js';
import { CheckCircle2, Info, ScaleIcon, TriangleAlert } from 'lucide-react';
import {
  DataState,
  ExportButton,
  FilterSelect,
  InfoNote,
  KpiCard,
  PageHeader,
  SectionCard,
  SolutionBadge,
  SourceNote,
} from '../components/kit';
import { RecordTable } from '../components/RecordTable';
import { ReviewActionControl } from '../components/ReviewAction';
import { SavedViewsControl } from '../components/SavedViews';
import { downloadCSV, formatDate, formatEUR, formatEURCompact, formatNumber, formatPercent, toCSV, toNum } from '../lib/format';
import { useExceptionReviews, useSavedViews } from '../lib/state';

const SOLUTION_OPTIONS = [
  { value: 'FASTPICK', label: 'FASTPICK' },
  { value: 'STOREPICK', label: 'STOREPICK' },
] as const;

export function CompliancePage() {
  const [solution, setSolution] = useState('all');
  const [family, setFamily] = useState('all');

  const params = useMemo(
    () => ({ solution: sql.string(solution), family: sql.string(family) }),
    [solution, family],
  );
  const solutionOnlyParams = useMemo(() => ({ solution: sql.string(solution) }), [solution]);
  const noParams = useMemo(() => ({}), []);

  const kpis = useAnalyticsQuery('compliance_kpis', params);
  const exceptions = useAnalyticsQuery('compliance_exceptions', params);
  const byFamily = useAnalyticsQuery('compliance_by_family', solutionOnlyParams);
  const eligibility = useAnalyticsQuery('compliance_eligibility', noParams);
  const families = useAnalyticsQuery('filter_families', noParams);

  const reviews = useExceptionReviews();
  const savedViews = useSavedViews('compliance');

  const kpi = kpis.data?.[0];
  const exceptionRows = exceptions.data ?? [];

  const familyOptions = useMemo(
    () => (families.data ?? []).map((row) => ({ value: row.product_family, label: row.product_family })),
    [families.data],
  );

  /** Stable key per exception instance. */
  const itemKeyFor = (row: { project_id: string; module_name: string; sales_date: string }) =>
    `EXC|${row.project_id}|${row.module_name}|${row.sales_date}`;

  const scopeLabel = [
    solution === 'all' ? 'both solutions' : solution,
    family === 'all' ? 'all product families' : family,
  ].join(' · ');

  // exception_rate comes back as a STRING (ROUND result) — Number() before use.
  const exceptionRate = kpi ? toNum(kpi.exception_rate) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuration Compliance"
        message={
          kpi
            ? `${formatNumber(kpi.exception_modules)} module sales (${formatPercent(exceptionRate, 2)} of ${formatNumber(kpi.total_modules)} in scope) sit outside their eligible solution matrix, worth ${formatEURCompact(kpi.exception_value_eur)} across ${formatNumber(kpi.affected_projects)} projects.`
            : 'Module sales that fall outside the FASTPICK / STOREPICK eligibility matrix.'
        }
        actions={
          savedViews.available ? (
            <SavedViewsControl
              views={savedViews.views}
              current={{ name: '', solution, family }}
              onSave={savedViews.save}
              onRemove={savedViews.remove}
              onApply={(view) => {
                setSolution(view.solution ?? 'all');
                setFamily(view.family ?? 'all');
              }}
            />
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <FilterSelect
          label="Solution"
          value={solution}
          onChange={setSolution}
          options={SOLUTION_OPTIONS}
          allLabel="Both solutions"
        />
        <FilterSelect
          label="Product family"
          value={family}
          onChange={setFamily}
          options={familyOptions}
          allLabel="All families"
        />
      </div>

      {!reviews.available && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Read-only mode</AlertTitle>
          <AlertDescription>
            Persistent storage is unavailable, so review decisions can&apos;t be recorded right now. The
            exception data below is still live.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Exceptions"
          value={kpi ? formatNumber(kpi.exception_modules) : '—'}
          sublabel={kpi ? `of ${formatNumber(kpi.total_modules)} module sales in scope` : undefined}
          tone="warning"
          loading={kpis.loading}
          icon={<TriangleAlert className="h-4 w-4" />}
        />
        <KpiCard
          label="Exception rate"
          value={kpi ? formatPercent(exceptionRate, 2) : '—'}
          sublabel="Expected below 5% of project-module combinations"
          tone={exceptionRate > 5 ? 'destructive' : 'success'}
          loading={kpis.loading}
          icon={<ScaleIcon className="h-4 w-4" />}
        />
        <KpiCard
          label="Exception value"
          value={kpi ? formatEURCompact(kpi.exception_value_eur) : '—'}
          sublabel={
            kpi
              ? `of ${formatEURCompact(kpi.total_value_eur)} module revenue in scope`
              : undefined
          }
          tone="default"
          loading={kpis.loading}
        />
        <KpiCard
          label="Reviewed"
          value={
            reviews.available && reviews.summary
              ? `${formatNumber(reviews.summary.cleared)} / ${formatNumber(reviews.summary.total)}`
              : '—'
          }
          sublabel={
            reviews.available
              ? 'Resolved or marked false-positive by the team'
              : 'Requires persistent storage'
          }
          tone="success"
          loading={false}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
      </div>

      <SourceNote>
        Exception rule: <code>is_solution_compatible = false</code> — the module is not eligible for the
        project&apos;s solution per{' '}
        <code>serverless_stable_cps4hg_catalog.ddi_hackathon.solution_module_matrix</code>. Scope:{' '}
        {scopeLabel}.
      </SourceNote>

      <SectionCard
        title="Which product families drive exceptions"
        description="Exception count by family, worst first — where the configuration discipline slips."
        actions={
          <ExportButton
            label="Export summary"
            onClick={() =>
              downloadCSV(
                'vanderlande-compliance-by-family',
                toCSV(byFamily.data ?? [], [
                  { key: 'product_family', label: 'Product family' },
                  { key: 'exception_modules', label: 'Exceptions' },
                  { key: 'total_modules', label: 'Total module sales' },
                  { key: 'exception_rate', label: 'Exception rate (%)' },
                  { key: 'exception_value_eur', label: 'Exception value (EUR)' },
                ]),
              )
            }
            disabled={(byFamily.data ?? []).length === 0}
          />
        }
      >
        <DataState
          loading={byFamily.loading}
          error={byFamily.error}
          isEmpty={(byFamily.data ?? []).length === 0}
          emptyTitle="No families in scope"
        >
          <BarChart
            queryKey="compliance_by_family"
            parameters={solutionOnlyParams}
            xKey="product_family"
            yKey="exception_modules"
            height={300}
            colorPalette="sequential"
            ariaLabel="Configuration exceptions by product family"
          />
        </DataState>
      </SectionCard>

      <Tabs defaultValue="exceptions">
        <TabsList>
          <TabsTrigger value="exceptions">Exception detail</TabsTrigger>
          <TabsTrigger value="matrix">Eligibility matrix</TabsTrigger>
        </TabsList>

        <TabsContent value="exceptions" className="mt-4">
          <SectionCard
            title="Configuration exceptions — VP approval worklist"
            description="Newest sale first. Record a review decision against each row."
            actions={
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning">
                  {formatNumber(exceptionRows.length)} exceptions
                </Badge>
                <ExportButton
                  label="Export exceptions"
                  onClick={() =>
                    downloadCSV(
                      'vanderlande-config-exceptions',
                      toCSV(exceptionRows, [
                        { key: 'customer_name', label: 'Customer' },
                        { key: 'customer_segment', label: 'Segment' },
                        { key: 'country', label: 'Country' },
                        { key: 'project_id', label: 'Project ID' },
                        { key: 'project_name', label: 'Project' },
                        { key: 'solution_name', label: 'Solution' },
                        { key: 'module_name', label: 'Module' },
                        { key: 'module_group', label: 'Module group' },
                        { key: 'product_family', label: 'Product family' },
                        { key: 'quantity', label: 'Quantity' },
                        { key: 'sales_value_eur', label: 'Sales value (EUR)' },
                        { key: 'sales_date', label: 'Sales date' },
                        { key: 'project_status', label: 'Project status' },
                      ]),
                    )
                  }
                  disabled={exceptionRows.length === 0}
                />
              </div>
            }
          >
            <DataState
              loading={exceptions.loading}
              error={exceptions.error}
              isEmpty={exceptionRows.length === 0}
              emptyTitle="No exceptions in scope"
              emptyDescription="Every module sale in this filter is eligible for its project's solution. Try widening the filter."
            >
              <RecordTable
                rows={exceptionRows}
                rowKey={(row) => itemKeyFor(row)}
                columns={[
                  {
                    key: 'customer',
                    header: 'Customer',
                    render: (row) => <span className="font-medium">{row.customer_name}</span>,
                  },
                  { key: 'country', header: 'Country', render: (row) => row.country },
                  { key: 'project', header: 'Project', render: (row) => row.project_name },
                  {
                    key: 'solution',
                    header: 'Solution',
                    render: (row) => <SolutionBadge solution={row.solution_name} />,
                  },
                  { key: 'module', header: 'Module', render: (row) => row.module_name },
                  { key: 'family', header: 'Product family', render: (row) => row.product_family },
                  {
                    key: 'value',
                    header: 'Sales value',
                    numeric: true,
                    render: (row) => formatEUR(row.sales_value_eur),
                  },
                  { key: 'date', header: 'Sold', render: (row) => formatDate(row.sales_date) },
                  {
                    key: 'review',
                    header: 'Review',
                    render: (row) =>
                      reviews.available ? (
                        <ReviewActionControl
                          itemKey={itemKeyFor(row)}
                          customer={row.customer_name}
                          project={row.project_name}
                          module={row.module_name}
                          country={row.country}
                          existing={reviews.byKey.get(itemKeyFor(row))}
                          onSave={reviews.save}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      ),
                  },
                ]}
              />
            </DataState>
          </SectionCard>
        </TabsContent>

        <TabsContent value="matrix" className="mt-4">
          <SectionCard
            title="Solution eligibility matrix"
            description="The rule set that defines an exception: which modules are eligible for FASTPICK, STOREPICK, or both."
          >
            <DataState
              loading={eligibility.loading}
              error={eligibility.error}
              isEmpty={(eligibility.data ?? []).length === 0}
              emptyTitle="Matrix unavailable"
            >
              <RecordTable
                rows={eligibility.data ?? []}
                rowKey={(row) => `${row.product_family}|${row.module_name}`}
                maxRows={100}
                columns={[
                  { key: 'family', header: 'Product family', render: (row) => row.product_family },
                  { key: 'group', header: 'Module group', render: (row) => row.module_group },
                  {
                    key: 'module',
                    header: 'Module',
                    render: (row) => <span className="font-medium">{row.module_name}</span>,
                  },
                  {
                    key: 'fastpick',
                    header: 'FASTPICK',
                    render: (row) =>
                      row.eligible_fastpick ? (
                        <Badge variant="outline" className="border-success/40 bg-success/10 text-success">
                          Eligible
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not eligible</span>
                      ),
                  },
                  {
                    key: 'storepick',
                    header: 'STOREPICK',
                    render: (row) =>
                      row.eligible_storepick ? (
                        <Badge variant="outline" className="border-success/40 bg-success/10 text-success">
                          Eligible
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not eligible</span>
                      ),
                  },
                ]}
              />
            </DataState>
          </SectionCard>
        </TabsContent>
      </Tabs>

      <InfoNote>
        Exceptions are not automatically wrong — a customer may genuinely need a capability that is not
        standard for their solution type. They do require explicit justification and VP sign-off. Synthetic
        demonstration data.
      </InfoNote>
    </div>
  );
}
