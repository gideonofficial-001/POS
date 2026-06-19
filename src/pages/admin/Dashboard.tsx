import { useQuery } from '@tanstack/react-query'
import { reportsApi, notificationsApi } from '@/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatRelativeTime } from '@/lib/utils'
import {
  ShoppingCart, Users, Building2, PackageSearch,
  TrendingUp, AlertTriangle, FileText, Bell
} from 'lucide-react'

const AdminDashboard = () => {
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await reportsApi.getDashboardStats()
      return response.data
    },
  })

  const { data: pendingData } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: async () => {
      const response = await notificationsApi.getPendingApprovals()
      return response.data
    },
  })

  const statCards = [
    { title: 'Total Sales', value: stats?.totalSales || 0, icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: 'Total Revenue', value: formatCurrency(stats?.totalRevenue), icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    { title: 'Branches', value: stats?.totalBranches || 0, icon: Building2, color: 'text-purple-600', bg: 'bg-purple-50' },
    { title: 'Products', value: stats?.totalProducts || 0, icon: PackageSearch, color: 'text-orange-600', bg: 'bg-orange-50' },
    { title: 'Users', value: stats?.totalUsers || 0, icon: Users, color: 'text-pink-600', bg: 'bg-pink-50' },
    { title: 'Pending Invoices', value: stats?.pendingInvoices || 0, icon: FileText, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Overview of your POS system</p>
      </div>

      {/* Pending Approvals Alert */}
      {pendingData && pendingData.total > 0 && (
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="flex items-center gap-4 py-4">
            <Bell className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-200">
                You have {pendingData.total} pending approval{pendingData.total > 1 ? 's' : ''}
              </p>
              <div className="flex gap-3 mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                {pendingData.pendingReturns > 0 && <span>{pendingData.pendingReturns} returns</span>}
                {pendingData.pendingDevices > 0 && <span>{pendingData.pendingDevices} devices</span>}
                {pendingData.pendingTransfers > 0 && <span>{pendingData.pendingTransfers} transfers</span>}
                {pendingData.pendingExpenses > 0 && <span>{pendingData.pendingExpenses} expenses</span>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <Card key={card.title} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.title}</p>
                  <p className="text-2xl font-bold mt-1">{card.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${card.bg}`}>
                  <card.icon className={`w-6 h-6 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Low Stock Alert */}
      {stats?.lowStock > 0 && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
          <CardContent className="flex items-center gap-4 py-4">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <p className="font-medium text-red-800 dark:text-red-200">
              {stats.lowStock} product{stats.lowStock > 1 ? 's' : ''} with low stock
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recent Sales */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Sales</CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.recentSales?.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No sales yet</p>
          ) : (
            <div className="space-y-3">
              {stats?.recentSales?.slice(0, 5).map((sale: any) => (
                <div key={sale.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">{sale.saleCode}</p>
                    <p className="text-sm text-muted-foreground">
                      {sale.branch?.name} by {sale.user?.firstName} {sale.user?.lastName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(sale.total)}</p>
                    <Badge variant={sale.type === 'CASH' ? 'default' : 'secondary'} className="text-xs">
                      {sale.type}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default AdminDashboard