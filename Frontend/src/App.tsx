import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/hooks/use-theme";
import { AppLayout } from "@/components/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ChatPage from "./pages/ChatPage";
import HistoryPage from "./pages/HistoryPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import AdminDashboard from "./pages/AdminDashboard";
import UserManagement from "./pages/UserManagement";
import UserDetailPage from "./pages/UserDetailPage";
import DataMartManagement from "./pages/DataMartManagement";
import DataMartDetail from "./pages/DataMartDetail";
import NewDataMartPage from "./pages/NewDataMartPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import DataMartAssignment from "./pages/DataMartAssignment";
import AuditLogPage from "./pages/AuditLogPage";
import NotificationsPage from "./pages/NotificationsPage";
import LandingPage from "./pages/LandingPage";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function PendingApproval() {
  const { logout, user } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="max-w-md text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-gold mx-auto mb-6">
          <Loader2 className="h-8 w-8 text-accent-foreground" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Account Pending Approval</h2>
        <p className="text-muted-foreground mb-2">
          Your account <span className="font-medium text-foreground">{user?.email}</span> is awaiting administrator approval.
        </p>
        <p className="text-sm text-muted-foreground mb-6">You'll be able to access the platform once an admin approves your account.</p>
        <button onClick={logout} className="text-sm text-primary hover:underline">Sign out</button>
      </div>
    </div>
  );
}

function SuspendedAccount() {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="max-w-md text-center">
        <h2 className="text-2xl font-bold mb-2 text-destructive">Account Suspended</h2>
        <p className="text-muted-foreground mb-6">Your account has been suspended. Please contact your administrator.</p>
        <button onClick={logout} className="text-sm text-primary hover:underline">Sign out</button>
      </div>
    </div>
  );
}

function ProtectedRoutes() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.status === "pending") return <PendingApproval />;
  if (user?.status === "suspended") return <SuspendedAccount />;

  return (
    <AppLayout>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Navigate to="/chat" replace />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin/datamarts" element={<DataMartManagement />} />
          <Route path="/admin/assignments" element={<DataMartAssignment />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<UserManagement />} />
          <Route path="/admin/users/:userId" element={<UserDetailPage />} />
          <Route path="/admin/datamarts/new" element={<NewDataMartPage />} />
          <Route path="/admin/datamarts/:id" element={<DataMartDetail />} />
          <Route path="/admin/analytics" element={<AnalyticsPage />} />
          <Route path="/admin/audit-logs" element={<AuditLogPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ErrorBoundary>
    </AppLayout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider>
        <AuthProvider>
          <Sonner position="top-right" />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/*" element={<ProtectedRoutes />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
