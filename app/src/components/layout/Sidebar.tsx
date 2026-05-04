import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore, useNotificationStore } from '@/store';
import { UserRole } from '@/types';
import {
  LayoutDashboard,
  Users,
  Building2,
  Package,
  Warehouse,
  ShoppingCart,
  FileText,
  RotateCcw,
  History,
  ClipboardList,
  MonitorSmartphone,
  BarChart3,
  ClipboardCheck,
  Settings,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const Sidebar = () => {
  const { user, clearAuth } = useAuthStore();
  const { counts } = useNotificationStore();
  const location = useLocation();

  const handleLogout = () => {
    clearAuth();
    window.location.href = '/login';
  };

  const getNavItems = () => {
    if (!user) return [];

    const items = [];

    // Super Admin Navigation
    if (user.role === UserRole.SUPER_ADMIN) {
      items.push(
        { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/users', icon: Users, label: 'Users' },
        { path: '/branches', icon: Building2, label: 'Branches' },
        { path: '/products', icon: Package, label: 'Products' },
        { path: '/inventory', icon: Warehouse, label: 'Inventory' },
        { path: '/new-sale', icon: ShoppingCart, label: 'New Sale' },
        { path: '/invoices', icon: FileText, label: 'Invoices' },
        { path: '/returns', icon: RotateCcw, label: 'Returns' },
        { path: '/sales-history', icon: History, label: 'Sales History' },
        { path: '/device-approvals', icon: MonitorSmartphone, label: 'Device Approvals', badge: counts.pendingDevices },
        { path: '/reports', icon: BarChart3, label: 'Reports' },
        { path: '/audit-logs', icon: ClipboardCheck, label: 'Audit Logs' },
      );
    }

    // Overall Manager Navigation
    if (user.role === UserRole.OVERALL_MANAGER) {
      items.push(
        { path: '/manager', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/inventory', icon: Warehouse, label: 'Inventory' },
        { path: '/device-approvals', icon: MonitorSmartphone, label: 'Device Approvals', badge: counts.pendingDevices },
        { path: '/reports', icon: BarChart3, label: 'Reports' },
        { path: '/audit-logs', icon: ClipboardCheck, label: 'Audit Logs' },
      );
    }

    // Branch Manager Navigation
    if (user.role === UserRole.BRANCH_MANAGER) {
      items.push(
        { path: '/branch', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/inventory', icon: Warehouse, label: 'My Inventory' },
        { path: '/new-sale', icon: ShoppingCart, label: 'New Sale' },
        { path: '/invoices', icon: FileText, label: 'Invoices' },
        { path: '/returns', icon: RotateCcw, label: 'Returns' },
        { path: '/sales-history', icon: History, label: 'Sales History' },
      );
    }

    return items;
  };

  const navItems = getNavItems();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 flex flex-col z-50">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">N</span>
          </div>
          <div>
            <h1 className="font-bold text-gray-900">Njugush POS</h1>
            <p className="text-xs text-gray-500">Enterprise System</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  )
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="flex-1">{item.label}</span>
                {item.badge > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors mb-2',
              isActive
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-100'
            )
          }
        >
          <Settings className="w-5 h-5" />
          <span>Settings</span>
        </NavLink>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 w-full transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
