/**
 * Shared presentational primitives, composed only from components actually
 * exported by @databricks/appkit-ui. AppKit ships no prebuilt KPI/metric card,
 * so KpiCard below is composed from Card* + Skeleton.
 *
 * Colour rule: semantic design tokens only (--destructive, --warning, --success,
 * --primary, --muted-foreground). No raw hex, no raw Tailwind palette utilities —
 * both bypass the tokens and break dark mode.
 */
import type { ReactNode } from 'react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@databricks/appkit-ui/react';
import { AlertTriangle, Download, Info } from 'lucide-react';
import { cn } from '../lib/utils';

/** Semantic intent for a metric: maps to a design token, never a raw colour. */
export type Tone = 'default' | 'destructive' | 'warning' | 'success';

const TONE_TEXT: Record<Tone, string> = {
  default: 'text-foreground',
  destructive: 'text-destructive',
  warning: 'text-warning',
  success: 'text-success',
};

const TONE_BAR: Record<Tone, string> = {
  default: 'bg-primary',
  destructive: 'bg-destructive',
  warning: 'bg-warning',
  success: 'bg-success',
};

/** Page title block. `message` carries the IBCS "message-in-title" finding. */
export function PageHeader({
  title,
  message,
  actions,
}: {
  title: string;
  message?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {message && <p className="mt-1 max-w-4xl text-sm text-muted-foreground">{message}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/**
 * A single KPI: value + unit, its label, and a sublabel carrying the comparison /
 * period / provenance (IBCS requires a number never stand alone).
 */
export function KpiCard({
  label,
  value,
  sublabel,
  tone = 'default',
  loading,
  icon,
}: {
  label: string;
  value: ReactNode;
  sublabel?: ReactNode;
  tone?: Tone;
  loading?: boolean;
  icon?: ReactNode;
}) {
  return (
    <Card className="relative overflow-hidden">
      <span className={cn('absolute inset-y-0 left-0 w-1', TONE_BAR[tone])} aria-hidden="true" />
      <CardContent className="p-4 pl-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          {icon && <span className={TONE_TEXT[tone]}>{icon}</span>}
        </div>
        {loading ? (
          <Skeleton className="mt-2 h-8 w-24" />
        ) : (
          <p className={cn('mt-1 text-3xl font-bold tabular-nums', TONE_TEXT[tone])}>{value}</p>
        )}
        {sublabel && <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>}
      </CardContent>
    </Card>
  );
}

/** Titled section container. `description` states what the section answers. */
export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/**
 * The four required data states for every data view: error, loading, empty, ready.
 * Errors render inline (never a blank panel); empty gets a useful next action.
 */
export function DataState({
  loading,
  error,
  isEmpty,
  emptyTitle = 'No matching records',
  emptyDescription,
  skeletonRows = 5,
  children,
}: {
  loading: boolean;
  error?: string | null;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  skeletonRows?: number;
  children: ReactNode;
}) {
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Couldn&apos;t load this data</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: skeletonRows }, (_, i) => (
          <Skeleton key={`row-${i}`} className="h-9 w-full" />
        ))}
      </div>
    );
  }
  if (isEmpty) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          {emptyDescription && <EmptyDescription>{emptyDescription}</EmptyDescription>}
        </EmptyHeader>
      </Empty>
    );
  }
  return <>{children}</>;
}

/** CSV export trigger. Disabled when there is nothing to export. */
export function ExportButton({
  onClick,
  disabled,
  label = 'Export CSV',
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={disabled}>
      <Download className="mr-1.5 h-4 w-4" />
      {label}
    </Button>
  );
}

/**
 * Filter dropdown with an "All" sentinel. SelectItem cannot take value="", so the
 * no-filter case uses the literal 'all', which the SQL matches on.
 */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel = 'All',
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  allLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 min-w-[11rem]">
          <SelectValue placeholder={allLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const LIFECYCLE_TONE: Record<string, Tone> = {
  T4: 'success', // freely sellable
  T6: 'warning', // end of sales, still supported
  T9: 'destructive', // end of support — no spare parts, no service
};

const TONE_BADGE: Record<Tone, string> = {
  default: '',
  destructive: 'border-destructive/40 bg-destructive/10 text-destructive',
  warning: 'border-warning/40 bg-warning/10 text-warning',
  success: 'border-success/40 bg-success/10 text-success',
};

/** Lifecycle stage badge. Same stage always gets the same notation (IBCS UNIFY). */
export function LifecycleBadge({ stage }: { stage: string }) {
  const tone = LIFECYCLE_TONE[stage] ?? 'default';
  return (
    <Badge variant="outline" className={TONE_BADGE[tone]}>
      {stage}
    </Badge>
  );
}

/** Risk-severity badge used across risk tables, keyed off the risk label. */
export function RiskBadge({ risk }: { risk: string }) {
  const tone: Tone = risk.startsWith('T9')
    ? 'destructive'
    : risk.startsWith('T4') || risk.startsWith('T6')
      ? 'warning'
      : 'default';
  return (
    <Badge variant="outline" className={TONE_BADGE[tone]}>
      {risk}
    </Badge>
  );
}

/**
 * Solution architecture badge. FASTPICK and STOREPICK are merely *different*
 * categories (not ordered), so they take two categorical chart tokens.
 */
export function SolutionBadge({ solution }: { solution: string }) {
  const isFastpick = solution === 'FASTPICK';
  return (
    <Badge
      variant="outline"
      className={isFastpick ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-muted'}
      style={isFastpick ? undefined : { color: 'var(--chart-3)' }}
    >
      {solution}
    </Badge>
  );
}

/** Low-key contextual note — data source, freshness, caveats, disclaimers. */
export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-xs text-muted-foreground">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

/** Provenance line for a KPI block: source table + grain + governance. */
export function SourceNote({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}
