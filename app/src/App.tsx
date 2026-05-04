import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { useAuthStore } from '@/store';

// Layouts
import MainLayout from '@/components/layout/MainLayout';
import AuthLayout from '@/components/layout/AuthLayout';

// Auth Pages
import Login from '@/pages/auth/Login';
import DeviceAuth from '@/pages/auth/DeviceAuth';

// Admin Pages
import AdminDashboard from '@/pages/admin/Dashboard';
import Users from '@/pages/admin/Users';
import Branches from '@/pages/admin/Branches';
import Products from '@/pages/admin/Products';
import Inventory from '@/pages/admin/Inventory';

// Manager Pages
import ManagerDashboard from '@/pages/manager/Dashboard';
import DeviceApprovals from '@/pages/manager/DeviceApprovals';
import Reports from '@/pages/manager/Reports';

// Branch Manager Pages
import BranchDashboard from '@/pages/branch/Dashboard';
import NewSale from '@/pages/branch/NewSale';
import Invoices from '@/pages/branch/Invoices';
import Returns from '@/pages/branch/Returns';
import SalesHistory from '@/pages/branch/SalesHistory';

// Common Pages
import AuditLogs from '@/pages/admin/AuditLogs';
import Settings from '@/pages/Settings';
import NotFound from '@/pages/NotFound';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          {/* Auth Routes */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/device-auth" element={<DeviceAuth />} />
          </Route>

          {/* Protected Routes */}
          <Route element={<MainLayout />}>
            {/* Super Admin Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <Users />
                </ProtectedRoute>
              }
            />
            <Route
              path="/branches"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <Branches />
                </ProtectedRoute>
              }
            />
            <Route
              path="/products"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <Products />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'OVERALL_MANAGER', 'BRANCH_MANAGER']}>
                  <Inventory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/audit-logs"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'OVERALL_MANAGER']}>
                  <AuditLogs />
                </ProtectedRoute>
              }
            />

            {/* Manager Routes */}
            <Route
              path="/manager"
              element={
                <ProtectedRoute allowedRoles={['OVERALL_MANAGER']}>
                  <ManagerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/device-approvals"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'OVERALL_MANAGER']}>
                  <DeviceApprovals />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'OVERALL_MANAGER']}>
                  <Reports />
                </ProtectedRoute>
              }
            />

            {/* Branch Manager Routes */}
            <Route
              path="/branch"
              element={
                <ProtectedRoute allowedRoles={['BRANCH_MANAGER']}>
                  <BranchDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/new-sale"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'BRANCH_MANAGER']}>
                  <NewSale />
                </ProtectedRoute>
              }
            />
            <Route
              path="/invoices"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'BRANCH_MANAGER']}>
                  <Invoices />
                </ProtectedRoute>
              }
            />
            <Route
              path="/returns"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'BRANCH_MANAGER']}>
                  <Returns />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sales-history"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'BRANCH_MANAGER']}>
                  <SalesHistory />
                </ProtectedRoute>
              }
            />

            {/* Common Routes */}
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}

export default App;
