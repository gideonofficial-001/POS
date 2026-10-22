import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { salesApi, branchesApi } from '@/api'
import { useAuthStore } from '@/store'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/utils'
import { Calendar, Search, Printer, Store, FileDown, Phone, User, ChevronRight, Package, X } from 'lucide-react'
import { toast } from 'sonner'

const getBusinessDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toISOString().split('T')[0]
}

const SalesHistory = () => {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'OVERALL_MANAGER'

  const [search, setSearch] = useState('')
  const [view, setView] = useState('all')
  const todayBusinessDate = getBusinessDate(new Date().toISOString())
  const [dateFilter, setDateFilter] = useState(todayBusinessDate)
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all')
  const [showEndOfMonthPrompt, setShowEndOfMonthPrompt] = useState(false)
  const [selectedClient, setSelectedClient] = useState<any>(null)

  // ── Product filter state ─────────────────────────────────────────────────
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [selectedProductName, setSelectedProductName] = useState<string>('')

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => { const r = await branchesApi.getAll(); return r.data },
    enabled: isAdmin,
  })

  const { data: sales, isLoading } = useQuery({
    queryKey: ['sales', selectedBranchId, isAdmin],
    queryFn: async () => {
      const params: any = {}
      if (!isAdmin) params.branchId = user?.branchId
      else if (selectedBranchId !== 'all') params.branchId = selectedBranchId
      const r = await salesApi.getAll(params)
      return r.data
    },
  })

  useEffect(() => {
    if (!isAdmin) return
    const today = new Date()
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    if (lastDay.getDate() - today.getDate() <= 1) {
      const key = `${today.getFullYear()}-${today.getMonth()}`
      if (!localStorage.getItem(`monthly_receipt_downloaded_${key}`)) setShowEndOfMonthPrompt(true)
    }
  }, [isAdmin])

  // ── Unique products extracted from all loaded sales (no extra API call) ──
  const availableProducts = useMemo(() => {
    if (!sales) return []
    const productMap = new Map<string, string>()
    sales.forEach((sale: any) => {
      sale.saleItems?.forEach((item: any) => {
        if (item.product && !productMap.has(item.productId)) {
          productMap.set(item.productId, item.product.name)
        }
      })
    })
    return Array.from(productMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [sales])

  const clearProductFilter = () => {
    setSelectedProductId('')
    setSelectedProductName('')
  }

  const handleViewChange = (newView: string) => {
    // Product filter doesn't apply to wholesale client view — clear it
    if (newView === 'wholesale') clearProductFilter()
    setView(newView)
  }

  // ── ALL / RETAIL rows ────────────────────────────────────────────────────
  const transactionRows = useMemo(() => {
    if (!sales || view === 'wholesale') return []
    const rows: any[] = []

    sales.forEach((sale: any) => {
      if (sale.type === 'INVOICE') return
      if (view === 'retail' && sale.type !== 'CASH') return

      const businessDate = getBusinessDate(sale.createdAt)

      if (selectedProductId) {
        // ── Product filter mode: ignore date, only show matching product ──
        const matchingItems = sale.saleItems?.filter((item: any) => item.productId === selectedProductId)
        if (!matchingItems?.length) return

        matchingItems.forEach((item: any) => {
          const lpgLabel = item.lpgVariant === 'REFILL' ? ' (Refill)' : item.lpgVariant === 'EMPTY_SHELL' ? ' (Empty Shell)' : item.lpgVariant === 'COMPLETE_SET' ? ' (Complete Set)' : ''
          const description = `${item.product?.name || 'Unknown Item'}${lpgLabel} x${item.quantity}pcs`
          if (search) {
            const term = search.toLowerCase()
            if (!sale.saleCode.toLowerCase().includes(term) && !description.toLowerCase().includes(term) && !sale.customer?.name?.toLowerCase().includes(term)) return
          }
          rows.push({
            id: item.id,
            date: new Date(sale.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
            businessDate,
            description,
            type: sale.type === 'CASH' ? 'RETAIL' : sale.type,
            reference: sale.saleCode,
            amount: item.total,
            discount: Number(item.discount || 0),
            customer: sale.customer?.name,
            branchName: sale.branch?.name,
          })
        })
      } else {
        // ── Normal mode: date filter applies ──
        if (dateFilter && businessDate !== dateFilter) return

        sale.saleItems?.forEach((item: any, index: number) => {
          const lpgLabel = item.lpgVariant === 'REFILL' ? ' (Refill)' : item.lpgVariant === 'EMPTY_SHELL' ? ' (Empty Shell)' : item.lpgVariant === 'COMPLETE_SET' ? ' (Complete Set)' : ''
          const description = `${item.product?.name || 'Unknown Item'}${lpgLabel} x${item.quantity}pcs`
          const reference = sale.saleItems.length > 1 ? `${sale.saleCode}-${index + 1}` : sale.saleCode
          if (search) {
            const term = search.toLowerCase()
            if (!reference.toLowerCase().includes(term) && !description.toLowerCase().includes(term) && !sale.customer?.name?.toLowerCase().includes(term)) return
          }
          rows.push({
            id: item.id || `${sale.id}-${index}`,
            date: new Date(sale.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
            businessDate,
            description,
            type: sale.type === 'CASH' ? 'RETAIL' : sale.type,
            reference,
            amount: item.total,
            discount: Number(item.discount || 0),
            customer: sale.customer?.name,
            branchName: sale.branch?.name,
          })
        })
      }
    })
    return rows
  }, [sales, search, view, dateFilter, selectedProductId])

  // ── WHOLESALE: grouped by client ─────────────────────────────────────────
  const wholesaleClients = useMemo(() => {
    if (!sales || view !== 'wholesale') return []
    const clientMap = new Map<string, any>()
    sales.forEach((sale: any) => {
      if (sale.type !== 'WHOLESALE') return
      const businessDate = getBusinessDate(sale.createdAt)
      if (dateFilter && businessDate !== dateFilter) return
      const clientKey = sale.customerId || `anon-${sale.id}`
      if (!clientMap.has(clientKey)) {
        clientMap.set(clientKey, {
          clientKey,
          customerId: sale.customerId,
          customerName: sale.customer?.name || 'Walk-in Customer',
          customerPhone: sale.customer?.phone || '',
          branchName: sale.branch?.name || '',
          sales: [],
          itemCount: 0,
          subtotal: 0,
          totalDiscount: 0,
          total: 0,
        })
      }
      const client = clientMap.get(clientKey)
      client.sales.push(sale)
      sale.saleItems?.forEach((item: any) => {
        client.itemCount += item.quantity
        client.subtotal += Number(item.unitPrice) * Number(item.quantity)
        client.totalDiscount += Number(item.discount || 0)
        client.total += Number(item.total)
      })
    })
    const result = Array.from(clientMap.values())
    if (search.trim()) {
      return result.filter(c => c.customerName.toLowerCase().includes(search.toLowerCase()) || c.customerPhone.includes(search))
    }
    return result
  }, [sales, view, dateFilter, search])

  // ── Totals for footer ─────────────────────────────────────────────────────
  const totalAmount   = transactionRows.reduce((sum, row) => sum + Number(row.amount), 0)
  const totalDiscount = transactionRows.reduce((sum, row) => sum + row.discount, 0)
  const totalQty      = useMemo(() => {
    if (!selectedProductId) return null
    return transactionRows.reduce((sum, row) => {
      const match = row.description.match(/x(\d+)pcs/)
      return sum + (match ? parseInt(match[1]) : 0)
    }, 0)
  }, [transactionRows, selectedProductId])

  const handlePrint = () => window.print()

  const handlePrintClientReceipt = (client: any) => {
    const win = window.open('', '_blank', 'width=400,height=600')
    if (!win) return
    const date = dateFilter ? new Date(dateFilter).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : 'All dates'
    const rows = client.sales.flatMap((sale: any) =>
      sale.saleItems.map((item: any) => {
        const lpgLabel = item.lpgVariant === 'REFILL' ? ' (Refill)' : item.lpgVariant === 'EMPTY_SHELL' ? ' (Empty Shell)' : item.lpgVariant === 'COMPLETE_SET' ? ' (Complete Set)' : ''
        const disc = Number(item.discount || 0)
        return `<tr>
          <td style="padding:6px 4px;border-bottom:1px solid #eee">${item.product?.name}${lpgLabel}</td>
          <td style="text-align:center;padding:6px 4px;border-bottom:1px solid #eee">${item.quantity}</td>
          <td style="text-align:right;padding:6px 4px;border-bottom:1px solid #eee">KES ${Number(item.unitPrice).toLocaleString()}</td>
          ${disc > 0 ? `<td style="text-align:right;padding:6px 4px;border-bottom:1px solid #eee;color:#16a34a">-KES ${disc.toLocaleString()}</td>` : '<td style="border-bottom:1px solid #eee"></td>'}
          <td style="text-align:right;padding:6px 4px;border-bottom:1px solid #eee;font-weight:bold">KES ${Number(item.total).toLocaleString()}</td>
        </tr>`
      })
    ).join('')
    win.document.write(`<!DOCTYPE html><html><head><title>Wholesale Receipt — ${client.customerName}</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;max-width:420px;margin:auto;font-size:13px}h2{text-align:center;margin:0 0 4px}p{margin:2px 0;text-align:center;color:#555}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#0f172a;color:white;padding:8px 4px;text-align:left;font-size:12px}th:not(:first-child){text-align:right}.total-row td{font-weight:bold;font-size:14px;padding-top:10px}.disc-row td{color:#16a34a}.footer{text-align:center;margin-top:24px;font-size:11px;color:#999;border-top:1px dashed #ccc;padding-top:12px}@media print{body{padding:8px}}</style>
    </head><body>
    <h2>NJUGUSH ENTERPRISES</h2><p>Wholesale Receipt</p>
    <p style="margin-top:12px"><strong>${client.customerName}</strong></p>
    ${client.customerPhone ? `<p>${client.customerPhone}</p>` : ''}
    ${client.branchName ? `<p>Branch: ${client.branchName}</p>` : ''}
    <p>Date: ${date}</p>
    <table>
      <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit</th><th style="text-align:right">Disc</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <table style="margin-top:8px">
      ${client.totalDiscount > 0 ? `<tr class="disc-row"><td colspan="4">Total Discount</td><td style="text-align:right;font-weight:bold">- KES ${client.totalDiscount.toLocaleString()}</td></tr>` : ''}
      <tr class="total-row"><td colspan="4">TOTAL DUE</td><td style="text-align:right">KES ${client.total.toLocaleString()}</td></tr>
    </table>
    <div class="footer">Thank you for your business!<br/>Printed ${new Date().toLocaleString('en-GB')}</div>
    <script>window.onload=()=>{ window.print(); window.onafterprint=()=>window.close() }</script>
    </body></html>`)
    win.document.close()
  }

  const productFilterActive = !!selectedProductId

  return (
    <div className="space-y-4 print:m-0 print:p-0">

      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">Sales History</h1>
          <p className="text-muted-foreground">
            {productFilterActive
              ? `Showing all sales of "${selectedProductName}" across all dates`
              : 'Daily transactions grouped by calendar date.'}
          </p>
        </div>
        {view !== 'wholesale' && (
          <Button onClick={handlePrint} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Printer className="w-4 h-4 mr-2" /> Print Statement
          </Button>
        )}
      </div>

      {/* ── FILTERS ── */}
      <div className="flex flex-col gap-3 bg-card p-3 rounded-lg border shadow-sm print:hidden">
        <div className="flex flex-col lg:flex-row gap-3 justify-between items-start lg:items-center">
          <div className="flex flex-col lg:flex-row w-full lg:w-auto gap-3">

            {/* Branch selector — admin only */}
            {isAdmin && (
              <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                <SelectTrigger className="w-full lg:w-44 border">
                  <Store className="w-4 h-4 mr-2 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Select Branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches?.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            {/* Product filter */}
            <Select
              value={selectedProductId || 'all'}
              onValueChange={(val) => {
                if (val === 'all') {
                  clearProductFilter()
                } else {
                  const product = availableProducts.find(p => p.id === val)
                  setSelectedProductId(val)
                  setSelectedProductName(product?.name || '')
                }
              }}
            >
              <SelectTrigger className={`w-full lg:w-52 border ${productFilterActive ? 'border-blue-400 bg-blue-50/30 text-blue-700' : ''}`}>
                <Package className={`w-4 h-4 mr-2 shrink-0 ${productFilterActive ? 'text-blue-500' : 'text-muted-foreground'}`} />
                <SelectValue placeholder="All products" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All products</SelectItem>
                {availableProducts.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Search */}
            <div className="relative w-full lg:w-56">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={view === 'wholesale' ? 'Search client...' : 'Search ref or item...'}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 w-full"
              />
            </div>

            {/* Date — disabled when product filter is active */}
            <div className={`flex items-center gap-2 transition-opacity ${productFilterActive ? 'opacity-30 pointer-events-none' : ''}`}>
              <Calendar className="w-4 h-4 text-muted-foreground hidden sm:block shrink-0" />
              <Input
                type="date"
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                className="w-auto"
                disabled={productFilterActive}
              />
            </div>
          </div>

          {/* View tabs */}
          <div className="flex p-1 bg-muted/50 rounded-lg border w-full lg:w-auto shrink-0">
            <button onClick={() => handleViewChange('all')} className={`flex-1 lg:px-5 py-1.5 text-sm font-bold rounded-md transition-all ${view === 'all' ? 'bg-card shadow text-primary' : 'text-muted-foreground'}`}>All</button>
            <button onClick={() => handleViewChange('retail')} className={`flex-1 lg:px-5 py-1.5 text-sm font-bold rounded-md transition-all ${view === 'retail' ? 'bg-blue-600 shadow text-white' : 'text-muted-foreground'}`}>Retail</button>
            <button onClick={() => handleViewChange('wholesale')} className={`flex-1 lg:px-5 py-1.5 text-sm font-bold rounded-md transition-all ${view === 'wholesale' ? 'bg-purple-600 shadow text-white' : 'text-muted-foreground'}`}>Wholesale</button>
          </div>
        </div>

        {/* Product filter active banner */}
        {productFilterActive && (
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-400/30 rounded-lg text-sm">
            <Package className="w-4 h-4 text-blue-500 shrink-0" />
            <span className="text-blue-700 dark:text-blue-300 flex-1">
              Showing <strong>all sales</strong> of <strong>{selectedProductName}</strong> — date filter bypassed
            </span>
            <button
              onClick={clearProductFilter}
              className="ml-auto flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold shrink-0"
            >
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          </div>
        )}
      </div>

      {/* ── WHOLESALE CLIENT VIEW ── */}
      {view === 'wholesale' && (
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading wholesale clients...</div>
          ) : wholesaleClients.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-card border rounded-xl">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No wholesale sales found for {dateFilter ? new Date(dateFilter + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'this period'}.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{wholesaleClients.length} client{wholesaleClients.length !== 1 ? 's' : ''}</p>
              {wholesaleClients.map((client) => (
                <Card key={client.clientKey} className="bg-card border hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedClient(client)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm shrink-0">
                          {client.customerName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold">{client.customerName}</p>
                          {client.customerPhone && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" /> {client.customerPhone}</p>}
                          {isAdmin && client.branchName && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Store className="w-3 h-3" /> {client.branchName}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-black text-lg text-purple-700">{formatCurrency(client.total)}</p>
                          <p className="text-xs text-muted-foreground">{client.itemCount} unit{client.itemCount !== 1 ? 's' : ''}</p>
                          {client.totalDiscount > 0 && <p className="text-xs text-emerald-600">- {formatCurrency(client.totalDiscount)} disc</p>}
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-4 flex justify-between items-center">
                <span className="font-bold text-purple-900 dark:text-purple-200">Day Total</span>
                <span className="text-2xl font-black text-purple-700">{formatCurrency(wholesaleClients.reduce((s, c) => s + c.total, 0))}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── CLIENT DETAIL MODAL ── */}
      <Dialog open={!!selectedClient} onOpenChange={() => setSelectedClient(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><User className="w-5 h-5 text-purple-600" />{selectedClient?.customerName}</DialogTitle>
            <DialogDescription className="flex items-center gap-4">
              {selectedClient?.customerPhone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {selectedClient.customerPhone}</span>}
              {selectedClient?.branchName && <span className="flex items-center gap-1"><Store className="w-3 h-3" /> {selectedClient.branchName}</span>}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-2 min-h-0">
            {selectedClient?.sales?.map((sale: any) => (
              <div key={sale.id} className="border rounded-lg overflow-hidden">
                <div className="bg-muted/30 px-3 py-2 flex justify-between items-center">
                  <span className="text-xs font-mono text-muted-foreground">{sale.saleCode}</span>
                  <span className="text-xs text-muted-foreground">{new Date(sale.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="divide-y">
                  {sale.saleItems?.map((item: any) => {
                    const lpgLabel = item.lpgVariant === 'REFILL' ? ' (Refill)' : item.lpgVariant === 'EMPTY_SHELL' ? ' (Empty Shell)' : item.lpgVariant === 'COMPLETE_SET' ? ' (Complete Set)' : ''
                    const disc = Number(item.discount || 0)
                    return (
                      <div key={item.id} className="px-3 py-2 flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.product?.name}{lpgLabel}</p>
                          <p className="text-xs text-muted-foreground">{item.quantity} × {formatCurrency(item.unitPrice)}{disc > 0 && <span className="text-emerald-600 ml-1">- {formatCurrency(disc)}</span>}</p>
                        </div>
                        <p className="font-bold text-sm shrink-0">{formatCurrency(item.total)}</p>
                      </div>
                    )
                  })}
                </div>
                <div className="px-3 py-2 bg-muted/20 flex justify-between font-bold text-sm border-t">
                  <span>Sale total</span>
                  <span>{formatCurrency(sale.total)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t pt-4 space-y-1.5">
            {selectedClient?.totalDiscount > 0 && (
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Total Discounts</span><span>- {formatCurrency(selectedClient.totalDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-lg">
              <span>Day Total</span>
              <span className="text-purple-700">{formatCurrency(selectedClient?.total)}</span>
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setSelectedClient(null)}>Close</Button>
            <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => handlePrintClientReceipt(selectedClient)}>
              <Printer className="w-4 h-4 mr-2" /> Print Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── ALL / RETAIL TABLE ── */}
      {view !== 'wholesale' && (
        <>
          {/* Print header */}
          <div className="hidden print:block text-center mb-6">
            <h1 className="text-2xl font-black">NJUGUSH POS ENTERPRISE</h1>
            <h2 className="text-lg font-bold uppercase mt-1">
              {productFilterActive ? `Product Sales Report — ${selectedProductName}` : 'Transaction History Statement'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {productFilterActive ? 'All dates' : `Business Date: ${dateFilter || 'All Time'}`}
            </p>
          </div>

          <div className="bg-card border rounded-xl shadow-sm overflow-hidden print:border-none print:shadow-none">
            <div className="overflow-x-auto">
              <Table className="print:text-xs">
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-[50px] font-bold">#</TableHead>
                    <TableHead className="font-bold whitespace-nowrap">TIME</TableHead>
                    <TableHead className="font-bold min-w-[220px]">DESCRIPTION</TableHead>
                    <TableHead className="font-bold">TYPE</TableHead>
                    <TableHead className="font-bold">REFERENCE</TableHead>
                    {isAdmin && selectedBranchId === 'all' && <TableHead className="font-bold print:hidden">BRANCH</TableHead>}
                    <TableHead className="font-bold text-right">AMOUNT (KES)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Loading transactions...</TableCell></TableRow>
                  ) : transactionRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                        {productFilterActive
                          ? `No sales found for "${selectedProductName}".`
                          : 'No transactions found for the selected criteria.'}
                      </TableCell>
                    </TableRow>
                  ) : transactionRows.map((row, idx) => (
                    <TableRow key={row.id} className="hover:bg-muted/20">
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{row.date}</TableCell>
                      <TableCell className="font-medium">
                        {row.description}
                        {row.customer && <span className="block text-xs text-muted-foreground mt-0.5">Client: {row.customer}</span>}
                        {row.discount > 0 && <span className="block text-xs text-emerald-600 mt-0.5">Disc: - {formatCurrency(row.discount)}</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] py-0 ${row.type === 'WHOLESALE' ? 'text-purple-700 border-purple-200 bg-purple-50' : 'text-blue-700 border-blue-200 bg-blue-50'}`}>
                          {row.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{row.reference}</TableCell>
                      {isAdmin && selectedBranchId === 'all' && (
                        <TableCell className="print:hidden">
                          <Badge variant="secondary" className="text-[10px] font-normal py-0">
                            <Store className="w-3 h-3 mr-1" /> {row.branchName}
                          </Badge>
                        </TableCell>
                      )}
                      <TableCell className="text-right font-bold text-primary">{formatCurrency(row.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Footer totals */}
            <div className="bg-muted/30 border-t p-4 flex justify-end items-center gap-8">
              {productFilterActive && totalQty !== null && (
                <div className="text-right">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Units</p>
                  <p className="text-lg font-black text-blue-600">{totalQty} pcs</p>
                </div>
              )}
              {totalDiscount > 0 && (
                <div className="text-right">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Discounts</p>
                  <p className="text-lg font-black text-emerald-600">- {formatCurrency(totalDiscount)}</p>
                </div>
              )}
              <div className="text-right">
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-1">
                  {productFilterActive ? 'Product Revenue' : 'Total Sales'}
                </p>
                <p className="text-2xl font-black text-emerald-600">{formatCurrency(totalAmount)}</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* End of month prompt */}
      <Dialog open={showEndOfMonthPrompt} onOpenChange={setShowEndOfMonthPrompt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileDown className="w-5 h-5 text-primary" /> End of Month Accountability</DialogTitle>
            <DialogDescription>It is the end of the month! Please download the monthly receipts for all branches to ensure financial accountability.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEndOfMonthPrompt(false)}>Remind Me Later</Button>
            <Button onClick={() => {
              const k = `${new Date().getFullYear()}-${new Date().getMonth()}`
              localStorage.setItem(`monthly_receipt_downloaded_${k}`, 'true')
              setShowEndOfMonthPrompt(false)
              toast.success('Monthly receipts downloaded!')
            }}>Download Receipts</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style dangerouslySetInnerHTML={{__html: `@media print { @page { margin:1cm; size:landscape; } body * { visibility:hidden; } .print\\:m-0, .print\\:m-0 * { visibility:visible; } .print\\:m-0 { position:absolute; left:0; top:0; width:100%; } aside, nav, header { display:none!important; } }`}} />
    </div>
  )
}

export default SalesHistory
