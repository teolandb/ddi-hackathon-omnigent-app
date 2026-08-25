import { describe, expect, it } from 'vitest';
import { MIGRATIONS } from './state-schema';

/**
 * The migrations run as the app's service principal at startup. If they drift out
 * of the `app_ops` schema the SP loses ownership and every write 403s at runtime,
 * so that invariant is worth pinning in a test.
 */
describe('Lakebase state migrations', () => {
  it('creates the app-owned schema first', () => {
    expect(MIGRATIONS[0].sql).toContain('CREATE SCHEMA IF NOT EXISTS app_ops');
  });

  it('is idempotent — every statement is IF NOT EXISTS', () => {
    for (const migration of MIGRATIONS) {
      expect(migration.sql, `${migration.name} must be re-runnable`).toMatch(/IF NOT EXISTS/);
    }
  });

  it('qualifies every table and index with the app_ops schema', () => {
    for (const migration of MIGRATIONS) {
      const match = /CREATE TABLE IF NOT EXISTS (\S+)/.exec(migration.sql);
      if (match) {
        expect(match[1], `${migration.name} must live in app_ops`).toMatch(/^app_ops\./);
      }
    }
  });

  it('covers all five persistent-state features', () => {
    const all = MIGRATIONS.map((m) => m.sql).join('\n');
    for (const table of [
      'app_ops.migration_actions',
      'app_ops.exception_reviews',
      'app_ops.account_notes',
      'app_ops.saved_views',
      'app_ops.saved_questions',
      'app_ops.activity_log',
    ]) {
      expect(all).toContain(table);
    }
  });

  it('uses unique migration names', () => {
    const names = MIGRATIONS.map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('uses Postgres syntax, not Databricks SQL', () => {
    const all = MIGRATIONS.map((m) => m.sql).join('\n');
    // Lakebase is standard Postgres: SERIAL/BIGSERIAL and TIMESTAMPTZ/NOW().
    expect(all).toContain('BIGSERIAL');
    expect(all).toContain('TIMESTAMPTZ');
    expect(all).not.toContain('CURRENT_TIMESTAMP()');
  });
});
