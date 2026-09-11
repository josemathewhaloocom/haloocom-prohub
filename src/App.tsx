import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Projects from "@/pages/Projects";
import POCs from "@/pages/POCs";
import POCDetail from "@/pages/POCDetail";
import Engineers from "@/pages/Engineers";
import Documents from "@/pages/Documents";
import SettingsPage from "@/pages/SettingsPage";
import ProjectDetail from "@/pages/ProjectDetail";
import DailyUpdates from "@/pages/DailyUpdates";
import UsersPage from "@/pages/UsersPage";
import SupportTickets from "@/pages/SupportTickets";
import TicketReports from "@/pages/TicketReports";
import FAQPage from "@/pages/FAQPage";
import Standups from "@/pages/Standups";
import Tasks from "@/pages/Tasks";
import CommandCenter from "@/pages/CommandCenter";
import Reviews from "@/pages/Reviews";

import NotFound from "./pages/NotFound";
import PublicSign from "./pages/PublicSign";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/sign/:token" element={<PublicSign />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/pocs" element={<POCs />} />
              <Route path="/pocs/:id" element={<POCDetail />} />
              <Route path="/engineers" element={<Engineers />} />
              <Route path="/updates" element={<DailyUpdates />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/tickets" element={<SupportTickets />} />
              <Route path="/ticket-reports" element={<TicketReports />} />
              <Route path="/faq" element={<FAQPage />} />
              <Route path="/standups" element={<Standups />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/command-center" element={<CommandCenter />} />
              <Route path="/reviews" element={<Reviews />} />
              
              <Route path="/users" element={<UsersPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
