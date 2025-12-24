import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Landing from "./pages/Landing";
import Opportunities from "./pages/Opportunities";
import OpportunityDetail from "./pages/OpportunityDetail";
import Events from "./pages/Events";
import EventDetail from "./pages/EventDetail";
import Clubs from "./pages/Clubs";
import ClubDetail from "./pages/ClubDetail";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ClubDashboard from "./pages/ClubDashboard";
import CreateOpportunity from "./pages/CreateOpportunity";
import CreateEvent from "./pages/CreateEvent";
import EditOpportunity from "./pages/EditOpportunity";
import EditEvent from "./pages/EditEvent";
import StudentDashboard from "./pages/StudentDashboard";
import StudentProfileSetup from "./pages/StudentProfileSetup";
import ClubProfileSetup from "./pages/ClubProfileSetup";
import ClubMessages from "./pages/ClubMessages";
import StudentMessages from "./pages/StudentMessages";
import Notifications from "./pages/Notifications";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
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
            <Route 
              path="/club/dashboard" 
              element={
                <ProtectedRoute allowedRoles={["club"]}>
                  <ClubDashboard />
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
            <Route 
              path="/student/profile" 
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentProfileSetup />
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
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
