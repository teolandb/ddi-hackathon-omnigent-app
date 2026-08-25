/**
 * Page 3 — Strategic Account Explorer.
 *
 * Persona: Key Account Manager preparing for a customer strategy meeting. Pick a
 * multi-project account, then see its whole portfolio: projects, module spend,
 * lifecycle risks, geographic footprint — plus a persistent relationship log.
 *
 * Composition: hierarchical (select an account -> drill into its facets). The
 * account selector is the page's single parameterization; everything below it is
 * scoped to that one entity.
 */
import { useMemo, useState } from 'react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  BarChart,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  useAnalyticsQuery,
} from '@databricks/appkit-ui/react';
import { sql } from '@databricks/appkit-ui/js';
import { Building2, Globe2, Info, Loader2, Trash2 } from 'lucide-react';
import {
  DataState,
  ExportButton,
  InfoNote,
  KpiCard,
  PageHeader,
  RiskBadge,
  SectionCard,
  SolutionBadge,
  SourceNote,
} from '../components/kit';
import { RecordTable } from '../components/RecordTable';
import {
  downloadCSV,
  formatDate,
  formatEUR,
  formatEURCompact,
  formatNumber,
  formatRelativeTime,
  toCSV,
  toNum,
} from '../lib/format';
import { useAccountNotes, useWhoAmI } from '../lib/state';

/** Project status -> semantic token. 'won'/'completed' are good outcomes. */
const STATUS_CLASS: Record<string, string> = {
  won: 'border-success/40 bg-success/10 text-success',
  completed: 'border-success/40 bg-success/10 text-success',
  in_progress: 'border-primary/40 bg-primary/10 text-primary',
  lost: 'border-destructive/40 bg-destructive/10 text-destructive',
};

/** Filesystem-safe slug for export filenames. */
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function AccountsPage() {
  // `selected` is empty until the user picks; the effective account falls back to
  // the largest by portfolio value. Derived rather than synced via an effect, so
  // there is no render-then-correct flash and no setState-in-effect.
  const [selected, setSelected] = useState('');
  const noParams = useMemo(() => ({}), []);
  const accounts = useAnalyticsQuery('accounts_multi', noParams);

  const customer = selected || (accounts.data?.[0]?.customer_name ?? '');
  const setCustomer = setSelected;

  const customerParams = useMemo(() => ({ customer: sql.string(customer) }), [customer]);

  // autoStart stays false until an account is chosen, so we never fire an empty query.
  const hasCustomer = customer.length > 0;
  const kpis = useAnalyticsQuery('account_kpis', customerParams, { autoStart: hasCustomer });
  const projects = useAnalyticsQuery('account_projects', customerParams, { autoStart: hasCustomer });
  const modules = useAnalyticsQuery('account_modules', customerParams, { autoStart: hasCustomer });
  const risks = useAnalyticsQuery('account_risks', customerParams, { autoStart: hasCustomer });
  const geography = useAnalyticsQuery('account_geography', customerParams, { autoStart: hasCustomer });

  const notes = useAccountNotes(customer);
  const me = useWhoAmI();

  const kpi = kpis.data?.[0];

  const [noteBody, setNoteBody] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const handleAddNote = async () => {
    if (!noteBody.trim()) return;
    setSavingNote(true);
    const ok = await notes.add(noteBody.trim());
    setSavingNote(false);
    if (ok) setNoteBody('');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Strategic Account Explorer"
        message={
          kpi
            ? `${customer} runs ${formatNumber(kpi.projects)} projects across ${formatNumber(kpi.countries)} countries worth ${formatEURCompact(kpi.total_value_eur)} in module revenue, with ${formatNumber(toNum(kpi.t9_count) + toNum(kpi.t4_t6_count))} modules at lifecycle risk.`
            : 'Deep-dive into a multi-project account: portfolio, module mix, lifecycle risk and footprint.'
        }
      />

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="account-select">
          Account (customers with 2 or more projects)
        </label>
        <Select value={customer} onValueChange={setCustomer}>
          <SelectTrigger className="h-9 w-full max-w-md" id="account-select">
            <SelectValue placeholder="Select an account…" />
          </SelectTrigger>
          <SelectContent>
            {(accounts.data ?? []).map((row) => (
              <SelectItem key={row.customer_name} value={row.customer_name}>
                {row.customer_name} — {formatNumber(row.projects)} projects ·{' '}
                {formatEURCompact(row.total_value_eur)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {accounts.loading && <p className="text-sm text-muted-foreground">Loading strategic accounts…</p>}
      {accounts.error && (
        <Alert variant="destructive">
          <Info className="h-4 w-4" />
          <AlertTitle>Couldn&apos;t load accounts</AlertTitle>
          <AlertDescription>{accounts.error}</AlertDescription>
        </Alert>
      )}

      {!hasCustomer ? (
        <SectionCard title="No account selected" description="Choose an account above to begin.">
          <p className="text-sm text-muted-foreground">
            The list contains every customer with at least two projects, ordered by portfolio value.
          </p>
        </SectionCard>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Projects"
              value={kpi ? formatNumber(kpi.projects) : '—'}
              sublabel={
                kpi
                  ? `${formatNumber(kpi.fastpick_projects)} FASTPICK · ${formatNumber(kpi.storepick_projects)} STOREPICK`
                  : undefined
              }
              loading={kpis.loading}
              icon={<Building2 className="h-4 w-4" />}
            />
            <KpiCard
              label="Module revenue"
              value={kpi ? formatEURCompact(kpi.total_value_eur) : '—'}
              sublabel={kpi ? `${formatNumber(kpi.modules)} module sale lines` : undefined}
              loading={kpis.loading}
            />
            <KpiCard
              label="Countries"
              value={kpi ? formatNumber(kpi.countries) : '—'}
              sublabel={
                kpi
                  ? `First contract ${formatDate(kpi.first_contract)} · latest ${formatDate(kpi.latest_contract)}`
                  : undefined
              }
              loading={kpis.loading}
              icon={<Globe2 className="h-4 w-4" />}
            />
            <KpiCard
              label="At lifecycle risk"
              value={kpi ? formatNumber(toNum(kpi.t9_count) + toNum(kpi.t4_t6_count)) : '—'}
              sublabel={
                kpi
                  ? `${formatNumber(kpi.t9_count)} T9 · ${formatNumber(kpi.t4_t6_count)} T4→T6 · ${formatNumber(kpi.exception_count)} config`
                  : undefined
              }
              tone={kpi && toNum(kpi.t9_count) > 0 ? 'destructive' : 'warning'}
              loading={kpis.loading}
            />
          </div>

          <SourceNote>
            Scope: all module sales recorded for <strong>{customer}</strong> in{' '}
            <code>fact_project_module_intelligence</code>. Project value is the contracted total including
            margin; module revenue is the sum of module sale lines.
          </SourceNote>

          <SectionCard
            title="Project portfolio"
            description="Every project for this account, newest contract first."
            actions={
              <ExportButton
                label="Export projects"
                onClick={() =>
                  downloadCSV(
                    `vanderlande-${slug(customer)}-projects`,
                    toCSV(projects.data ?? [], [
                      { key: 'project_id', label: 'Project ID' },
                      { key: 'project_name', label: 'Project' },
                      { key: 'country', label: 'Country' },
                      { key: 'region', label: 'Region' },
                      { key: 'solution_name', label: 'Solution' },
                      { key: 'project_status', label: 'Status' },
                      { key: 'project_size_category', label: 'Size' },
                      { key: 'contract_date', label: 'Contract date' },
                      { key: 'project_value_eur', label: 'Project value (EUR)' },
                      { key: 'modules', label: 'Modules' },
                      { key: 't9_modules', label: 'T9 modules' },
                      { key: 't4_t6_modules', label: 'T4->T6 modules' },
                      { key: 'exception_modules', label: 'Config exceptions' },
                    ]),
                  )
                }
                disabled={(projects.data ?? []).length === 0}
              />
            }
          >
            <DataState
              loading={projects.loading}
              error={projects.error}
              isEmpty={(projects.data ?? []).length === 0}
              emptyTitle="No projects found"
            >
              <RecordTable
                rows={projects.data ?? []}
                rowKey={(row) => row.project_id}
                maxRows={50}
                columns={[
                  {
                    key: 'project',
                    header: 'Project',
                    render: (row) => (
                      <div>
                        <span className="font-medium">{row.project_name}</span>
                        <span className="block text-xs text-muted-foreground">{row.project_id}</span>
                      </div>
                    ),
                  },
                  { key: 'country', header: 'Country', render: (row) => row.country },
                  {
                    key: 'solution',
                    header: 'Solution',
                    render: (row) => <SolutionBadge solution={row.solution_name} />,
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (row) => (
                      <Badge variant="outline" className={STATUS_CLASS[row.project_status] ?? ''}>
                        {row.project_status}
                      </Badge>
                    ),
                  },
                  { key: 'size', header: 'Size', render: (row) => row.project_size_category },
                  { key: 'date', header: 'Contracted', render: (row) => formatDate(row.contract_date) },
                  {
                    key: 'value',
                    header: 'Project value',
                    numeric: true,
                    render: (row) => formatEUR(row.project_value_eur),
                  },
                  {
                    key: 'modules',
                    header: 'Modules',
                    numeric: true,
                    render: (row) => formatNumber(row.modules),
                  },
                  {
                    key: 'risk',
                    header: 'Risk',
                    numeric: true,
                    render: (row) =>
                      toNum(row.t9_modules) > 0 ? (
                        <span className="font-semibold text-destructive">
                          {formatNumber(row.t9_modules)} T9
                        </span>
                      ) : toNum(row.t4_t6_modules) > 0 ? (
                        <span className="font-semibold text-warning">
                          {formatNumber(row.t4_t6_modules)} T6
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      ),
                  },
                ]}
              />
            </DataState>
          </SectionCard>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectionCard
              title="Module spend by product family"
              description="Where this account invests — highest spend first."
            >
              <DataState
                loading={modules.loading}
                error={modules.error}
                isEmpty={(modules.data ?? []).length === 0}
                emptyTitle="No module spend recorded"
              >
                <BarChart
                  queryKey="account_modules"
                  parameters={customerParams}
                  xKey="product_family"
                  yKey="value_eur"
                  orientation="horizontal"
                  height={300}
                  colorPalette="sequential"
                  ariaLabel={`Module spend by product family for ${customer}`}
                />
              </DataState>
            </SectionCard>

            <SectionCard
              title="Geographic footprint"
              description="Where this account has Vanderlande installations."
              actions={
                <ExportButton
                  label="Export footprint"
                  onClick={() =>
                    downloadCSV(
                      `vanderlande-${slug(customer)}-footprint`,
                      toCSV(geography.data ?? [], [
                        { key: 'country', label: 'Country' },
                        { key: 'region', label: 'Region' },
                        { key: 'projects', label: 'Projects' },
                        { key: 'value_eur', label: 'Module value (EUR)' },
                        { key: 'at_risk_modules', label: 'At-risk modules' },
                      ]),
                    )
                  }
                  disabled={(geography.data ?? []).length === 0}
                />
              }
            >
              <DataState
                loading={geography.loading}
                error={geography.error}
                isEmpty={(geography.data ?? []).length === 0}
                emptyTitle="No locations recorded"
              >
                <RecordTable
                  rows={geography.data ?? []}
                  rowKey={(row) => row.country}
                  maxRows={20}
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
                      render: (row) => formatNumber(row.projects),
                    },
                    {
                      key: 'value',
                      header: 'Module value',
                      numeric: true,
                      render: (row) => formatEUR(row.value_eur),
                    },
                    {
                      key: 'risk',
                      header: 'At risk',
                      numeric: true,
                      render: (row) =>
                        toNum(row.at_risk_modules) > 0 ? (
                          <span className="font-semibold text-warning">
                            {formatNumber(row.at_risk_modules)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        ),
                    },
                  ]}
                />
              </DataState>
            </SectionCard>
          </div>

          <SectionCard
            title="Module portfolio and risk status"
            description="Every module this account owns, with its worst-case lifecycle status."
            actions={
              <ExportButton
                label="Export modules"
                onClick={() =>
                  downloadCSV(
                    `vanderlande-${slug(customer)}-modules`,
                    toCSV(modules.data ?? [], [
                      { key: 'product_family', label: 'Product family' },
                      { key: 'module_name', label: 'Module' },
                      { key: 'sale_lines', label: 'Sale lines' },
                      { key: 'units', label: 'Units' },
                      { key: 'value_eur', label: 'Value (EUR)' },
                      { key: 'risk_status', label: 'Risk status' },
                    ]),
                  )
                }
                disabled={(modules.data ?? []).length === 0}
              />
            }
          >
            <DataState
              loading={modules.loading}
              error={modules.error}
              isEmpty={(modules.data ?? []).length === 0}
              emptyTitle="No modules recorded"
            >
              <RecordTable
                rows={modules.data ?? []}
                rowKey={(row) => `${row.product_family}|${row.module_name}`}
                maxRows={60}
                columns={[
                  { key: 'family', header: 'Product family', render: (row) => row.product_family },
                  {
                    key: 'module',
                    header: 'Module',
                    render: (row) => <span className="font-medium">{row.module_name}</span>,
                  },
                  {
                    key: 'units',
                    header: 'Units',
                    numeric: true,
                    render: (row) => formatNumber(row.units),
                  },
                  {
                    key: 'value',
                    header: 'Value',
                    numeric: true,
                    render: (row) => formatEUR(row.value_eur),
                  },
                  {
                    key: 'risk',
                    header: 'Risk status',
                    render: (row) => <RiskBadge risk={row.risk_status} />,
                  },
                ]}
              />
            </DataState>
          </SectionCard>

          <SectionCard
            title="Lifecycle risks in this account"
            description="Modules needing migration planning or configuration justification."
            actions={
              <ExportButton
                label="Export risks"
                onClick={() =>
                  downloadCSV(
                    `vanderlande-${slug(customer)}-risks`,
                    toCSV(risks.data ?? [], [
                      { key: 'country', label: 'Country' },
                      { key: 'project_id', label: 'Project ID' },
                      { key: 'project_name', label: 'Project' },
                      { key: 'solution_name', label: 'Solution' },
                      { key: 'module_name', label: 'Module' },
                      { key: 'product_family', label: 'Product family' },
                      { key: 'quantity', label: 'Quantity' },
                      { key: 'sales_value_eur', label: 'Sales value (EUR)' },
                      { key: 'sales_date', label: 'Sales date' },
                      { key: 'risk_type', label: 'Risk type' },
                    ]),
                  )
                }
                disabled={(risks.data ?? []).length === 0}
              />
            }
          >
            <DataState
              loading={risks.loading}
              error={risks.error}
              isEmpty={(risks.data ?? []).length === 0}
              emptyTitle="No lifecycle risk in this account"
              emptyDescription="Every module here is freely sellable and eligible for its project's solution."
            >
              <RecordTable
                rows={risks.data ?? []}
                rowKey={(row, index) => `${row.project_id}|${row.module_name}|${index}`}
                maxRows={60}
                columns={[
                  { key: 'country', header: 'Country', render: (row) => row.country },
                  { key: 'project', header: 'Project', render: (row) => row.project_name },
                  { key: 'module', header: 'Module', render: (row) => row.module_name },
                  {
                    key: 'risk',
                    header: 'Risk',
                    render: (row) => <RiskBadge risk={row.risk_type} />,
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

          {/* Relationship log — persisted in Lakebase, shared across the account team. */}
          <SectionCard
            title="Account notes"
            description="Persistent relationship log for this account, newest first."
          >
            {!notes.available ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Notes unavailable</AlertTitle>
                <AlertDescription>
                  Persistent storage isn&apos;t available for this deployment, so account notes can&apos;t
                  be saved right now.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Textarea
                    value={noteBody}
                    onChange={(event) => setNoteBody(event.target.value)}
                    rows={3}
                    placeholder={`Add a note about ${customer} — meeting outcome, migration commitment, expansion plan…`}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Saved as {me?.email ?? me?.user ?? 'the signed-in user'}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => void handleAddNote()}
                      disabled={savingNote || !noteBody.trim()}
                    >
                      {savingNote && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                      Add note
                    </Button>
                  </div>
                </div>

                {notes.loading ? (
                  <p className="text-sm text-muted-foreground">Loading notes…</p>
                ) : notes.notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No notes yet for {customer}. The first note starts the relationship log.
                  </p>
                ) : (
                  <ol className="space-y-3">
                    {notes.notes.map((note) => (
                      <li key={note.id} className="rounded-md border p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="whitespace-pre-wrap text-sm text-foreground">{note.body}</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => void notes.remove(note.id)}
                            aria-label="Delete note"
                            title="Delete (author only)"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {note.author_email ?? 'unknown'} · {formatRelativeTime(note.created_at)}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </SectionCard>
        </>
      )}

      <InfoNote>
        Strategic projects are those above €20M total contract value. Accounts listed here have two or more
        projects. Synthetic demonstration data.
      </InfoNote>
    </div>
  );
}
