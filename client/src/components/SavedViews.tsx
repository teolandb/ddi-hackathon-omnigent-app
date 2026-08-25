/**
 * Per-user filter presets, persisted to Lakebase. Lets a Regional Director keep
 * "my region, my segment" one click away instead of re-selecting filters daily.
 */
import { useState } from 'react';
import {
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@databricks/appkit-ui/react';
import { BookmarkPlus, Trash2 } from 'lucide-react';
import type { SavedView, SaveViewInput } from '../lib/state';

export function SavedViewsControl({
  views,
  current,
  onSave,
  onRemove,
  onApply,
}: {
  views: readonly SavedView[];
  current: SaveViewInput;
  onSave: (input: SaveViewInput) => Promise<boolean>;
  onRemove: (id: string) => Promise<void>;
  onApply: (view: SavedView) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const ok = await onSave({ ...current, name: name.trim() });
    setSaving(false);
    if (ok) setName('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <BookmarkPlus className="mr-1.5 h-4 w-4" />
          Views{views.length > 0 ? ` (${views.length})` : ''}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="end">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="view-name">
            Save current filters as
          </label>
          <div className="flex gap-2">
            <Input
              id="view-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Nordics — Food &amp; Beverage"
            />
            <Button size="sm" onClick={() => void handleSave()} disabled={saving || !name.trim()}>
              Save
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Saved views</p>
          {views.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No saved views yet. Set your filters, then save them here — they persist across sessions.
            </p>
          ) : (
            views.map((view) => (
              <div
                key={view.id}
                className="flex items-center gap-1 rounded-md border pl-3 transition-colors hover:bg-muted"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 py-2 text-left text-sm text-foreground"
                  onClick={() => {
                    onApply(view);
                    setOpen(false);
                  }}
                >
                  <span className="block truncate">{view.name}</span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => void onRemove(view.id)}
                  aria-label={`Delete saved view ${view.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
