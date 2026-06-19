import { NavLink, useLocation } from 'react-router-dom'
import { useAuthStore, useSidebarStore } from '@/store'
import { UserRole } from '@/types'
import {
  LayoutDashboard, Users, Building2, PackageSearch, UsersRound,
  ShoppingCart, FileText, RotateCcw, History, BarChart3,
  ClipboardList, Settings, LogOut, Bell, ArrowLeftRight,
  Receipt, ChevronLeft, ChevronRight, X, Menu, CreditCard
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const Sidebar = () => {
  const { user, clearAuth } = useAuthStore()
  const { collapsed, mobileOpen, toggleCollapsed, setMobileOpen } = useSidebarStore()
  const location = useLocation()

  const handleLogout = () => {
    clearAuth()
    toast.success('Logged out successfully')
    window.location.href = '/login'
  }

  const getNavItems = () => {
    if (!user) return []
    const items = []

    // Super Admin Navigation
    if (user.role === UserRole.SUPER_ADMIN) {
      items.push(
        { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/admin/users', icon: Users, label: 'Users' },
        { path: '/admin/branches', icon: Building2, label: 'Branches' },
        { path: '/inventory', icon: PackageSearch, label: 'Inventory' },
        { path: '/customers', icon: UsersRound, label: 'Customers' },
        { path: '/notifications', icon: Bell, label: 'Notifications' },
        { path: '/admin/audit-logs', icon: ClipboardList, label: 'Audit Logs' },
        { path: '/settings', icon: Settings, label: 'Settings' },
      )
    }

    // Overall Manager Navigation
    if (user.role === UserRole.OVERALL_MANAGER) {
      items.push(
        { path: '/manager/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/inventory', icon: PackageSearch, label: 'Inventory' },
        { path: '/customers', icon: UsersRound, label: 'Customers' },
        { path: '/manager/reports', icon: BarChart3, label: 'Reports' },
        { path: '/notifications', icon: Bell, label: 'Notifications' },
        { path: '/settings', icon: Settings, label: 'Settings' },
      )
    }

    // Branch Manager Navigation
    if (user.role === UserRole.BRANCH_MANAGER) {
      items.push(
        { path: '/branch/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/branch/new-sale', icon: ShoppingCart, label: 'New Sale' },
        { path: '/branch/invoices', icon: FileText, label: 'Invoices' },
        { path: '/branch/sales-history', icon: History, label: 'Sales History' },
        { path: '/branch/returns', icon: RotateCcw, label: 'Returns' },
        { path: '/branch/expenses', icon: Receipt, label: 'Expenses' },
        { path: '/branch/transfers', icon: ArrowLeftRight, label: 'Transfers' },
        { path: '/notifications', icon: Bell, label: 'Notifications' },
        { path: '/settings', icon: Settings, label: 'Settings' },
      )
    }

    return items
  }

  const navItems = getNavItems()

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-bold text-lg">N</span>
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="font-bold text-lg leading-tight truncate">Njugush POS</h1>
              <p className="text-xs text-muted-foreground truncate">Enterprise System</p>
            </div>
          )}
        </div>
        {/* Mobile close */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-2 hover:bg-muted rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>
        {/* Desktop collapse */}
        <button
          onClick={toggleCollapsed}
          className="hidden lg:flex p-1.5 hover:bg-muted rounded-lg transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )
                }
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 w-full transition-colors"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Toggle Button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-30 lg:hidden p-2 bg-background border rounded-lg shadow-sm"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-full bg-background border-r flex flex-col z-50 transition-all duration-300',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0 w-64' : '-translate-x-full',
          collapsed ? 'lg:w-20' : 'lg:w-64',
          'w-64'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  )
}

export default Sidebar