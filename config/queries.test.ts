import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Static guards on the warehouse SQL. Every file here was also executed against
 * the real warehouse during development; these tests stop the common regressions
 * that a typecheck cannot catch — wrong catalog, PostgreSQL dialect leaking into
 * Databricks SQL, or mock data creeping back in.
 */
const QUERY_DIR = join(import.meta.dirname, 'queries');
const CATALOG = 'serverless_stable_cps4hg_catalog';
const SCHEMA = 'ddi_hackathon';

const files = readdirSync(QUERY_DIR).filter((f) => f.endsWith('.sql'));
const read = (file: string) => readFileSync(join(QUERY_DIR, file), 'utf8');

/**
 * The executable SQL with `--` comment lines removed. Dialect assertions must run
 * against this, not the raw file: the comments legitimately *discuss* forbidden
 * constructs (e.g. "SELECT * is not supported on metric views").
 */
const readSql = (file: string) =>
  read(file)
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

describe('config/queries SQL files', () => {
  it('ships a query set for all five pages', () => {
    expect(files.length).toBeGreaterThanOrEqual(20);
  });

  it('targets this workspace’s catalog and schema only', () => {
    for (const file of files) {
      const sql = read(file);
      expect(sql, `${file} must query ${CATALOG}.${SCHEMA}`).toContain(`${CATALOG}.${SCHEMA}.`);
      // The upstream spec files reference a different workspace's catalog.
      expect(sql, `${file} must not reference dbdemos_matteo`).not.toContain('dbdemos_matteo');
    }
  });

  it('contains no mocked or placeholder data', () => {
    for (const file of files) {
      expect(file).not.toMatch(/hello_world|mocked_/);
      expect(read(file).toLowerCase()).not.toContain('mocked_sales');
    }
  });

  it('uses Databricks SQL, not PostgreSQL dialect', () => {
    for (const file of files) {
      const sql = readSql(file);
      // ILIKE is not supported; use LOWER(col) LIKE LOWER(pattern).
      expect(sql, `${file} must not use ILIKE`).not.toMatch(/\bILIKE\b/i);
      // NOW() is Postgres; Databricks SQL uses CURRENT_TIMESTAMP().
      expect(sql, `${file} must not use NOW()`).not.toMatch(/\bNOW\(\)/i);
      expect(sql, `${file} must not use GENERATE_SERIES`).not.toMatch(/GENERATE_SERIES/i);
      // DATEDIFF in Databricks SQL takes 3 args: DATEDIFF(unit, start, end).
      const datediff = sql.match(/DATEDIFF\s*\(([^)]*)\)/i);
      if (datediff) {
        expect(datediff[1].split(',').length, `${file} DATEDIFF needs 3 args`).toBe(3);
      }
    }
  });

  it('declares a typed @param annotation for every bind parameter it uses', () => {
    for (const file of files) {
      const sql = read(file);
      const declared = new Set(
        [...sql.matchAll(/--\s*@param\s+(\w+)\s+(\w+)/g)].map((match) => match[1]),
      );
      // Strip the annotation comments before scanning for :param usages.
      const body = sql
        .split('\n')
        .filter((line) => !line.trim().startsWith('-- @param'))
        .join('\n');
      const used = new Set([...body.matchAll(/(?<![:\w]):([a-z_][a-z0-9_]*)/gi)].map((m) => m[1]));
      for (const param of used) {
        expect(declared.has(param), `${file} uses :${param} without an @param annotation`).toBe(true);
      }
    }
  });

  it('wraps every metric-view measure in MEASURE() and never selects star', () => {
    for (const file of files.filter((f) => f.includes('metricview'))) {
      const sql = readSql(file);
      expect(sql).toContain('vanderlande_warehousing_metrics');
      expect(sql).toMatch(/MEASURE\(`/);
      // SELECT * is not supported against a metric view.
      expect(sql).not.toMatch(/SELECT\s+\*/i);
    }
  });

  it('guards every division against divide-by-zero', () => {
    for (const file of files) {
      const sql = readSql(file);
      if (/100\.0\s*\*/.test(sql)) {
        expect(sql, `${file} must NULLIF its denominator`).toContain('NULLIF');
      }
    }
  });
});
