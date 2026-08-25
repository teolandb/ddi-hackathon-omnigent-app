/**
 * Client hooks for the Lakebase-backed persistent state (/api/*).
 *
 * These are MUTATION + app-state endpoints only. Warehouse data always comes from
 * `useAnalyticsQuery` against config/queries/*.sql — never from these routes.
 *
 * Every hook reports `available`, which flips false on HTTP 503 (Lakebase not
 * wired / schema not owned). Pages use it to degrade instead of showing errors.
 */
import { useCallback, useEffect, useState } from 'react';

async function getJson<T>(url: string): Promise<{ status: number; data: T | null }> {
  try {
    const res = await fetch(url);
    if (!res.ok) return { status: res.status, data: null };
    return { status: res.status, data: (await res.json()) as T };
  } catch {
    return { status: 0, data: null };
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function deleteJson(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}

// ============================================================
// Feature availability + identity
// ============================================================
export interface FeatureFlags {
  lakebase: boolean;
  lakebaseError: string | null;
}

/** Whether persistent state is live for this deployment. */
export function useFeatures(): FeatureFlags | null {
  const [flags, setFlags] = useState<FeatureFlags | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getJson<FeatureFlags>('/api/features').then(({ data }) => {
      if (!cancelled) setFlags(data ?? { lakebase: false, lakebaseError: 'unreachable' });
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return flags;
}

export interface WhoAmI {
  email: string | null;
  user: string | null;
}

/** Signed-in identity from the platform's forwarded headers. */
export function useWhoAmI(): WhoAmI | null {
  const [me, setMe] = useState<WhoAmI | null>(null);
  useEffect(() => {
    let cancelled = false;
    void getJson<WhoAmI>('/api/whoami').then(({ data }) => {
      if (!cancelled) setMe(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return me;
}

// ============================================================
// Migration action tracker (shared across the team)
// ============================================================
export type ActionStatus = 'not_started' | 'contacted' | 'in_progress' | 'migrated' | 'dismissed';

export const ACTION_STATUS_ORDER: readonly ActionStatus[] = [
  'not_started',
  'contacted',
  'in_progress',
  'migrated',
  'dismissed',
];

export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
  not_started: 'Not started',
  contacted: 'Customer contacted',
  in_progress: 'Migration in progress',
  migrated: 'Migrated',
  dismissed: 'Dismissed',
};

export interface MigrationAction {
  item_key: string;
  customer: string | null;
  project: string | null;
  module: string | null;
  country: string | null;
  risk_type: string | null;
  status: ActionStatus;
  owner_email: string | null;
  due_date: string | null;
  notes: string | null;
  updated_at: string;
}

export interface ActionSummary {
  byStatus: Partial<Record<ActionStatus, number>>;
  total: number;
  addressed: number;
}

export interface SaveActionInput {
  itemKey: string;
  customer?: string | null;
  project?: string | null;
  module?: string | null;
  country?: string | null;
  riskType?: string | null;
  status: ActionStatus;
  ownerEmail?: string | null;
  dueDate?: string | null;
  notes?: string | null;
}

export function useMigrationActions() {
  const [byKey, setByKey] = useState<Map<string, MigrationAction>>(new Map());
  const [summary, setSummary] = useState<ActionSummary | null>(null);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);

  const loadSummary = useCallback(async () => {
    const { data } = await getJson<ActionSummary>('/api/actions/summary');
    if (data) setSummary(data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { status, data } = await getJson<{ rows: MigrationAction[] }>('/api/actions');
      if (cancelled) return;
      if (status === 503 || status === 0) {
        setAvailable(false);
        setLoading(false);
        return;
      }
      const map = new Map<string, MigrationAction>();
      for (const row of data?.rows ?? []) map.set(row.item_key, row);
      setByKey(map);
      setAvailable(true);
      setLoading(false);
      await loadSummary();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSummary]);

  const save = useCallback(
    async (input: SaveActionInput): Promise<boolean> => {
      const row = await postJson<MigrationAction>('/api/actions', input);
      if (!row) return false;
      setByKey((prev) => new Map(prev).set(row.item_key, row));
      void loadSummary();
      return true;
    },
    [loadSummary],
  );

  return { byKey, summary, available, loading, save };
}

// ============================================================
// Configuration exception reviews (VP sign-off workflow)
// ============================================================
export type ReviewStatus = 'open' | 'acknowledged' | 'resolved' | 'false_positive';

export const REVIEW_STATUS_ORDER: readonly ReviewStatus[] = [
  'open',
  'acknowledged',
  'resolved',
  'false_positive',
];

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  open: 'Open',
  acknowledged: 'Acknowledged',
  resolved: 'Resolved',
  false_positive: 'False positive',
};

export interface ExceptionReview {
  item_key: string;
  customer: string | null;
  project: string | null;
  module: string | null;
  country: string | null;
  status: ReviewStatus;
  reviewer_email: string | null;
  note: string | null;
  updated_at: string;
}

export interface ReviewSummary {
  byStatus: Partial<Record<ReviewStatus, number>>;
  total: number;
  cleared: number;
}

export interface SaveReviewInput {
  itemKey: string;
  customer?: string | null;
  project?: string | null;
  module?: string | null;
  country?: string | null;
  status: ReviewStatus;
  reviewerEmail?: string | null;
  note?: string | null;
}

export function useExceptionReviews() {
  const [byKey, setByKey] = useState<Map<string, ExceptionReview>>(new Map());
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [available, setAvailable] = useState(true);

  const loadSummary = useCallback(async () => {
    const { data } = await getJson<ReviewSummary>('/api/reviews/summary');
    if (data) setSummary(data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { status, data } = await getJson<{ rows: ExceptionReview[] }>('/api/reviews');
      if (cancelled) return;
      if (status === 503 || status === 0) {
        setAvailable(false);
        return;
      }
      const map = new Map<string, ExceptionReview>();
      for (const row of data?.rows ?? []) map.set(row.item_key, row);
      setByKey(map);
      setAvailable(true);
      await loadSummary();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSummary]);

  const save = useCallback(
    async (input: SaveReviewInput): Promise<boolean> => {
      const row = await postJson<ExceptionReview>('/api/reviews', input);
      if (!row) return false;
      setByKey((prev) => new Map(prev).set(row.item_key, row));
      void loadSummary();
      return true;
    },
    [loadSummary],
  );

  return { byKey, summary, available, save };
}

// ============================================================
// Account notes (append-only relationship timeline)
// ============================================================
export interface AccountNote {
  id: string;
  customer: string;
  author_email: string | null;
  body: string;
  created_at: string;
}

export function useAccountNotes(customer: string) {
  const [notes, setNotes] = useState<AccountNote[]>([]);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!customer) {
        setNotes([]);
        return;
      }
      setLoading(true);
      const { status, data } = await getJson<{ rows: AccountNote[] }>(
        `/api/account-notes?customer=${encodeURIComponent(customer)}`,
      );
      if (cancelled) return;
      if (status === 503 || status === 0) setAvailable(false);
      else setNotes(data?.rows ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [customer]);

  const add = useCallback(
    async (body: string): Promise<boolean> => {
      const row = await postJson<AccountNote>('/api/account-notes', { customer, body });
      if (!row) return false;
      setNotes((prev) => [row, ...prev]);
      return true;
    },
    [customer],
  );

  const remove = useCallback(async (id: string): Promise<void> => {
    if (await deleteJson(`/api/account-notes/${id}`)) {
      setNotes((prev) => prev.filter((note) => note.id !== id));
    }
  }, []);

  return { notes, available, loading, add, remove };
}

// ============================================================
// Saved views (per-user filter presets)
// ============================================================
export interface SavedView {
  id: string;
  page: string;
  name: string;
  country: string | null;
  segment: string | null;
  solution: string | null;
  family: string | null;
  created_at: string;
}

export interface SaveViewInput {
  name: string;
  country?: string | null;
  segment?: string | null;
  solution?: string | null;
  family?: string | null;
}

export function useSavedViews(page: string) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { status, data } = await getJson<{ rows: SavedView[] }>(
        `/api/views?page=${encodeURIComponent(page)}`,
      );
      if (cancelled) return;
      if (status === 503 || status === 0) setAvailable(false);
      else setViews(data?.rows ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [page]);

  const save = useCallback(
    async (input: SaveViewInput): Promise<boolean> => {
      const row = await postJson<SavedView>('/api/views', { ...input, page });
      if (!row) return false;
      setViews((prev) => [row, ...prev]);
      return true;
    },
    [page],
  );

  const remove = useCallback(async (id: string): Promise<void> => {
    if (await deleteJson(`/api/views/${id}`)) {
      setViews((prev) => prev.filter((view) => view.id !== id));
    }
  }, []);

  return { views, available, save, remove };
}

// ============================================================
// Saved Genie questions (personal library)
// ============================================================
export interface SavedQuestion {
  id: string;
  question: string;
  generated_sql: string | null;
  created_at: string;
}

export function useSavedQuestions() {
  const [questions, setQuestions] = useState<SavedQuestion[]>([]);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { status, data } = await getJson<{ rows: SavedQuestion[] }>('/api/genie-questions');
      if (cancelled) return;
      if (status === 503 || status === 0) setAvailable(false);
      else setQuestions(data?.rows ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (question: string, generatedSql?: string | null): Promise<boolean> => {
    const row = await postJson<SavedQuestion>('/api/genie-questions', {
      question,
      generatedSql: generatedSql ?? null,
    });
    if (!row) return false;
    setQuestions((prev) => [row, ...prev.filter((q) => q.question !== row.question)]);
    return true;
  }, []);

  const remove = useCallback(async (id: string): Promise<void> => {
    if (await deleteJson(`/api/genie-questions/${id}`)) {
      setQuestions((prev) => prev.filter((q) => q.id !== id));
    }
  }, []);

  return { questions, available, save, remove };
}

// ============================================================
// Activity feed (append-only audit trail)
// ============================================================
export interface ActivityEntry {
  id: string;
  user_email: string | null;
  action: string;
  entity: string | null;
  detail: string | null;
  created_at: string;
}

export function useActivity() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [available, setAvailable] = useState(true);

  const refresh = useCallback(async () => {
    const { status, data } = await getJson<{ rows: ActivityEntry[] }>('/api/activity');
    if (status === 503 || status === 0) setAvailable(false);
    else setEntries(data?.rows ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!cancelled) await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  return { entries, available, refresh };
}
