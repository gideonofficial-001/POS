import { useQuery } from '@tanstack/react-query';
import { salesApi, inventoryApi } from '@/api';
import { useAuthStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ShoppingCart, 
  Package, 
  TrendingUp,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { formatCurrency } from '@/utils';
import { Link } from 'react-router-dom';

const BranchDashboard = () => {
  const { user } = useAuthStore();
  const branchId = user?.branchId;

  const { data: dailySales } = useQuery({
    queryKey: ['dailySales', branchId],
    queryFn: async () => {
      if (!branchId) return null;
      const response = await salesApi.getDailySummary(branchId);
      return response.data;
    },
    enabled: !!branchId,
  });

  const { data: inventory } = useQuery({
    queryKey: ['inventory', branchId],
    queryFn: async () => {
      if (!branchId) return null;
      const response = await inventoryApi.getByBranch(branchId);
      return response.data;
    },
    enabled: !!branchId,
  });

  const lowStockItems = inventory?.filter((item: any) => item.isLowStock) || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Branch Dashboard</h1>
          <p className="text-gray-500">{user?.branch?.name}</p>
        </div>
        <Button asChild>
          <Link to="/new-sale">New Sale</Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Today's Sales
            </CardTitle>
            <ShoppingCart className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dailySales?.totalSales || 0}</div>
            <p className="text-sm text-gray-500 mt-1">
              {formatCurrency(dailySales?.totalAmount || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Products in Stock
            </CardTitle>
            <Package className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inventory?.length || 0}</div>
            <p className="text-sm text-gray-500 mt-1">
              {lowStockItems.length} low stock items
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Low Stock Alerts
            </CardTitle>
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lowStockItems.length}</div>
            <Button variant="link" className="p-0 h-auto mt-2" asChild>
              <Link to="/inventory">
                View inventory <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
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
            <Button asChild className="h-auto py-6 flex flex-col items-center gap-2">
              <Link to="/new-sale">
                <ShoppingCart className="h-6 w-6" />
                <span>New Sale</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-6 flex flex-col items-center gap-2">
              <Link to="/invoices">
                <TrendingUp className="h-6 w-6" />
                <span>Invoices</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-6 flex flex-col items-center gap-2">
              <Link to="/returns">
                <AlertTriangle className="h-6 w-6" />
                <span>Returns</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto py-6 flex flex-col items-center gap-2">
              <Link to="/sales-history">
                <Package className="h-6 w-6" />
                <span>Sales History</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Sales */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Today's Sales Summary</CardTitle>
          <Button variant="link" asChild>
            <Link to="/sales-history">View All</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-sm text-gray-500">Cash Sales</p>
                <p className="text-xl font-bold">{dailySales?.cashSales || 0}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-sm text-gray-500">Invoice Sales</p>
                <p className="text-xl font-bold">{dailySales?.invoiceSales || 0}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-sm text-gray-500">LPG Refills</p>
                <p className="text-xl font-bold">{dailySales?.lpgRefills || 0}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-sm text-gray-500">Electronics</p>
                <p className="text-xl font-bold">{dailySales?.electronics || 0}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BranchDashboard;
