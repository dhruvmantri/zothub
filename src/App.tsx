import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from "react-router-dom";

import { useScrollRestoration } from "@/hooks/useScrollRestoration";
import { NavigationCountsSync } from "@/hooks/useNavigationCounts";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import { PageLoader } from "@/components/ui/page-loader";

// Landing is the marketing entry and the LCP page, so it stays in the initial
// bundle. Every other route is lazy — each becomes its own chunk fetched on
// navigation. This is what finally lifts recharts (used only by ClubAnalytics,
// reached deep inside the club dashboard) out of the first download.
import Landing from "./pages/Landing";

const Opportunities = lazy(() => import("./pages/Opportunities"));
const OpportunityDetail = lazy(() => import("./pages/OpportunityDetail"));
const Events = lazy(() => import("./pages/Events"));
const EventDetail = lazy(() => import("./pages/EventDetail"));
const Clubs = lazy(() => import("./pages/Clubs"));
const AccountSetup = lazy(() => import("./pages/AccountSetup"));
const ClubDetail = lazy(() => import("./pages/ClubDetail"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const CreateOpportunity = lazy(() => import("./pages/CreateOpportunity"));
const CreateEvent = lazy(() => import("./pages/CreateEvent"));
const EditOpportunity = lazy(() => import("./pages/EditOpportunity"));
const EditEvent = lazy(() => import("./pages/EditEvent"));
const StudentDashboard = lazy(() => import("./pages/StudentDashboard"));
const StudentProfile = lazy(() => import("./pages/StudentProfile"));
const StudentProfileEdit = lazy(() => import("./pages/StudentProfileEdit"));
const ClubProfileSetup = lazy(() => import("./pages/ClubProfileSetup"));
const Messages = lazy(() => import("./pages/Messages"));
const Notifications = lazy(() => import("./pages/Notifications"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ClubHome = lazy(() => import("./pages/club/ClubHome"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Help = lazy(() => import("./pages/Help"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const Waitlist = lazy(() => import("./pages/Waitlist"));
const WaitlistRejected = lazy(() => import("./pages/WaitlistRejected"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
// DEV-only: fixture harness for the club-seeding (MB5) UI. The dynamic import sits
// inside an `import.meta.env.DEV` branch so Rollup dead-code-eliminates it (and its
// chunk) from the production build entirely — it exists only during `vite dev`.
const ClubsPreview = import.meta.env.DEV
  ? lazy(() => import("./pages/dev/ClubsPreview"))
  : null;

// Step zero of adopting TanStack Query (UX15). A bare `new QueryClient()` inherits
// v5's `staleTime: 0`, which means every mount refetches immediately — so adopting
// the library WITHOUT this changes nothing a user can feel, and the "page never
// changed" complaint (UX1) survives the whole migration.
//
// 60s is chosen against how this data actually behaves: club listings, events and
// opportunities are edited by humans a few times a day, so a minute-old list is
// never meaningfully wrong, while a minute is far longer than a browse session's
// back-and-forth — which is exactly the navigation that felt slow.
//
// gcTime 5m keeps an unmounted page's data around long enough that going
// Clubs -> a club -> back is instant rather than a refetch.
//
// refetchOnWindowFocus is off: a student alt-tabbing back should not see every
// list flash. retry 1 because a second attempt fixes a blip without making a
// genuine failure take four round-trips to surface.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/**
 * Scroll behaviour on navigation (UX14). Must render inside <BrowserRouter> to
 * have router context, which is why it is a component rather than a call in App.
 */
const ScrollBehaviour = () => {
  useScrollRestoration();
  return null;
};

/** Full-screen fallback shown while a route chunk loads. */
const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-surface-2">
    <PageLoader />
  </div>
);

/**
 * Old address -> new one (UX8, 2026-09-21). The rename dropped `/student/` and
 * `/club/` from every signed-in path: nobody needs the word in their own
 * address bar, and one `/messages` now serves both inboxes.
 *
 * `:id` does NOT carry through on its own. `<Navigate to="/postings/:id/edit">`
 * navigates to the LITERAL string ":id" — verified, it is what this code did
 * before `LegacyRedirect` existed, so a club following an old edit link landed
 * on a page for a posting called ":id". The component below substitutes the
 * params, and carries the query string and hash across too, which a plain
 * Navigate also drops.
 */
const LEGACY_ROUTES: { from: string; to: string }[] = [
  { from: "/club/dashboard/opportunities", to: "/postings" },
  { from: "/club/dashboard/events", to: "/postings/events" },
  { from: "/club/dashboard/applications", to: "/applicants" },
  { from: "/club/dashboard/rsvps", to: "/applicants/events" },
  { from: "/club/dashboard/overview", to: "/my-club" },
  { from: "/club/dashboard/team", to: "/my-club/team" },
  { from: "/club/dashboard/analytics", to: "/my-club/analytics" },
  { from: "/club/dashboard", to: "/applicants" },
  { from: "/club/opportunities/new", to: "/postings/new" },
  { from: "/club/opportunities/:id/edit", to: "/postings/:id/edit" },
  { from: "/club/events/new", to: "/postings/events/new" },
  { from: "/club/events/:id/edit", to: "/postings/events/:id/edit" },
  { from: "/club/profile", to: "/my-club/edit" },
  { from: "/club/messages", to: "/messages" },
  { from: "/student/dashboard", to: "/activity" },
  { from: "/student/profile/edit", to: "/profile/edit" },
  { from: "/student/profile", to: "/profile" },
  { from: "/student/messages", to: "/messages" },
];

/**
 * Sends an old address to its new one, keeping everything that identifies WHAT
 * the person was looking at: the route params, the query string and the hash.
 */
function LegacyRedirect({ to }: { to: string }) {
  const params = useParams();
  const { search, hash } = useLocation();
  const target = to.replace(/:([A-Za-z0-9_]+)/g, (whole, name: string) => params[name] ?? whole);
  return <Navigate to={`${target}${search}${hash}`} replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    {/* Both themes are genuinely designed (Foundation) and AA-verified, so the
        device preference is honoured: `defaultTheme="system"` resolves to the
        visitor's OS setting, falling back to light when they have expressed none.
        `enableSystem` alone was not enough — next-themes only consults the OS when
        defaultTheme is "system", so the previous `defaultTheme="light"` overrode it
        and served light to dark-mode devices (maintainer decision, 2026-08-23).
        The manual ThemeToggle still wins over both. `data-theme` is the attribute
        the token layer and the design mocks both key off. */}
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ScrollBehaviour />
          <AuthProvider>
            {/* Mounted ONCE, outside <Routes>, so the nav-count websocket
                channels survive navigation. They previously lived inside the
                per-page layouts and were torn down and rebuilt on every route
                change. Renders nothing. */}
            <NavigationCountsSync />
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/opportunities" element={<Opportunities />} />
            <Route path="/opportunities/:id" element={<OpportunityDetail />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/:id" element={<EventDetail />} />
            <Route path="/clubs" element={<Clubs />} />
            {/* A5: where a signed-in account with no role lands. Public on
                purpose — guarding it with ProtectedRoute would bounce exactly
                the people it exists for, straight back into a loop. */}
            <Route path="/account-setup" element={<AccountSetup />} />
            <Route path="/clubs/:id" element={<ClubDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/help" element={<Help />} />
            {/* Aliases people type or that older copy referenced. One canonical
                page (MB4), so these redirect rather than duplicating content. */}
            <Route path="/faq" element={<Navigate to="/help" replace />} />
            <Route path="/support" element={<Navigate to="/help" replace />} />
            <Route path="/contact" element={<Navigate to="/help" replace />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/waitlist" element={<Waitlist />} />
            <Route path="/waitlist-rejected" element={<WaitlistRejected />} />
            <Route 
              path="/admin" 
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              } 
            />
            {/* The club Feed (browse other clubs' postings) lost its entry
                point when the club nav collapsed to four destinations. Redirect
                to public discovery, mirroring /student/feed → the Following
                filter, so the old link/bookmark lands on equivalent content
                instead of an orphaned page. */}
            <Route path="/club/feed" element={<Navigate to="/opportunities" replace />} />

            {/* Every address renamed on 2026-09-21 keeps working. Nothing is
                bookmarked or indexed yet — which is exactly why now was the
                cheapest moment to rename — and these keep that true for
                anything already sent in an email or pasted into a chat.
                `replace` keeps the old path out of the back history, so Back
                does not bounce through the redirect again. */}
            {LEGACY_ROUTES.map(({ from, to }) => (
              <Route key={from} path={from} element={<LegacyRedirect to={to} />} />
            ))}
            <Route
              path="/applicants" 
              element={
                <ProtectedRoute allowedRoles={["club"]}>
                  <ClubHome />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/postings" 
              element={
                <ProtectedRoute allowedRoles={["club"]}>
                  <ClubHome />
                </ProtectedRoute>
              } 
            />
            <Route
              path="/postings/events"
              element={
                <ProtectedRoute allowedRoles={["club"]}>
                  <ClubHome />
                </ProtectedRoute>
              }
            />
            {/* My Club → Overview: the old dashboard stats + recent items, which
                moved here when the work queue took over the club landing page. */}
            <Route
              path="/my-club"
              element={
                <ProtectedRoute allowedRoles={["club"]}>
                  <ClubHome />
                </ProtectedRoute>
              }
            />
            <Route 
              path="/applicants/events" 
              element={
                <ProtectedRoute allowedRoles={["club"]}>
                  <ClubHome />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/my-club/team" 
              element={
                <ProtectedRoute allowedRoles={["club"]}>
                  <ClubHome />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/my-club/analytics" 
              element={
                <ProtectedRoute allowedRoles={["club"]}>
                  <ClubHome />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/postings/new" 
              element={
                <ProtectedRoute allowedRoles={["club"]}>
                  <CreateOpportunity />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/postings/events/new" 
              element={
                <ProtectedRoute allowedRoles={["club"]}>
                  <CreateEvent />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/postings/:id/edit" 
              element={
                <ProtectedRoute allowedRoles={["club"]}>
                  <EditOpportunity />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/postings/events/:id/edit" 
              element={
                <ProtectedRoute allowedRoles={["club"]}>
                  <EditEvent />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/activity"
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentDashboard />
                </ProtectedRoute>
              } 
            />
            {/* The feed stopped being a destination and became a filter on
                discovery (maintainer decision, 2026-07-25). Old links and
                bookmarks land on that filter rather than a 404. */}
            <Route
              path="/student/feed"
              element={<Navigate to="/opportunities?filter=following" replace />}
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentProfile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile/edit"
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentProfileEdit />
                </ProtectedRoute>
              }
            />
            <Route 
              path="/my-club/edit" 
              element={
                <ProtectedRoute allowedRoles={["club"]}>
                  <ClubProfileSetup />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/messages"
              element={
                <ProtectedRoute allowedRoles={["student", "club"]}>
                  <Messages />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/notifications" 
              element={
                <ProtectedRoute allowedRoles={["student", "club"]}>
                  <Notifications />
                </ProtectedRoute>
              } 
            />
            {import.meta.env.DEV && ClubsPreview && (
              <Route path="/dev/clubs-preview" element={<ClubsPreview />} />
            )}
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </ThemeProvider>
</QueryClientProvider>
);

export default App;
