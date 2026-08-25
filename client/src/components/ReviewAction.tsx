/**
 * Per-exception review control, persisted to Lakebase.
 *
 * Sales Operations uses this before a quarterly business review to mark each
 * configuration exception acknowledged / resolved / false-positive, so the
 * VP-approval list carries decisions rather than raw rows.
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
import type { ExceptionReview, ReviewStatus, SaveReviewInput } from '../lib/state';
import { REVIEW_STATUS_LABEL, REVIEW_STATUS_ORDER } from '../lib/state';

/** 'open' still needs attention (warning); resolved/false-positive are cleared. */
const STATUS_CLASS: Record<ReviewStatus, string> = {
  open: 'border-warning/40 bg-warning/10 text-warning',
  acknowledged: 'border-primary/40 bg-primary/10 text-primary',
  resolved: 'border-success/40 bg-success/10 text-success',
  false_positive: 'border-border bg-muted text-muted-foreground',
};

export function ReviewActionControl({
  itemKey,
  customer,
  project,
  module,
  country,
  existing,
  onSave,
}: {
  itemKey: string;
  customer: string;
  project: string;
  module: string;
  country: string;
  existing?: ExceptionReview;
  onSave: (input: SaveReviewInput) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ReviewStatus>(existing?.status ?? 'open');
  const [reviewer, setReviewer] = useState(existing?.reviewer_email ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const current = existing?.status ?? 'open';

  const handleSave = async () => {
    setSaving(true);
    setFailed(false);
    const ok = await onSave({
      itemKey,
      customer,
      project,
      module,
      country,
      status,
      reviewerEmail: reviewer || null,
      note: note || null,
    });
    setSaving(false);
    if (ok) setOpen(false);
    else setFailed(true);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="cursor-pointer" title="Record review decision">
          <Badge variant="outline" className={STATUS_CLASS[current]}>
            {REVIEW_STATUS_LABEL[current]}
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
          <label className="text-xs font-medium text-muted-foreground">Review decision</label>
          <Select value={status} onValueChange={(value) => setStatus(value as ReviewStatus)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REVIEW_STATUS_ORDER.map((option) => (
                <SelectItem key={option} value={option}>
                  {REVIEW_STATUS_LABEL[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor={`reviewer-${itemKey}`}>
            Reviewer (email)
          </label>
          <Input
            id={`reviewer-${itemKey}`}
            value={reviewer}
            onChange={(event) => setReviewer(event.target.value)}
            placeholder="sales.ops@vanderlande.com"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor={`note-${itemKey}`}>
            Justification
          </label>
          <Textarea
            id={`note-${itemKey}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder="Why was this module approved outside the standard matrix?"
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
