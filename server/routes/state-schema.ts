/**
 * Lakebase (Postgres) schema for the app's persistent case-management state.
 *
 * Ownership model: these statements run as the app's service principal inside
 * `onPluginsReady`, i.e. before the server accepts requests. The SP must CREATE
 * the schema in order to OWN it — it cannot use a schema created by anyone else
 * (including `public`). That is why everything lives under a dedicated
 * `app_ops` schema and every table is qualified with it.
 */
export const MIGRATIONS: { name: string; sql: string }[] = [
  {
    name: '001_schema',
    sql: `CREATE SCHEMA IF NOT EXISTS app_ops`,
  },
  {
    name: '002_migration_actions',
    sql: `
      CREATE TABLE IF NOT EXISTS app_ops.migration_actions (
        item_key    TEXT PRIMARY KEY,
        customer    TEXT,
        project     TEXT,
        module      TEXT,
        country     TEXT,
        risk_type   TEXT,
        status      TEXT NOT NULL DEFAULT 'not_started',
        owner_email TEXT,
        due_date    DATE,
        notes       TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
  },
  {
    name: '003_exception_reviews',
    sql: `
      CREATE TABLE IF NOT EXISTS app_ops.exception_reviews (
        item_key       TEXT PRIMARY KEY,
        customer       TEXT,
        project        TEXT,
        module         TEXT,
        country        TEXT,
        status         TEXT NOT NULL DEFAULT 'open',
        reviewer_email TEXT,
        note           TEXT,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
  },
  {
    name: '004_account_notes',
    sql: `
      CREATE TABLE IF NOT EXISTS app_ops.account_notes (
        id           BIGSERIAL PRIMARY KEY,
        customer     TEXT NOT NULL,
        author_email TEXT,
        body         TEXT NOT NULL,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
  },
  {
    name: '005_account_notes_index',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_account_notes_customer
        ON app_ops.account_notes (customer, created_at DESC)`,
  },
  {
    name: '006_saved_views',
    sql: `
      CREATE TABLE IF NOT EXISTS app_ops.saved_views (
        id         BIGSERIAL PRIMARY KEY,
        user_email TEXT NOT NULL,
        page       TEXT NOT NULL,
        name       TEXT NOT NULL,
        country    TEXT,
        segment    TEXT,
        solution   TEXT,
        family     TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
  },
  {
    name: '007_saved_questions',
    sql: `
      CREATE TABLE IF NOT EXISTS app_ops.saved_questions (
        id            BIGSERIAL PRIMARY KEY,
        user_email    TEXT NOT NULL,
        question      TEXT NOT NULL,
        generated_sql TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
  },
  {
    name: '008_activity_log',
    sql: `
      CREATE TABLE IF NOT EXISTS app_ops.activity_log (
        id         BIGSERIAL PRIMARY KEY,
        user_email TEXT,
        action     TEXT NOT NULL,
        entity     TEXT,
        detail     TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
  },
  {
    name: '009_activity_log_index',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_activity_log_created_at
        ON app_ops.activity_log (created_at DESC)`,
  },
];
