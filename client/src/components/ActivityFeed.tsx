/**
 * Append-only audit trail of the team's write-backs (statuses, reviews, notes,
 * saved views). Answers "what has the team already actioned?" — the piece a
 * read-only dashboard cannot provide.
 */
import { Badge } from '@databricks/appkit-ui/react';
import { SectionCard } from './kit';
import { formatRelativeTime } from '../lib/format';
import type { ActivityEntry } from '../lib/state';

export function ActivityFeed({ entries }: { entries: readonly ActivityEntry[] }) {
  return (
    <SectionCard
      title="Team activity"
      description="Recent case-management actions across the app, newest first."
    >
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No activity yet. Updating a migration status, review decision or account note will appear here.
        </p>
      ) : (
        <ol className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start gap-3 text-sm">
              <Badge variant="secondary" className="mt-0.5 shrink-0 font-mono text-[10px]">
                {entry.action}
              </Badge>
              <div className="min-w-0">
                <p className="text-foreground">
                  <span className="font-medium">{entry.entity ?? 'unknown'}</span>
                  {entry.detail ? ` — ${entry.detail}` : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {entry.user_email ?? 'unknown user'} · {formatRelativeTime(entry.created_at)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}
