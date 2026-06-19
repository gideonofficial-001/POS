import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store'
import { UserRole } from '@/types'

// Layouts
import MainLayout from '@/components/layout/MainLayout'
import AuthLayout from '@/components/layout/AuthLayout'

// Auth Pages
import Login from '@/pages/auth/Login'
import DeviceAuth from '@/pages/auth/DeviceAuth'

// Admin Pages
import AdminDashboard from '@/pages/admin/Dashboard'
import Users from '@/pages/admin/Users'
import Branches from '@/pages/admin/Branches'
import Inventory from '@/pages/admin/Inventory'
import Customers from '@/pages/admin/Customers'
import AuditLogs from '@/pages/admin/AuditLogs'

// Manager Pages
import ManagerDashboard from '@/pages/manager/Dashboard'
import Reports from '@/pages/manager/Reports'

// Branch Manager Pages
import BranchDashboard from '@/pages/branch/Dashboard'
import NewSale from '@/pages/branch/NewSale'
import Invoices from '@/pages/branch/Invoices'
import ReturnsPage from '@/pages/branch/Returns'
import SalesHistory from '@/pages/branch/SalesHistory'
import Expenses from '@/pages/branch/Expenses'
import Transfers from '@/pages/branch/Transfers'

// Shared Pages
import Notifications from '@/pages/shared/Notifications'
import Settings from '@/pages/shared/Settings'
import NotFound from '@/pages/NotFound'

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: UserRole[] }) => {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role as UserRole)) {
    // Redirect based on role
    if (user.role === UserRole.SUPER_ADMIN) return <Navigate to="/admin/dashboard" replace />
    if (user.role === UserRole.OVERALL_MANAGER) return <Navigate to="/manager/dashboard" replace />
    if (user.role === UserRole.BRANCH_MANAGER) return <Navigate to="/branch/dashboard" replace />
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

// Role-based redirect
const RoleRedirect = () => {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role === UserRole.SUPER_ADMIN) return <Navigate to="/admin/dashboard" replace />
  if (user?.role === UserRole.OVERALL_MANAGER) return <Navigate to="/manager/dashboard" replace />
  if (user?.role === UserRole.BRANCH_MANAGER) return <Navigate to="/branch/dashboard" replace />
  return <Navigate to="/login" replace />
}

function App() {
  return (
    <Routes>
      {/* Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/device-auth" element={<DeviceAuth />} />
      </Route>

      {/* Root redirect */}
      <Route path="/" element={<RoleRedirect />} />

      {/* Protected Routes */}
      <Route element={<MainLayout />}>
        {/* Super Admin Routes */}
        <Route path="/admin/dashboard" element={
          <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin/users" element={
          <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
            <Users />
          </ProtectedRoute>
        } />
        <Route path="/admin/branches" element={
          <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
            <Branches />
          </ProtectedRoute>
        } />
        <Route path="/admin/audit-logs" element={
          <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
            <AuditLogs />
          </ProtectedRoute>
        } />

        {/* Admin & Manager Routes */}
        <Route path="/inventory" element={
          <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.OVERALL_MANAGER]}>
            <Inventory />
          </ProtectedRoute>
        } />
        <Route path="/customers" element={
          <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.OVERALL_MANAGER]}>
            <Customers />
          </ProtectedRoute>
        } />
        <Route path="/manager/dashboard" element={
          <ProtectedRoute allowedRoles={[UserRole.OVERALL_MANAGER]}>
            <ManagerDashboard />
          </ProtectedRoute>
        } />
        <Route path="/manager/reports" element={
          <ProtectedRoute allowedRoles={[UserRole.OVERALL_MANAGER]}>
            <Reports />
          </ProtectedRoute>
        } />

        {/* Branch Manager Routes */}
        <Route path="/branch/dashboard" element={
          <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER]}>
            <BranchDashboard />
          </ProtectedRoute>
        } />
        <Route path="/branch/new-sale" element={
          <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER]}>
            <NewSale />
          </ProtectedRoute>
        } />
        <Route path="/branch/invoices" element={
          <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER]}>
            <Invoices />
          </ProtectedRoute>
        } />
        <Route path="/branch/returns" element={
          <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER]}>
            <ReturnsPage />
          </ProtectedRoute>
        } />
        <Route path="/branch/sales-history" element={
          <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER]}>
            <SalesHistory />
          </ProtectedRoute>
        } />
        <Route path="/branch/expenses" element={
          <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER]}>
            <Expenses />
          </ProtectedRoute>
        } />
        <Route path="/branch/transfers" element={
          <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER]}>
            <Transfers />
          </ProtectedRoute>
        } />

        {/* Shared Routes */}
        <Route path="/notifications" element={
          <ProtectedRoute>
            <Notifications />
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        } />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App