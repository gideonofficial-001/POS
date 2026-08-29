import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { salesApi } from '@/api'
import { useAuthStore } from '@/store'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/utils'
import { Calendar, Search, Printer, Store } from 'lucide-react'

const SalesHistory = () => {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'OVERALL_MANAGER'
  
  const [search, setSearch] = useState('')
  const [view, setView] = useState('all') // 'all', 'retail', 'wholesale'
  const [dateFilter, setDateFilter] = useState('')

  const { data: sales, isLoading } = useQuery({
    queryKey: ['sales', dateFilter, isAdmin],
    queryFn: async () => {
      // Admins fetch everything; Branch managers fetch only their branch
      const params: any = {}
      if (!isAdmin) params.branchId = user?.branchId
      
      if (dateFilter) {
        const date = new Date(dateFilter)
        params.startDate = date.toISOString()
        params.endDate = new Date(date.setDate(date.getDate() + 1)).toISOString()
      }
      const response = await salesApi.getAll(params)
      return response.data
    },
  })

  // Flatten the sales into individual transaction rows
  const transactionRows = useMemo(() => {
    if (!sales) return []
    const rows: any[] = []

    sales.forEach((sale: any) => {
      // Filter out invoices
      if (sale.type === 'INVOICE') return
      
      // Filter by retail/wholesale tabs
      if (view === 'retail' && sale.type !== 'CASH') return
      if (view === 'wholesale' && sale.type !== 'WHOLESALE') return

      sale.saleItems?.forEach((item: any, index: number) => {
        const lpgLabel = item.lpgVariant === 'REFILL' ? ' (Refill)' : item.lpgVariant === 'EMPTY_SHELL' ? ' (Empty Shell)' : item.lpgVariant === 'COMPLETE_SET' ? ' (Complete Set)' : '';
        const description = `${item.product?.name || 'Unknown Item'}${lpgLabel} x${item.quantity}pcs`;
        
        // Suffix the reference code if there are multiple items in one sale checkout
        const reference = sale.saleItems.length > 1 ? `${sale.saleCode}-${index + 1}` : sale.saleCode;

        // Apply Search Filter at the item level
        if (search) {
          const term = search.toLowerCase()
          const matchCode = reference.toLowerCase().includes(term)
          const matchDesc = description.toLowerCase().includes(term)
          const matchCustomer = sale.customer?.name?.toLowerCase().includes(term)
          if (!matchCode && !matchDesc && !matchCustomer) return // skip this row
        }

        rows.push({
          id: item.id || `${sale.id}-${index}`,
          date: new Date(sale.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          description,
          type: sale.type === 'CASH' ? 'RETAIL' : sale.type,
          reference,
          amount: item.total,
          status: sale.status,
          customer: sale.customer?.name,
          branchName: sale.branch?.name
        })
      })
    })

    return rows
  }, [sales, search, view])

  const totalAmount = transactionRows.reduce((sum, row) => sum + Number(row.amount), 0)

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6 print:m-0 print:p-0">
      {/* ── HEADER (Hidden on Print) ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">{isAdmin ? 'Global Sales History' : 'Sales History'}</h1>
          <p className="text-muted-foreground">Tabular view of all cash and wholesale item transactions</p>
        </div>
        <Button onClick={handlePrint} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Printer className="w-4 h-4 mr-2" /> Print Statement
        </Button>
      </div>

      {/* ── FILTERS (Hidden on Print) ── */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-white p-3 rounded-lg border shadow-sm print:hidden">
        <div className="flex w-full lg:w-auto gap-4">
          <div className="relative w-full lg:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search ref code, item, or customer..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-full" />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground hidden sm:block" />
            <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-auto" />
          </div>
        </div>
        
        <div className="flex p-1 bg-muted/50 rounded-lg border w-full lg:w-auto">
          <button onClick={() => setView('all')} className={`flex-1 lg:px-6 py-1.5 text-sm font-bold rounded-md transition-all ${view === 'all' ? 'bg-white shadow text-primary' : 'text-muted-foreground'}`}>All Sales</button>
          <button onClick={() => setView('retail')} className={`flex-1 lg:px-6 py-1.5 text-sm font-bold rounded-md transition-all ${view === 'retail' ? 'bg-blue-600 shadow text-white' : 'text-muted-foreground'}`}>Retail</button>
          <button onClick={() => setView('wholesale')} className={`flex-1 lg:px-6 py-1.5 text-sm font-bold rounded-md transition-all ${view === 'wholesale' ? 'bg-purple-600 shadow text-white' : 'text-muted-foreground'}`}>Wholesale</button>
        </div>
      </div>

      {/* ── PRINT HEADER (Only visible on print) ── */}
      <div className="hidden print:block text-center mb-6">
        <h1 className="text-2xl font-black">NJUGUSH POS ENTERPRISE</h1>
        <h2 className="text-lg font-bold uppercase mt-1">Transaction History Statement</h2>
        <p className="text-sm text-gray-600 mt-1">Date Printed: {new Date().toLocaleString()}</p>
      </div>

      {/* ── TRANSACTION TABLE ── */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden print:border-none print:shadow-none">
        {/* Table Header mimicking SMIS style */}
        <div className="bg-amber-500 text-white font-bold p-3 uppercase tracking-wider text-sm hidden print:block">
          Transaction History
        </div>

        <div className="overflow-x-auto">
          <Table className="print:text-xs">
            <TableHeader>
              <TableRow className="bg-slate-100 hover:bg-slate-100 print:bg-gray-200">
                <TableHead className="w-[50px] font-bold text-slate-700">#</TableHead>
                <TableHead className="font-bold text-slate-700 whitespace-nowrap">DATE</TableHead>
                <TableHead className="font-bold text-slate-700 min-w-[250px]">DESCRIPTION</TableHead>
                <TableHead className="font-bold text-slate-700">TYPE</TableHead>
                <TableHead className="font-bold text-slate-700">REFERENCE</TableHead>
                {isAdmin && <TableHead className="font-bold text-slate-700 print:hidden">BRANCH</TableHead>}
                <TableHead className="font-bold text-slate-700 text-right">AMOUNT (KES)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-10 text-muted-foreground">Loading transactions...</TableCell></TableRow>
              ) : transactionRows.length === 0 ? (
                <TableRow><TableCell colSpan={isAdmin ? 7 : 6} className="text-center py-10 text-muted-foreground">No transactions found for the selected criteria.</TableCell></TableRow>
              ) : (
                transactionRows.map((row, idx) => (
                  <TableRow key={row.id} className="hover:bg-slate-50 print:border-b print:border-gray-300">
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{row.date}</TableCell>
                    <TableCell className="font-medium">
                      {row.description}
                      {row.customer && <span className="block text-xs text-muted-foreground mt-0.5 font-normal">Client: {row.customer}</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] py-0 ${row.type === 'WHOLESALE' ? 'text-purple-700 border-purple-200 bg-purple-50' : 'text-blue-700 border-blue-200 bg-blue-50'} print:border-none print:p-0`}>
                        {row.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-600">{row.reference}</TableCell>
                    {isAdmin && (
                      <TableCell className="print:hidden">
                        <Badge variant="secondary" className="text-[10px] font-normal py-0 bg-slate-100">
                          <Store className="w-3 h-3 mr-1 text-muted-foreground" /> {row.branchName}
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell className="text-right font-bold text-primary print:text-black">
                      {formatCurrency(row.amount)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* ── FOOTER TOTALS ── */}
        <div className="bg-slate-50 border-t p-4 flex justify-end items-center print:bg-transparent print:border-t-2 print:border-black print:mt-4">
          <div className="text-right">
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Filtered Amount</p>
            <p className="text-2xl font-black text-emerald-600 print:text-black">{formatCurrency(totalAmount)}</p>
          </div>
        </div>
      </div>

      {/* Global Print CSS to hide the sidebar and normalize the layout during printing */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { margin: 1cm; size: landscape; }
          body * { visibility: hidden; }
          .print\\:m-0, .print\\:m-0 * { visibility: visible; }
          .print\\:m-0 { position: absolute; left: 0; top: 0; width: 100%; }
          aside, nav, header { display: none !important; }
        }
      `}} />
    </div>
  )
}

export default SalesHistory
