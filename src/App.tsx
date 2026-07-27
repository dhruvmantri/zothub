import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
const ClubMessages = lazy(() => import("./pages/ClubMessages"));
const StudentMessages = lazy(() => import("./pages/StudentMessages"));
const Notifications = lazy(() => import("./pages/Notifications"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ClubHome = lazy(() => import("./pages/club/ClubHome"));
const Privacy = lazy(() => import("./pages/Privacy"));
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

const queryClient = new QueryClient();

/** Full-screen fallback shown while a route chunk loads. */
const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-surface-2">
    <PageLoader />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    {/* Light default, both themes genuinely designed (Foundation). The old
        `forcedTheme="dark"` made the light theme unreachable. `data-theme` is
        the attribute the token layer and the design mocks both key off. */}
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/opportunities" element={<Opportunities />} />
            <Route path="/opportunities/:id" element={<OpportunityDetail />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/:id" element={<EventDetail />} />
            <Route path="/clubs" element={<Clubs />} />
            <Route path="/clubs/:id" element={<ClubDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/privacy" element={<Privacy />} />
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
            <Route
              path="/club/dashboard" 
              element={
                <ProtectedRoute allowedRoles={["club"]}>
                  <ClubHome />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/club/dashboard/opportunities" 
              element={
                <ProtectedRoute allowedRoles={["club"]}>
                  <ClubHome />
                </ProtectedRoute>
              } 
            />
            <Route
              path="/club/dashboard/events"
              element={
                <ProtectedRoute allowedRoles={["club"]}>
                  <ClubHome />
                </ProtectedRoute>
              }
            />
            {/* My Club → Overview: the old dashboard stats + recent items, which
                moved here when /club/dashboard became the Responses queue. */}
            <Route
              path="/club/dashboard/overview"
              element={
                <ProtectedRoute allowedRoles={["club"]}>
                  <ClubHome />
                </ProtectedRoute>
              }
            />
            <Route 
              path="/club/dashboard/applications" 
              element={
                <ProtectedRoute allowedRoles={["club"]}>
                  <ClubHome />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/club/dashboard/rsvps" 
              element={
                <ProtectedRoute allowedRoles={["club"]}>
                  <ClubHome />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/club/dashboard/team" 
              element={
                <ProtectedRoute allowedRoles={["club"]}>
                  <ClubHome />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/club/dashboard/analytics" 
              element={
                <ProtectedRoute allowedRoles={["club"]}>
                  <ClubHome />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/club/opportunities/new" 
              element={
                <ProtectedRoute allowedRoles={["club"]}>
                  <CreateOpportunity />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/club/events/new" 
              element={
                <ProtectedRoute allowedRoles={["club"]}>
                  <CreateEvent />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/club/opportunities/:id/edit" 
              element={
                <ProtectedRoute allowedRoles={["club"]}>
                  <EditOpportunity />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/club/events/:id/edit" 
              element={
                <ProtectedRoute allowedRoles={["club"]}>
                  <EditEvent />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/student/dashboard"
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
              path="/student/profile"
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentProfile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/profile/edit"
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentProfileEdit />
                </ProtectedRoute>
              }
            />
            <Route 
              path="/club/profile" 
              element={
                <ProtectedRoute allowedRoles={["club"]}>
                  <ClubProfileSetup />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/club/messages" 
              element={
                <ProtectedRoute allowedRoles={["club"]}>
                  <ClubMessages />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/student/messages" 
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentMessages />
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
