import { createApp, analytics, genie, lakebase, server } from '@databricks/appkit';
import { setupStateRoutes } from './routes/state-routes';

/**
 * Vanderlande Warehousing Intelligence — AppKit backend.
 *
 * - analytics(): runs the SQL files in config/queries/ against the SQL warehouse.
 *   All warehouse reads go through there, never through a custom endpoint.
 * - genie():     proxies the Genie space (SSE) for the Ask Genie page. Reads the
 *                space ID from DATABRICKS_GENIE_SPACE_ID and registers it under
 *                the 'default' alias, which the frontend passes to useGenieChat.
 * - lakebase():  Postgres pool for the app's own persistent case-management state.
 * - server():    HTTP server; state routes are attached via server.extend().
 */
await createApp({
  plugins: [analytics(), genie(), lakebase(), server()],
  async onPluginsReady(appkit) {
    // Applies the app_ops migrations, then registers the state + identity routes.
    // Runs before the server accepts requests. A Lakebase failure is reported via
    // /api/features rather than crashing the app, so the analytics pages still work.
    await setupStateRoutes(appkit);
  },
});
