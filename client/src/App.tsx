import { createBrowserRouter, RouterProvider, NavLink, Outlet } from 'react-router';
import { lazy, Suspense } from 'react';
import { useTheme } from 'next-themes';
import {
  Button,
  Separator,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  Skeleton,
  TooltipProvider,
} from '@databricks/appkit-ui/react';
import { AlertTriangle, Globe2, Moon, ShieldCheck, Sparkles, Sun, Users } from 'lucide-react';

// Route-level code splitting keeps the initial bundle small; each page is its own chunk.
const RiskMonitorPage = lazy(() =>
  import('./pages/RiskMonitorPage').then((m) => ({ default: m.RiskMonitorPage })),
);
const CompliancePage = lazy(() =>
  import('./pages/CompliancePage').then((m) => ({ default: m.CompliancePage })),
);
const AccountsPage = lazy(() => import('./pages/AccountsPage').then((m) => ({ default: m.AccountsPage })));
const GeographyPage = lazy(() =>
  import('./pages/GeographyPage').then((m) => ({ default: m.GeographyPage })),
);
const GeniePage = lazy(() => import('./pages/GeniePage').then((m) => ({ default: m.GeniePage })));

const NAV = [
  { to: '/', label: 'Risk Monitor', icon: AlertTriangle, end: true },
  { to: '/compliance', label: 'Compliance', icon: ShieldCheck, end: false },
  { to: '/accounts', label: 'Accounts', icon: Users, end: false },
  { to: '/geography', label: 'Geography', icon: Globe2, end: false },
  { to: '/ask', label: 'Ask Genie', icon: Sparkles, end: false },
] as const;

/** Skeleton shown while a lazily-loaded page chunk is fetched. */
function PageFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-72" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {['a', 'b', 'c', 'd'].map((key) => (
          <Skeleton key={key} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

/**
 * Vanderlande wordmark: the name in the foreground token with the brand rule
 * beneath it. Uses tokens so it inverts correctly in dark mode.
 */
function Wordmark() {
  return (
    <svg viewBox="0 0 210 30" className="h-5 w-auto" role="img" aria-label="Vanderlande">
      <text
        x="0"
        y="20"
        textLength="210"
        lengthAdjust="spacingAndGlyphs"
        fontFamily="'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
        fontSize="24"
        fontWeight="700"
        letterSpacing="-0.5"
        fill="var(--foreground)"
      >
        vanderlande
      </text>
      <rect x="0" y="26" width="210" height="3" fill="var(--primary)" />
    </svg>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}

function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex flex-col gap-1 px-2 py-1.5">
          <Wordmark />
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Warehousing Intelligence
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Portfolio</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map(({ to, label, icon: Icon, end }) => (
                <SidebarMenuItem key={to}>
                  <NavLink to={to} end={end}>
                    {({ isActive }) => (
                      <SidebarMenuButton isActive={isActive} tooltip={label}>
                        <Icon />
                        <span>{label}</span>
                      </SidebarMenuButton>
                    )}
                  </NavLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/*
        Required disclaimer. The wording is fixed by spec and must read exactly
        "Synthetic data only." on every page.
      */}
      <SidebarFooter>
        <Separator />
        <p className="px-2 py-1.5 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          Synthetic data only.
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function Layout() {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <span className="text-sm font-medium text-muted-foreground">
              Vanderlande Warehousing Intelligence
            </span>
            <div className="ml-auto">
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6">
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <RiskMonitorPage /> },
      { path: '/compliance', element: <CompliancePage /> },
      { path: '/accounts', element: <AccountsPage /> },
      { path: '/geography', element: <GeographyPage /> },
      { path: '/ask', element: <GeniePage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
