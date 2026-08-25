/**
 * Persistent case-management state for the Warehousing app, backed by Lakebase.
 *
 * Everything here is a MUTATION or a Lakebase read — warehouse SELECTs belong in
 * `config/queries/*.sql`, never in a custom endpoint.
 */
import { z } from 'zod';
import type { Application, Request, Response } from 'express';
import { MIGRATIONS } from './state-schema';

interface LakebaseResult {
  rows: Record<string, unknown>[];
}

/** The slice of the AppKit handle these routes need. */
export interface StateAppKit {
  lakebase: {
    query(text: string, params?: unknown[]): Promise<LakebaseResult>;
  };
  server: {
    extend(fn: (app: Application) => void): void;
  };
}

const ACTION_STATUSES = ['not_started', 'contacted', 'in_progress', 'migrated', 'dismissed'] as const;
const REVIEW_STATUSES = ['open', 'acknowledged', 'resolved', 'false_positive'] as const;

const actionSchema = z.object({
  itemKey: z.string().min(1).max(512),
  customer: z.string().max(256).nullish(),
  project: z.string().max(256).nullish(),
  module: z.string().max(256).nullish(),
  country: z.string().max(128).nullish(),
  riskType: z.string().max(64).nullish(),
  status: z.enum(ACTION_STATUSES),
  ownerEmail: z.string().max(256).nullish(),
  dueDate: z.string().max(32).nullish(), // YYYY-MM-DD
  notes: z.string().max(2000).nullish(),
});

const reviewSchema = z.object({
  itemKey: z.string().min(1).max(512),
  customer: z.string().max(256).nullish(),
  project: z.string().max(256).nullish(),
  module: z.string().max(256).nullish(),
  country: z.string().max(128).nullish(),
  status: z.enum(REVIEW_STATUSES),
  reviewerEmail: z.string().max(256).nullish(),
  note: z.string().max(2000).nullish(),
});

const noteSchema = z.object({
  customer: z.string().min(1).max(256),
  body: z.string().min(1).max(2000),
});

const savedViewSchema = z.object({
  name: z.string().min(1).max(120),
  page: z.string().min(1).max(40),
  country: z.string().max(128).nullish(),
  segment: z.string().max(128).nullish(),
  solution: z.string().max(64).nullish(),
  family: z.string().max(128).nullish(),
});

const savedQuestionSchema = z.object({
  question: z.string().min(1).max(1000),
  generatedSql: z.string().max(20000).nullish(),
});

/**
 * Caller identity. On the Databricks Apps platform the reverse proxy injects
 * these headers; locally they are absent, so we fall back to a dev principal.
 */
function currentUser(req: Request): string {
  return req.header('x-forwarded-email') ?? req.header('x-forwarded-user') ?? 'local-dev@vanderlande.invalid';
}

/**
 * Express 5 types a route param as `string | string[]`. Narrow it to a single
 * positive integer id, returning null for anything else (repeated param, junk).
 */
function parseRouteId(raw: string | string[] | undefined): number | null {
  if (typeof raw !== 'string') return null;
  const id = Number.parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** ISO-8601 UTC rendering, so the client can always `new Date()` it. */
const TS = `'YYYY-MM-DD"T"HH24:MI:SS"Z"'`;

export interface StateSetupResult {
  ready: boolean;
  error: string | null;
}

/**
 * Runs the schema migrations, then registers the state routes.
 *
 * Migrations run BEFORE any request is served (inside `onPluginsReady`). If they
 * fail — most commonly because the schema is owned by another role — the routes
 * are still registered but report 503, so the analytics pages keep working and
 * the UI can degrade gracefully instead of the whole app failing to boot.
 */
export async function setupStateRoutes(appkit: StateAppKit): Promise<StateSetupResult> {
  const result: StateSetupResult = { ready: false, error: null };

  try {
    for (const migration of MIGRATIONS) {
      await appkit.lakebase.query(migration.sql);
    }
    // Prove the connection round-trips and the schema is actually usable.
    await appkit.lakebase.query('SELECT 1 FROM app_ops.migration_actions LIMIT 1');
    result.ready = true;
    console.log(`[lakebase] app_ops schema ready (${MIGRATIONS.length} migrations applied)`);
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    console.error('[lakebase] schema init failed:', result.error);
  }

  /** Append to the audit trail. Never throws — logging must not fail a mutation. */
  async function logActivity(userEmail: string, action: string, entity: string, detail: string): Promise<void> {
    if (!result.ready) return;
    try {
      await appkit.lakebase.query(
        `INSERT INTO app_ops.activity_log (user_email, action, entity, detail) VALUES ($1, $2, $3, $4)`,
        [userEmail, action, entity, detail],
      );
    } catch (err) {
      console.error('[activity] log failed:', err);
    }
  }

  appkit.server.extend((app) => {
    /** Signed-in identity, for the Genie page's trust surface. */
    app.get('/api/whoami', (req: Request, res: Response) => {
      res.json({
        email: req.header('x-forwarded-email') ?? null,
        user: req.header('x-forwarded-user') ?? null,
      });
    });

    /** Whether persistent state is live, so the UI can hide/disable write features. */
    app.get('/api/features', (_req: Request, res: Response) => {
      res.json({ lakebase: result.ready, lakebaseError: result.error });
    });

    /** Guard: every state route needs a working Lakebase schema. */
    const requireReady = (res: Response): boolean => {
      if (!result.ready) {
        res.status(503).json({ error: 'Persistent storage is not available for this app.' });
        return false;
      }
      return true;
    };

    // ---------- Migration action tracker (shared team worklist) ----------
    app.get('/api/actions', async (_req: Request, res: Response) => {
      if (!requireReady(res)) return;
      try {
        const { rows } = await appkit.lakebase.query(
          `SELECT item_key, customer, project, module, country, risk_type, status, owner_email,
                  to_char(due_date, 'YYYY-MM-DD') AS due_date, notes,
                  to_char(updated_at, ${TS}) AS updated_at
           FROM app_ops.migration_actions ORDER BY updated_at DESC LIMIT 500`,
        );
        res.json({ rows });
      } catch (err) {
        console.error('[actions] list failed:', err);
        res.status(500).json({ error: 'Failed to load migration actions' });
      }
    });

    app.get('/api/actions/summary', async (_req: Request, res: Response) => {
      if (!requireReady(res)) return;
      try {
        const { rows } = await appkit.lakebase.query(
          `SELECT status, COUNT(*)::int AS count FROM app_ops.migration_actions GROUP BY status`,
        );
        const byStatus: Record<string, number> = {};
        let total = 0;
        for (const row of rows) {
          const status = String(row.status);
          const count = Number(row.count);
          byStatus[status] = count;
          total += count;
        }
        res.json({ byStatus, total, addressed: total - (byStatus.not_started ?? 0) });
      } catch (err) {
        console.error('[actions] summary failed:', err);
        res.status(500).json({ error: 'Failed to load action summary' });
      }
    });

    app.post('/api/actions', async (req: Request, res: Response) => {
      if (!requireReady(res)) return;
      const parsed = actionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid migration action payload' });
        return;
      }
      const action = parsed.data;
      try {
        const { rows } = await appkit.lakebase.query(
          `INSERT INTO app_ops.migration_actions
             (item_key, customer, project, module, country, risk_type, status, owner_email, due_date, notes, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULLIF($9, '')::date, $10, NOW())
           ON CONFLICT (item_key) DO UPDATE SET
             status      = EXCLUDED.status,
             owner_email = EXCLUDED.owner_email,
             due_date    = EXCLUDED.due_date,
             notes       = EXCLUDED.notes,
             risk_type   = COALESCE(EXCLUDED.risk_type, app_ops.migration_actions.risk_type),
             customer    = COALESCE(EXCLUDED.customer, app_ops.migration_actions.customer),
             project     = COALESCE(EXCLUDED.project, app_ops.migration_actions.project),
             module      = COALESCE(EXCLUDED.module, app_ops.migration_actions.module),
             country     = COALESCE(EXCLUDED.country, app_ops.migration_actions.country),
             updated_at  = NOW()
           RETURNING item_key, customer, project, module, country, risk_type, status, owner_email,
                     to_char(due_date, 'YYYY-MM-DD') AS due_date, notes,
                     to_char(updated_at, ${TS}) AS updated_at`,
          [
            action.itemKey,
            action.customer ?? null,
            action.project ?? null,
            action.module ?? null,
            action.country ?? null,
            action.riskType ?? null,
            action.status,
            action.ownerEmail ?? null,
            action.dueDate ?? '',
            action.notes ?? null,
          ],
        );
        await logActivity(
          currentUser(req),
          'action.save',
          action.customer ?? action.module ?? action.itemKey,
          `set migration status to "${action.status}"${action.module ? ` on ${action.module}` : ''}`,
        );
        res.json(rows[0]);
      } catch (err) {
        console.error('[actions] upsert failed:', err);
        res.status(500).json({ error: 'Failed to save migration action' });
      }
    });

    // ---------- Configuration exception review (VP sign-off workflow) ----------
    app.get('/api/reviews', async (_req: Request, res: Response) => {
      if (!requireReady(res)) return;
      try {
        const { rows } = await appkit.lakebase.query(
          `SELECT item_key, customer, project, module, country, status, reviewer_email, note,
                  to_char(updated_at, ${TS}) AS updated_at
           FROM app_ops.exception_reviews ORDER BY updated_at DESC LIMIT 500`,
        );
        res.json({ rows });
      } catch (err) {
        console.error('[reviews] list failed:', err);
        res.status(500).json({ error: 'Failed to load exception reviews' });
      }
    });

    app.get('/api/reviews/summary', async (_req: Request, res: Response) => {
      if (!requireReady(res)) return;
      try {
        const { rows } = await appkit.lakebase.query(
          `SELECT status, COUNT(*)::int AS count FROM app_ops.exception_reviews GROUP BY status`,
        );
        const byStatus: Record<string, number> = {};
        let total = 0;
        for (const row of rows) {
          const status = String(row.status);
          const count = Number(row.count);
          byStatus[status] = count;
          total += count;
        }
        const cleared = (byStatus.resolved ?? 0) + (byStatus.false_positive ?? 0);
        res.json({ byStatus, total, cleared });
      } catch (err) {
        console.error('[reviews] summary failed:', err);
        res.status(500).json({ error: 'Failed to load review summary' });
      }
    });

    app.post('/api/reviews', async (req: Request, res: Response) => {
      if (!requireReady(res)) return;
      const parsed = reviewSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid review payload' });
        return;
      }
      const review = parsed.data;
      try {
        const { rows } = await appkit.lakebase.query(
          `INSERT INTO app_ops.exception_reviews
             (item_key, customer, project, module, country, status, reviewer_email, note, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
           ON CONFLICT (item_key) DO UPDATE SET
             status         = EXCLUDED.status,
             reviewer_email = EXCLUDED.reviewer_email,
             note           = EXCLUDED.note,
             customer       = COALESCE(EXCLUDED.customer, app_ops.exception_reviews.customer),
             project        = COALESCE(EXCLUDED.project, app_ops.exception_reviews.project),
             module         = COALESCE(EXCLUDED.module, app_ops.exception_reviews.module),
             country        = COALESCE(EXCLUDED.country, app_ops.exception_reviews.country),
             updated_at     = NOW()
           RETURNING item_key, customer, project, module, country, status, reviewer_email, note,
                     to_char(updated_at, ${TS}) AS updated_at`,
          [
            review.itemKey,
            review.customer ?? null,
            review.project ?? null,
            review.module ?? null,
            review.country ?? null,
            review.status,
            review.reviewerEmail ?? null,
            review.note ?? null,
          ],
        );
        await logActivity(
          currentUser(req),
          'exception.review',
          review.customer ?? review.module ?? review.itemKey,
          `marked exception "${review.status}"${review.module ? ` on ${review.module}` : ''}`,
        );
        res.json(rows[0]);
      } catch (err) {
        console.error('[reviews] upsert failed:', err);
        res.status(500).json({ error: 'Failed to save review' });
      }
    });

    // ---------- Account notes (append-only relationship timeline) ----------
    app.get('/api/account-notes', async (req: Request, res: Response) => {
      if (!requireReady(res)) return;
      const customer = typeof req.query.customer === 'string' ? req.query.customer : '';
      if (!customer) {
        res.status(400).json({ error: 'customer query parameter is required' });
        return;
      }
      try {
        const { rows } = await appkit.lakebase.query(
          `SELECT id, customer, author_email, body, to_char(created_at, ${TS}) AS created_at
           FROM app_ops.account_notes WHERE customer = $1 ORDER BY created_at DESC LIMIT 200`,
          [customer],
        );
        res.json({ rows });
      } catch (err) {
        console.error('[notes] list failed:', err);
        res.status(500).json({ error: 'Failed to load account notes' });
      }
    });

    app.post('/api/account-notes', async (req: Request, res: Response) => {
      if (!requireReady(res)) return;
      const parsed = noteSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid note payload' });
        return;
      }
      try {
        const { rows } = await appkit.lakebase.query(
          `INSERT INTO app_ops.account_notes (customer, author_email, body) VALUES ($1, $2, $3)
           RETURNING id, customer, author_email, body, to_char(created_at, ${TS}) AS created_at`,
          [parsed.data.customer, currentUser(req), parsed.data.body],
        );
        await logActivity(currentUser(req), 'note.add', parsed.data.customer, 'added an account note');
        res.status(201).json(rows[0]);
      } catch (err) {
        console.error('[notes] add failed:', err);
        res.status(500).json({ error: 'Failed to add account note' });
      }
    });

    app.delete('/api/account-notes/:id', async (req: Request, res: Response) => {
      if (!requireReady(res)) return;
      const id = parseRouteId(req.params.id);
      if (id === null) {
        res.status(400).json({ error: 'Invalid id' });
        return;
      }
      try {
        // Authors may only delete their own notes.
        const { rows } = await appkit.lakebase.query(
          `DELETE FROM app_ops.account_notes WHERE id = $1 AND author_email = $2 RETURNING id`,
          [id, currentUser(req)],
        );
        if (rows.length === 0) {
          res.status(404).json({ error: 'Note not found, or not yours to delete' });
          return;
        }
        res.status(204).send();
      } catch (err) {
        console.error('[notes] delete failed:', err);
        res.status(500).json({ error: 'Failed to delete note' });
      }
    });

    // ---------- Saved views (per-user filter presets) ----------
    app.get('/api/views', async (req: Request, res: Response) => {
      if (!requireReady(res)) return;
      const page = typeof req.query.page === 'string' ? req.query.page : '';
      try {
        const { rows } = await appkit.lakebase.query(
          `SELECT id, page, name, country, segment, solution, family,
                  to_char(created_at, ${TS}) AS created_at
           FROM app_ops.saved_views
           WHERE user_email = $1 AND ($2 = '' OR page = $2)
           ORDER BY created_at DESC LIMIT 100`,
          [currentUser(req), page],
        );
        res.json({ rows });
      } catch (err) {
        console.error('[views] list failed:', err);
        res.status(500).json({ error: 'Failed to load saved views' });
      }
    });

    app.post('/api/views', async (req: Request, res: Response) => {
      if (!requireReady(res)) return;
      const parsed = savedViewSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid saved view payload' });
        return;
      }
      const view = parsed.data;
      try {
        const { rows } = await appkit.lakebase.query(
          `INSERT INTO app_ops.saved_views (user_email, page, name, country, segment, solution, family)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, page, name, country, segment, solution, family,
                     to_char(created_at, ${TS}) AS created_at`,
          [
            currentUser(req),
            view.page,
            view.name,
            view.country ?? null,
            view.segment ?? null,
            view.solution ?? null,
            view.family ?? null,
          ],
        );
        await logActivity(currentUser(req), 'view.save', view.page, `saved view "${view.name}"`);
        res.status(201).json(rows[0]);
      } catch (err) {
        console.error('[views] add failed:', err);
        res.status(500).json({ error: 'Failed to save view' });
      }
    });

    app.delete('/api/views/:id', async (req: Request, res: Response) => {
      if (!requireReady(res)) return;
      const id = parseRouteId(req.params.id);
      if (id === null) {
        res.status(400).json({ error: 'Invalid id' });
        return;
      }
      try {
        const { rows } = await appkit.lakebase.query(
          `DELETE FROM app_ops.saved_views WHERE id = $1 AND user_email = $2 RETURNING id`,
          [id, currentUser(req)],
        );
        if (rows.length === 0) {
          res.status(404).json({ error: 'Saved view not found' });
          return;
        }
        res.status(204).send();
      } catch (err) {
        console.error('[views] delete failed:', err);
        res.status(500).json({ error: 'Failed to delete saved view' });
      }
    });

    // ---------- Saved Genie questions (personal library) ----------
    app.get('/api/genie-questions', async (req: Request, res: Response) => {
      if (!requireReady(res)) return;
      try {
        const { rows } = await appkit.lakebase.query(
          `SELECT id, question, generated_sql, to_char(created_at, ${TS}) AS created_at
           FROM app_ops.saved_questions WHERE user_email = $1 ORDER BY created_at DESC LIMIT 100`,
          [currentUser(req)],
        );
        res.json({ rows });
      } catch (err) {
        console.error('[questions] list failed:', err);
        res.status(500).json({ error: 'Failed to load saved questions' });
      }
    });

    app.post('/api/genie-questions', async (req: Request, res: Response) => {
      if (!requireReady(res)) return;
      const parsed = savedQuestionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid saved question payload' });
        return;
      }
      try {
        const { rows } = await appkit.lakebase.query(
          `INSERT INTO app_ops.saved_questions (user_email, question, generated_sql) VALUES ($1, $2, $3)
           RETURNING id, question, generated_sql, to_char(created_at, ${TS}) AS created_at`,
          [currentUser(req), parsed.data.question, parsed.data.generatedSql ?? null],
        );
        await logActivity(currentUser(req), 'question.save', 'Genie', `saved question "${parsed.data.question}"`);
        res.status(201).json(rows[0]);
      } catch (err) {
        console.error('[questions] add failed:', err);
        res.status(500).json({ error: 'Failed to save question' });
      }
    });

    app.delete('/api/genie-questions/:id', async (req: Request, res: Response) => {
      if (!requireReady(res)) return;
      const id = parseRouteId(req.params.id);
      if (id === null) {
        res.status(400).json({ error: 'Invalid id' });
        return;
      }
      try {
        const { rows } = await appkit.lakebase.query(
          `DELETE FROM app_ops.saved_questions WHERE id = $1 AND user_email = $2 RETURNING id`,
          [id, currentUser(req)],
        );
        if (rows.length === 0) {
          res.status(404).json({ error: 'Saved question not found' });
          return;
        }
        res.status(204).send();
      } catch (err) {
        console.error('[questions] delete failed:', err);
        res.status(500).json({ error: 'Failed to delete question' });
      }
    });

    // ---------- Activity feed (append-only audit trail) ----------
    app.get('/api/activity', async (_req: Request, res: Response) => {
      if (!requireReady(res)) return;
      try {
        const { rows } = await appkit.lakebase.query(
          `SELECT id, user_email, action, entity, detail, to_char(created_at, ${TS}) AS created_at
           FROM app_ops.activity_log ORDER BY created_at DESC LIMIT 40`,
        );
        res.json({ rows });
      } catch (err) {
        console.error('[activity] list failed:', err);
        res.status(500).json({ error: 'Failed to load activity' });
      }
    });
  });

  return result;
}
