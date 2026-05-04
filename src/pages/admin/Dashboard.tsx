import { useQuery } from '@tanstack/react-query';
import { salesApi, notificationsApi, inventoryApi } from '@/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  Users, 
  Package, 
  AlertTriangle,
  ShoppingCart,
  RotateCcw,
  MonitorSmartphone,
  ArrowRight
} from 'lucide-react';
import { formatCurrency } from '@/utils';
import { Link } from 'react-router-dom';

const AdminDashboard = () => {
  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await notificationsApi.getDashboard();
      return response.data;
    },
  });

  const { data: dailySales } = useQuery({
    queryKey: ['dailySales'],
    queryFn: async () => {
      const response = await salesApi.getDailySummary();
      return response.data;
    },
  });

  const { data: lowStock } = useQuery({
    queryKey: ['lowStock'],
    queryFn: async () => {
      const response = await inventoryApi.getAlerts();
      return response.data;
    },
  });

  const stats = [
    {
      title: "Today's Sales",
      value: dailySales?.totalSales || 0,
      amount: formatCurrency(dailySales?.totalAmount || 0),
      icon: ShoppingCart,
      trend: '+12%',
      color: 'blue',
    },
    {
      title: 'Pending Returns',
      value: notifications?.pendingReturns || 0,
      icon: RotateCcw,
      color: 'orange',
      link: '/returns',
    },
    {
      title: 'Device Requests',
      value: notifications?.pendingDevices || 0,
      icon: MonitorSmartphone,
      color: 'purple',
      link: '/device-approvals',
    },
    {
      title: 'Low Stock Items',
      value: lowStock?.length || 0,
      icon: AlertTriangle,
      color: 'red',
      link: '/inventory',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Overview of your business operations</p>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link to="/reports">View Reports</Link>
          </Button>
          <Button asChild>
            <Link to="/new-sale">New Sale</Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-5 w-5 text-${stat.color}-500`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              {stat.amount && (
                <p className="text-sm text-gray-500 mt-1">{stat.amount}</p>
              )}
              {stat.link && (
                <Button variant="link" className="p-0 h-auto mt-2" asChild>
                  <Link to={stat.link}>
                    View details <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sales Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Today's Sales Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">Cash Sales</p>
                    <p className="text-sm text-gray-500">Direct payments</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold">{dailySales?.cashSales || 0}</p>
                  <Badge variant="secondary">Completed</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Package className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">Invoice Sales</p>
                    <p className="text-sm text-gray-500">Credit sales</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold">{dailySales?.invoiceSales || 0}</p>
                  <Badge variant="outline">Pending Payment</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Product Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">LPG Refills</span>
                <span className="font-bold">{dailySales?.lpgRefills || 0}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{ width: '60%' }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">LPG Cylinders</span>
                <span className="font-bold">{dailySales?.lpgCylinders || 0}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full" 
                  style={{ width: '30%' }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Electronics</span>
                <span className="font-bold">{dailySales?.electronics || 0}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-purple-600 h-2 rounded-full" 
                  style={{ width: '10%' }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button asChild variant="outline" className="h-auto py-4 flex flex-col items-center gap-2">
              <Link to="/users">
                <Users className="h-6 w-6" />
                <span>Manage Users</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-4 flex flex-col items-center gap-2">
              <Link to="/products">
                <Package className="h-6 w-6" />
                <span>Products</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-4 flex flex-col items-center gap-2">
              <Link to="/inventory">
                <AlertTriangle className="h-6 w-6" />
                <span>Inventory</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-4 flex flex-col items-center gap-2">
              <Link to="/audit-logs">
                <TrendingUp className="h-6 w-6" />
                <span>Audit Logs</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
