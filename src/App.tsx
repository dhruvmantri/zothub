import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Landing from "./pages/Landing";
import Opportunities from "./pages/Opportunities";
import Events from "./pages/Events";
import Clubs from "./pages/Clubs";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ClubDashboard from "./pages/ClubDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import StudentProfileSetup from "./pages/StudentProfileSetup";
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
            <Route path="/events" element={<Events />} />
            <Route path="/clubs" element={<Clubs />} />
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
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
