import {
  ResourceStatusIndicator,
  ResourceStatusProvider,
} from '@databricks/appkit-ui/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from 'next-themes';
import './index.css';
import App from './App.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/*
     * Class-based theming. Default to light so the app never inherits the
     * OS dark preference (which the design system would otherwise auto-apply
     * and render the app dark). The header toggle switches light/dark.
     */}
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <ErrorBoundary>
        {/*
         * Surfaces resource readiness (e.g. SQL warehouse cold-starts) as a
         * single sonner toast across the whole tree. Both are no-ops when
         * nothing's pending; remove them to render the aggregate yourself
         * via useResourceStatus(). Apps that already mount their own
         * <Toaster /> can swap the indicator for useResourceStatusToaster().
         */}
        <ResourceStatusProvider>
          <ResourceStatusIndicator />
          <App />
        </ResourceStatusProvider>
      </ErrorBoundary>
    </ThemeProvider>
  </StrictMode>
);
