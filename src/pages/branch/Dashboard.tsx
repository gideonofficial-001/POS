import { useQuery } from '@tanstack/react-query'
import { reportsApi, notificationsApi } from '@/api'
import { useAuthStore } from '@/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { ShoppingCart, TrendingUp, FileText, Receipt, AlertTriangle, ArrowLeftRight } from 'lucide-react'

const BranchDashboard = () => {
  const { user } = useAuthStore()

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

  const branchSales = stats?.recentSales?.filter((s: any) => s.branchId === user?.branchId)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Branch Dashboard</h1>
        <p className="text-muted-foreground">Welcome, {user?.firstName} {user?.lastName}</p>
      </div>

      {pendingData && (pendingData.pendingTransfers > 0 || pendingData.pendingExpenses > 0) && (
        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="flex items-center gap-4 py-4">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-200">
                Pending items: {pendingData.pendingTransfers > 0 && `${pendingData.pendingTransfers} transfers`}
                {pendingData.pendingExpenses > 0 && ` ${pendingData.pendingExpenses} expenses`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Today's Sales</p>
                <p className="text-2xl font-bold">{stats?.todaySales || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-50">
                <ShoppingCart className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(branchSales?.reduce((sum: number, s: any) => sum + Number(s.total), 0))}</p>
              </div>
              <div className="p-3 rounded-lg bg-green-50">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">My Invoices</p>
                <p className="text-2xl font-bold">{stats?.pendingInvoices || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-yellow-50">
                <FileText className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Expenses</p>
                <p className="text-2xl font-bold">{pendingData?.pendingExpenses || 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-purple-50">
                <Receipt className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Sales</CardTitle>
        </CardHeader>
        <CardContent>
          {!branchSales || branchSales.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No sales yet. Start by creating a new sale!</p>
          ) : (
            <div className="space-y-3">
              {branchSales.slice(0, 5).map((sale: any) => (
                <div key={sale.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">{sale.saleCode}</p>
                    <p className="text-sm text-muted-foreground">
                      {sale.items?.length} item(s) | {sale.customerName || 'Walk-in'}
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

export default BranchDashboard