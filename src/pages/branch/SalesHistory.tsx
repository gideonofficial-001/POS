import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { salesApi } from '@/api'
import { useAuthStore } from '@/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency, formatDate } from '@/lib/utils'
import { History, Calendar, Search } from 'lucide-react'

const SalesHistory = () => {
  const { user } = useAuthStore()
  const [search, setSearch] = useState('')
  const [view, setView] = useState('all')
  const [dateFilter, setDateFilter] = useState('')

  const { data: sales, isLoading } = useQuery({
    queryKey: ['sales', view, dateFilter],
    queryFn: async () => {
      const params: any = { branchId: user?.branchId }
      if (view !== 'all') params.type = view.toUpperCase()
      if (dateFilter) {
        const date = new Date(dateFilter)
        params.startDate = date.toISOString()
        params.endDate = new Date(date.setDate(date.getDate() + 1)).toISOString()
      }
      const response = await salesApi.getAll(params)
      return response.data
    },
  })

  const filtered = sales?.filter((sale: any) => {
    if (!search) return true
    return sale.saleCode?.toLowerCase().includes(search.toLowerCase()) ||
      sale.customerName?.toLowerCase().includes(search.toLowerCase())
  })

  // Group by date
  const grouped: Record<string, any[]> = {}
  filtered?.forEach((sale: any) => {
    const date = new Date(sale.createdAt).toLocaleDateString('en-KE', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
    if (!grouped[date]) grouped[date] = []
    grouped[date].push(sale)
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sales History</h1>
        <p className="text-muted-foreground">View your past sales</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by code or customer..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-auto" />
        </div>
      </div>

      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="cash">Cash</TabsTrigger>
          <TabsTrigger value="invoice">Invoice</TabsTrigger>
        </TabsList>
      </Tabs>

      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <History className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>No sales found</p>
        </div>
      ) : (
        Object.entries(grouped).map(([date, dateSales]) => (
          <div key={date} className="space-y-2">
            <h3 className="font-medium text-muted-foreground text-sm">{date}</h3>
            {dateSales.map((sale: any) => (
              <Card key={sale.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{sale.saleCode}</span>
                        <Badge variant={sale.type === 'CASH' ? 'default' : 'secondary'} className="text-xs">{sale.type}</Badge>
                        <Badge variant={sale.status === 'RETURNED' ? 'destructive' : 'success'} className="text-xs">{sale.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {sale.items?.length || 0} item(s) {sale.customerName && `| ${sale.customerName}`}
                      </p>
                    </div>
                    <p className="text-lg font-bold">{formatCurrency(sale.total)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ))
      )}
    </div>
  )
}

export default SalesHistory