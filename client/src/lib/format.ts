/**
 * Formatting + CSV export helpers.
 *
 * IMPORTANT: every numeric helper takes `number | string`. Databricks SQL returns
 * DECIMAL, large BIGINT and ROUND()/AVG()/SUM() results as JSON *strings* at
 * runtime even though the generated types say `number`, so all arithmetic must go
 * through `toNum()` first.
 */

export const toNum = (value: number | string | null | undefined): number =>
  value === null || value === undefined || value === '' ? 0 : Number(value);

/** Compact EUR for KPIs and axes, e.g. €9.5B, €12.4M, €950K. */
export function formatEURCompact(value: number | string | null | undefined): string {
  const n = toNum(value);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}€${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}€${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}€${(abs / 1_000).toFixed(0)}K`;
  return `${sign}€${abs.toFixed(0)}`;
}

/** Full EUR with thousands grouping, e.g. €12,345,678 — for tables and exports. */
export function formatEUR(value: number | string | null | undefined): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(toNum(value));
}

export function formatNumber(value: number | string | null | undefined): string {
  return new Intl.NumberFormat('en-US').format(toNum(value));
}

export function formatPercent(value: number | string | null | undefined, digits = 1): string {
  return `${toNum(value).toFixed(digits)}%`;
}

/** Date only, e.g. "18 Dec 2026". Returns an em dash for missing values. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' });
}

/** Compact relative time for the activity feed, e.g. "just now", "5m ago". */
export function formatRelativeTime(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

export interface CsvColumn {
  key: string;
  label: string;
}

/**
 * Serialize rows to CSV, quoting anything containing a comma, quote or newline.
 *
 * Rows are typed as `object` rather than `Record<string, unknown>` so that
 * interface-typed query rows (which have no index signature) can be passed
 * directly at the call site — `column.key` is looked up reflectively.
 */
export function toCSV(rows: readonly object[], columns: readonly CsvColumn[]): string {
  const escape = (value: unknown): string => {
    let s: string;
    if (value === null || value === undefined) s = '';
    else if (typeof value === 'string') s = value;
    else if (typeof value === 'number' || typeof value === 'boolean') s = String(value);
    else s = JSON.stringify(value);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => escape(c.label)).join(',');
  const body = rows
    .map((row) => {
      // Reflective lookup keeps this usable with interface-typed query rows,
      // which have no index signature.
      const record = row as Readonly<Record<string, unknown>>;
      return columns.map((c) => escape(record[c.key])).join(',');
    })
    .join('\n');
  return `${header}\n${body}`;
}

/** Trigger a client-side CSV download. */
export function downloadCSV(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
