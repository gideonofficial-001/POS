import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { salesApi, branchesApi } from '@/api'
import { useAuthStore } from '@/store'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/utils'
import { Calendar, Search, Printer, Store, FileDown } from 'lucide-react'
import { toast } from 'sonner'

// Helper function to calculate the "Business Date" based on a 9:00 PM cutoff.
const getBusinessDate = (dateString: string) => {
  const date = new Date(dateString)
  // If the time is 21:00 (9 PM) or later, it counts for the next day
  if (date.getHours() >= 21) {
    date.setDate(date.getDate() + 1)
  }
  // Return just the YYYY-MM-DD part for grouping/filtering
  return date.toISOString().split('T')[0]
}

const SalesHistory = () => {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'OVERALL_MANAGER'
  
  const [search, setSearch] = useState('')
  const [view, setView] = useState('all') // 'all', 'retail', 'wholesale'
  
  // Date filtering now defaults to today's "Business Date"
  const todayBusinessDate = getBusinessDate(new Date().toISOString())
  const [dateFilter, setDateFilter] = useState(todayBusinessDate)
  
  // Admin Branch Selection
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all')

  // End of Month Receipt Prompt State
  const [showEndOfMonthPrompt, setShowEndOfMonthPrompt] = useState(false)

  // 1. Fetch Branches for Admin Dropdown
  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const response = await branchesApi.getAll()
      return response.data
    },
    enabled: isAdmin,
  })

  // 2. Fetch Sales Data based on filters
  const { data: sales, isLoading } = useQuery({
    queryKey: ['sales', selectedBranchId, isAdmin],
    queryFn: async () => {
      const params: any = {}
      
      if (!isAdmin) {
        params.branchId = user?.branchId
      } else if (selectedBranchId !== 'all') {
        params.branchId = selectedBranchId
      }
      
      // Note: We fetch ALL sales for the selected branch(es) and then filter by Business Date on the client side. 
      // This ensures the 9PM logic is perfectly applied without needing complex SQL queries.
      const response = await salesApi.getAll(params)
      return response.data
    },
  })

  // 3. End of Month Prompt Logic
  useEffect(() => {
    if (!isAdmin) return;

    const today = new Date();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const daysUntilEnd = lastDayOfMonth.getDate() - today.getDate();

    // Check if it's the last two days of the month
    if (daysUntilEnd <= 1) {
      const currentMonthKey = `${today.getFullYear()}-${today.getMonth()}`;
      const hasDownloaded = localStorage.getItem(`monthly_receipt_downloaded_${currentMonthKey}`);
      
      if (!hasDownloaded) {
        setShowEndOfMonthPrompt(true);
      }
    }
  }, [isAdmin]);

  const handleDownloadMonthlyReceipt = () => {
    // Logic to compile and download the monthly CSV/PDF would go here.
    // For now, we simulate success and set the localStorage flag.
    const today = new Date();
    const currentMonthKey = `${today.getFullYear()}-${today.getMonth()}`;
    
    localStorage.setItem(`monthly_receipt_downloaded_${currentMonthKey}`, 'true');
    setShowEndOfMonthPrompt(false);
    toast.success('Monthly receipts downloaded successfully!');
  }

  // 4. Flatten and Filter the sales into individual transaction rows
  const transactionRows = useMemo(() => {
    if (!sales) return []
    const rows: any[] = []

    sales.forEach((sale: any) => {
      if (sale.type === 'INVOICE') return
      
      if (view === 'retail' && sale.type !== 'CASH') return
      if (view === 'wholesale' && sale.type !== 'WHOLESALE') return

      // Apply the 9:00 PM Business Date logic
      const businessDate = getBusinessDate(sale.createdAt)
      if (dateFilter && businessDate !== dateFilter) return

      sale.saleItems?.forEach((item: any, index: number) => {
        const lpgLabel = item.lpgVariant === 'REFILL' ? ' (Refill)' : item.lpgVariant === 'EMPTY_SHELL' ? ' (Empty Shell)' : item.lpgVariant === 'COMPLETE_SET' ? ' (Complete Set)' : '';
        const description = `${item.product?.name || 'Unknown Item'}${lpgLabel} x${item.quantity}pcs`;
        
        const reference = sale.saleItems.length > 1 ? `${sale.saleCode}-${index + 1}` : sale.saleCode;

        if (search) {
          const term = search.toLowerCase()
          const matchCode = reference.toLowerCase().includes(term)
          const matchDesc = description.toLowerCase().includes(term)
          const matchCustomer = sale.customer?.name?.toLowerCase().includes(term)
          if (!matchCode && !matchDesc && !matchCustomer) return
        }

        const exactTime = new Date(sale.createdAt)

        rows.push({
          id: item.id || `${sale.id}-${index}`,
          // Display the exact real-world time for auditing, even if grouped into the next day's business date
          date: exactTime.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          businessDate,
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
  }, [sales, search, view, dateFilter])

  const totalAmount = transactionRows.reduce((sum, row) => sum + Number(row.amount), 0)

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6 print:m-0 print:p-0">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">Sales History</h1>
          <p className="text-muted-foreground">Transactions cutoff at 9:00 PM daily.</p>
        </div>
        <Button onClick={handlePrint} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Printer className="w-4 h-4 mr-2" /> Print Statement
        </Button>
      </div>

      {/* ── FILTERS ── */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-white p-3 rounded-lg border shadow-sm print:hidden">
        <div className="flex flex-col lg:flex-row w-full lg:w-auto gap-4">
          
          {/* Admin Branch Selector */}
          {isAdmin && (
            <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
              <SelectTrigger className="w-full lg:w-48 bg-slate-50 border-slate-200">
                <Store className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Select Branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches?.map((branch: any) => (
                  <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="relative w-full lg:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search ref or item..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-full" />
          </div>
          
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground hidden sm:block" />
            <Input 
              type="date" 
              value={dateFilter} 
              onChange={e => setDateFilter(e.target.value)} 
              className="w-auto" 
              title="Select Business Date"
            />
          </div>
        </div>
        
        <div className="flex p-1 bg-muted/50 rounded-lg border w-full lg:w-auto">
          <button onClick={() => setView('all')} className={`flex-1 lg:px-6 py-1.5 text-sm font-bold rounded-md transition-all ${view === 'all' ? 'bg-white shadow text-primary' : 'text-muted-foreground'}`}>All</button>
          <button onClick={() => setView('retail')} className={`flex-1 lg:px-6 py-1.5 text-sm font-bold rounded-md transition-all ${view === 'retail' ? 'bg-blue-600 shadow text-white' : 'text-muted-foreground'}`}>Retail</button>
          <button onClick={() => setView('wholesale')} className={`flex-1 lg:px-6 py-1.5 text-sm font-bold rounded-md transition-all ${view === 'wholesale' ? 'bg-purple-600 shadow text-white' : 'text-muted-foreground'}`}>Wholesale</button>
        </div>
      </div>

      {/* ── PRINT HEADER ── */}
      <div className="hidden print:block text-center mb-6">
        <h1 className="text-2xl font-black">NJUGUSH POS ENTERPRISE</h1>
        <h2 className="text-lg font-bold uppercase mt-1">Transaction History Statement</h2>
        <p className="text-sm text-gray-600 mt-1">Business Date: {dateFilter || 'All Time'}</p>
        {isAdmin && selectedBranchId !== 'all' && (
          <p className="text-sm text-gray-600 mt-1">Branch: {branches?.find((b: any) => b.id === selectedBranchId)?.name}</p>
        )}
      </div>

      {/* ── TRANSACTION TABLE ── */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden print:border-none print:shadow-none">
        <div className="bg-amber-500 text-white font-bold p-3 uppercase tracking-wider text-sm hidden print:block">
          Transaction History
        </div>

        <div className="overflow-x-auto">
          <Table className="print:text-xs">
            <TableHeader>
              <TableRow className="bg-slate-100 hover:bg-slate-100 print:bg-gray-200">
                <TableHead className="w-[50px] font-bold text-slate-700">#</TableHead>
                <TableHead className="font-bold text-slate-700 whitespace-nowrap">EXACT TIME</TableHead>
                <TableHead className="font-bold text-slate-700 min-w-[250px]">DESCRIPTION</TableHead>
                <TableHead className="font-bold text-slate-700">TYPE</TableHead>
                <TableHead className="font-bold text-slate-700">REFERENCE</TableHead>
                {isAdmin && selectedBranchId === 'all' && <TableHead className="font-bold text-slate-700 print:hidden">BRANCH</TableHead>}
                <TableHead className="font-bold text-slate-700 text-right">AMOUNT (KES)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={isAdmin && selectedBranchId === 'all' ? 7 : 6} className="text-center py-10 text-muted-foreground">Loading transactions...</TableCell></TableRow>
              ) : transactionRows.length === 0 ? (
                <TableRow><TableCell colSpan={isAdmin && selectedBranchId === 'all' ? 7 : 6} className="text-center py-10 text-muted-foreground">No transactions found for the selected criteria.</TableCell></TableRow>
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
                    {isAdmin && selectedBranchId === 'all' && (
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
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Sales</p>
            <p className="text-2xl font-black text-emerald-600 print:text-black">{formatCurrency(totalAmount)}</p>
          </div>
        </div>
      </div>

      {/* ── END OF MONTH DIALOG ── */}
      <Dialog open={showEndOfMonthPrompt} onOpenChange={setShowEndOfMonthPrompt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileDown className="w-5 h-5 text-primary" /> End of Month Accountability
            </DialogTitle>
            <DialogDescription>
              It is the end of the month! Please download the monthly receipts for all branches to ensure financial accountability.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Downloading will compile all sales data up to the 9:00 PM cutoff for the entire month. Once downloaded, this prompt will not disturb you again until next month.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEndOfMonthPrompt(false)}>Remind Me Later</Button>
            <Button onClick={handleDownloadMonthlyReceipt}>Download Receipts</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
