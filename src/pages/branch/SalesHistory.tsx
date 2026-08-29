import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { salesApi } from '@/api'
import { useAuthStore } from '@/store'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { History, Calendar, Search } from 'lucide-react'

const SalesHistory = () => {
  const { user } = useAuthStore()
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  const { data: sales, isLoading } = useQuery({
    queryKey: ['sales', dateFilter],
    queryFn: async () => {
      const params: any = { 
        branchId: user?.branchId,
        type: 'CASH' // Forces the backend to ONLY return cash/retail/wholesale sales
      }
      
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
        <p className="text-muted-foreground">View your past cash transactions</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by code or customer..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-white" />
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-auto bg-white" />
        </div>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground bg-white border rounded-xl shadow-sm">
          <History className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>No sales found</p>
        </div>
      ) : (
        Object.entries(grouped).map(([date, dateSales]) => (
          <div key={date} className="space-y-2">
            <h3 className="font-medium text-muted-foreground text-sm pl-1">{date}</h3>
            {dateSales.map((sale: any) => (
              <Card key={sale.id} className="hover:shadow-sm transition-shadow bg-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg">{sale.saleCode}</span>
                        <Badge variant={sale.status === 'RETURNED' ? 'destructive' : 'success'} className="text-xs">{sale.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {sale.saleItems?.length || 0} item(s) {sale.customer?.name && `| ${sale.customer.name}`}
                      </p>
                    </div>
                    <p className="text-xl font-black text-primary">{formatCurrency(sale.total)}</p>
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
