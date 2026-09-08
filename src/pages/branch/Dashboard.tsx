import { useQuery } from '@tanstack/react-query'
import { reportsApi, notificationsApi, invoicesApi, inventoryApi } from '@/api'
import { useAuthStore } from '@/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { ShoppingCart, TrendingUp, FileText, AlertTriangle, Flame } from 'lucide-react'

const BranchDashboard = () => {
  const { user } = useAuthStore()

  // 1. Existing general stats
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await reportsApi.getDashboardStats()
      return response.data
    },
  })

  // 2. Pending approvals (transfers/expenses)
  const { data: pendingData } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: async () => {
      const response = await notificationsApi.getPendingApprovals()
      return response.data
    },
  })

  // 3. Fetch invoices specifically for this branch
  const { data: branchInvoices } = useQuery({
    queryKey: ['branch-invoices', user?.branchId],
    queryFn: async () => {
      const response = await invoicesApi.getAll({ branchId: user?.branchId })
      return response.data
    },
    enabled: !!user?.branchId
  })

  // 4. Fetch Inventory specifically for this branch to calculate Gas/Shells
  const { data: inventory = [] } = useQuery({
    queryKey: ['branch-inventory', user?.branchId],
    queryFn: async () => {
      const response = await inventoryApi.getAll({ branchId: user?.branchId })
      return response.data
    },
    enabled: !!user?.branchId
  })

  // --- Calculations ---

  // Sales & Invoices
  const branchSales = stats?.recentSales?.filter((s: any) => s.branchId === user?.branchId)
  const myPendingInvoices = branchInvoices?.filter(
    (inv: any) => inv.status === 'PENDING' || inv.status === 'OVERDUE'
  ).length || 0

  // 6Kg Calculations
  const sixKgStock = inventory.filter((inv: any) => inv.product?.name?.toLowerCase().includes('6kg'))
  const sixKgRefills = sixKgStock.reduce((sum: number, inv: any) => sum + (inv.fullCylinders || 0), 0)
  const sixKgEmpties = sixKgStock.reduce((sum: number, inv: any) => sum + Math.max(0, (inv.quantity || 0) - (inv.fullCylinders || 0)), 0)

  // 13Kg Calculations
  const thirteenKgStock = inventory.filter((inv: any) => inv.product?.name?.toLowerCase().includes('13kg'))
  const thirteenKgRefills = thirteenKgStock.reduce((sum: number, inv: any) => sum + (inv.fullCylinders || 0), 0)
  const thirteenKgEmpties = thirteenKgStock.reduce((sum: number, inv: any) => sum + Math.max(0, (inv.quantity || 0) - (inv.fullCylinders || 0)), 0)

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

      {/* Grid updated to 5 columns for large screens to accommodate both gas sizes smoothly */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        
        {/* Today's Sales */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Today's Sales</p>
                <p className="text-3xl font-black mt-1 text-slate-800">{stats?.todaySales || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-100/50">
                <ShoppingCart className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Revenue */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Revenue</p>
                <p className="text-2xl font-black mt-1 text-emerald-600">
                  {formatCurrency(branchSales?.reduce((sum: number, s: any) => sum + Number(s.total), 0))}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-100/50">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoices */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">My Invoices</p>
                <p className="text-3xl font-black mt-1 text-slate-800">{myPendingInvoices}</p>
              </div>
              <div className="p-3 rounded-xl bg-yellow-100/50">
                <FileText className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 🚀 NEW: 6Kg Inventory */}
        <Card className="border-orange-100">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-bold text-orange-900/60 uppercase tracking-wider">6Kg Inventory</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <p className="text-3xl font-black text-orange-600">{sixKgRefills}</p>
                  <p className="text-xs font-semibold text-orange-600/70 uppercase">Refills</p>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-xl font-bold text-slate-600">{sixKgEmpties}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Empties</p>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-orange-100">
                <Flame className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 🚀 NEW: 13Kg Inventory */}
        <Card className="border-indigo-100">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-bold text-indigo-900/60 uppercase tracking-wider">13Kg Inventory</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <p className="text-3xl font-black text-indigo-600">{thirteenKgRefills}</p>
                  <p className="text-xs font-semibold text-indigo-600/70 uppercase">Refills</p>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-xl font-bold text-slate-600">{thirteenKgEmpties}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Empties</p>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-indigo-100">
                <Flame className="w-5 h-5 text-indigo-600" />
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
                      {sale.items?.length} item(s) | {sale.customer?.name || 'Walk-in'}
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
