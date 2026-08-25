/**
 * Per-module migration status control, persisted to Lakebase.
 *
 * This is the write-back that turns the risk list from a report into a worklist:
 * a Product Lifecycle Manager can mark an at-risk module "contacted" / "migrated"
 * and every user of the app sees that state on their next load.
 */
import { useState } from 'react';
import {
  Badge,
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@databricks/appkit-ui/react';
import { Check, Loader2 } from 'lucide-react';
import type { ActionStatus, MigrationAction as MigrationActionRow, SaveActionInput } from '../lib/state';
import { ACTION_STATUS_LABEL, ACTION_STATUS_ORDER } from '../lib/state';

/** Status -> semantic token. 'migrated' is the good outcome, 'not_started' is neutral. */
const STATUS_CLASS: Record<ActionStatus, string> = {
  not_started: 'border-border bg-muted text-muted-foreground',
  contacted: 'border-primary/40 bg-primary/10 text-primary',
  in_progress: 'border-warning/40 bg-warning/10 text-warning',
  migrated: 'border-success/40 bg-success/10 text-success',
  dismissed: 'border-border bg-muted text-muted-foreground',
};

export function MigrationActionControl({
  itemKey,
  customer,
  project,
  module,
  country,
  riskType,
  existing,
  onSave,
}: {
  itemKey: string;
  customer: string;
  project: string;
  module: string;
  country: string;
  riskType: string;
  existing?: MigrationActionRow;
  onSave: (input: SaveActionInput) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ActionStatus>(existing?.status ?? 'not_started');
  const [owner, setOwner] = useState(existing?.owner_email ?? '');
  const [dueDate, setDueDate] = useState(existing?.due_date ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const current = existing?.status ?? 'not_started';

  const handleSave = async () => {
    setSaving(true);
    setFailed(false);
    const ok = await onSave({
      itemKey,
      customer,
      project,
      module,
      country,
      riskType,
      status,
      ownerEmail: owner || null,
      dueDate: dueDate || null,
      notes: notes || null,
    });
    setSaving(false);
    if (ok) setOpen(false);
    else setFailed(true);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="cursor-pointer" title="Update migration status">
          <Badge variant="outline" className={STATUS_CLASS[current]}>
            {ACTION_STATUS_LABEL[current]}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="end">
        <div>
          <p className="text-sm font-medium text-foreground">{module}</p>
          <p className="text-xs text-muted-foreground">
            {customer} · {project}
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Migration status</label>
          <Select value={status} onValueChange={(value) => setStatus(value as ActionStatus)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTION_STATUS_ORDER.map((option) => (
                <SelectItem key={option} value={option}>
                  {ACTION_STATUS_LABEL[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor={`owner-${itemKey}`}>
            Owner (email)
          </label>
          <Input
            id={`owner-${itemKey}`}
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            placeholder="service.manager@vanderlande.com"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor={`due-${itemKey}`}>
            Target date
          </label>
          <Input
            id={`due-${itemKey}`}
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor={`notes-${itemKey}`}>
            Notes
          </label>
          <Textarea
            id={`notes-${itemKey}`}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="Outreach context, migration path, customer response…"
          />
        </div>

        {failed && <p className="text-xs text-destructive">Couldn&apos;t save — please retry.</p>}

        <Button size="sm" className="w-full" onClick={() => void handleSave()} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-1.5 h-4 w-4" />
          )}
          Save
        </Button>
      </PopoverContent>
    </Popover>
  );
}
