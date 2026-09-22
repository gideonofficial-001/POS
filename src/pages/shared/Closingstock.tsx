import { useState, useMemo } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { closingStockApi, branchesApi } from '@/api'
import { useAuthStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ArrowLeft, ArrowRight, Camera, CheckCircle2, ChevronRight, Clock, Printer, Store, XCircle } from 'lucide-react'
import { toast } from 'sonner'

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = (d: Date) =>
  d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

const fmtShort = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

const toISODate = (d: Date) => d.toISOString().split('T')[0]

const buildWeek = (anchorDate: Date): Date[] => {
  const days: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(anchorDate)
    d.setDate(anchorDate.getDate() - i)
    days.push(d)
  }
  return days
}

// ── Component ──────────────────────────────────────────────────────────────
export default function ClosingStock() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'OVERALL_MANAGER'

  // Anchor = most recent day of the visible 7-day window
  const [anchor, setAnchor] = useState<Date>(() => {
    const t = new Date(); t.setHours(0, 0, 0, 0); return t
  })
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    user?.role === 'BRANCH_MANAGER' ? (user.branchId || '') : ''
  )
  const [jumpDate, setJumpDate] = useState('')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const today = useMemo(() => { const t = new Date(); t.setHours(0,0,0,0); return t }, [])
  const week  = useMemo(() => buildWeek(anchor), [anchor])
  const startDate = toISODate(week[6])   // oldest in window
  const endDate   = toISODate(week[0])   // newest in window

  // ── Fetch available branches ───────────────────────────────────────────
  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn:  () => branchesApi.getAll().then(r => r.data),
    enabled:  isAdmin,
  })

  // ── Fetch dates that have snapshots in current window ─────────────────
  const { data: snapshotDates = [], refetch: refetchDates } = useQuery({
    queryKey: ['closing-stock-dates', selectedBranchId, startDate, endDate],
    queryFn:  () => closingStockApi.getDates(selectedBranchId, startDate, endDate).then(r => r.data),
    enabled:  !!selectedBranchId,
  })

  const snapshotMap = useMemo(() => {
    const m = new Map<string, any>()
    snapshotDates.forEach((s: any) => { m.set(toISODate(new Date(s.date)), s) })
    return m
  }, [snapshotDates])

  // ── Fetch snapshot detail ─────────────────────────────────────────────
  const { data: snapshot, isLoading: loadingSnapshot } = useQuery({
    queryKey: ['closing-stock-snapshot', selectedBranchId, selectedDate],
    queryFn:  () => closingStockApi.getSnapshot(selectedBranchId, selectedDate!).then(r => r.data),
    enabled:  !!selectedBranchId && !!selectedDate,
  })

  // ── Record snapshot mutation ──────────────────────────────────────────
  const recordMutation = useMutation({
    mutationFn: (date: string) => closingStockApi.recordSnapshot(selectedBranchId, date),
    onSuccess: (_, date) => {
      toast.success(`Closing stock recorded for ${fmtShort(new Date(date))}`)
      refetchDates()
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to record closing stock'),
  })

  // ── Navigation ────────────────────────────────────────────────────────
  const goBack = () => {
    const d = new Date(anchor); d.setDate(d.getDate() - 7); setAnchor(d)
  }
  const goForward = () => {
    const d = new Date(anchor); d.setDate(d.getDate() + 7)
    if (d <= today) setAnchor(d)
  }
  const handleJump = () => {
    if (!jumpDate) return
    const d = new Date(jumpDate); d.setHours(0,0,0,0)
    if (d > today) { toast.error('Cannot navigate to a future date'); return }
    setAnchor(d)
    setJumpDate('')
  }

  const canGoForward = anchor < today

  // ── Print handler ─────────────────────────────────────────────────────
  const handlePrint = () => {
    if (!snapshot) return
    const win = window.open('', '_blank', 'width=800,height=600')
    if (!win) return

    const categorySections = snapshot.categories.map((cat: any) => {
      const isLpg = cat.name.toUpperCase().includes('LPG')
      const rows = cat.items.map((item: any) => isLpg
        ? `<tr><td>${item.productName}</td><td>${item.productCode}</td><td class="num blue">${item.fullCylinders ?? 0}</td><td class="num amber">${item.emptyCylinders ?? 0}</td></tr>`
        : `<tr><td>${item.productName}</td><td>${item.productCode}</td><td class="num" colspan="2">${item.quantity}</td></tr>`
      ).join('')

      const totalFull  = isLpg ? cat.items.reduce((s: number, i: any) => s + (i.fullCylinders || 0), 0) : null
      const totalEmpty = isLpg ? cat.items.reduce((s: number, i: any) => s + (i.emptyCylinders || 0), 0) : null
      const totalQty   = !isLpg ? cat.items.reduce((s: number, i: any) => s + i.quantity, 0) : null

      return `
        <div class="category">
          <h3>${cat.name}</h3>
          <table>
            <thead><tr><th>Product</th><th>Code</th>${isLpg ? '<th class="blue">Full (Refills)</th><th class="amber">Empty (Shells)</th>' : '<th colspan="2">Quantity</th>'}</tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr class="total"><td colspan="2">TOTAL</td>${isLpg ? `<td class="num blue">${totalFull}</td><td class="num amber">${totalEmpty}</td>` : `<td class="num" colspan="2">${totalQty}</td>`}</tr></tfoot>
          </table>
        </div>`
    }).join('')

    win.document.write(`<!DOCTYPE html><html><head>
      <title>Closing Stock — ${fmtShort(new Date(snapshot.date))}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;max-width:900px;margin:auto;font-size:12px}
        h1{text-align:center;margin:0;font-size:18px;text-transform:uppercase}
        h2{text-align:center;color:#444;font-size:13px;margin:4px 0 0}
        .meta{text-align:center;color:#666;font-size:11px;margin:8px 0 24px}
        .category{margin-bottom:28px}
        .category h3{font-size:14px;font-weight:bold;color:#1e3a5f;border-bottom:2px solid #1e3a5f;padding-bottom:4px;margin-bottom:8px;text-transform:uppercase}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th{background:#0f172a;color:white;padding:6px 8px;text-align:left}
        td{padding:5px 8px;border-bottom:1px solid #eee}
        tr:nth-child(even){background:#f9fafb}
        .num{text-align:center;font-weight:bold}
        .blue{color:#1d4ed8}
        .amber{color:#d97706}
        tfoot .total td{border-top:2px solid #0f172a;font-weight:bold;background:#f1f5f9;padding:6px 8px}
        @media print{@page{margin:1cm;size:portrait}body{padding:0}}
      </style>
    </head><body>
      <h1>NJUGUSH ENTERPRISES</h1>
      <h2>Closing Stock Report — ${snapshot.branchName}</h2>
      <div class="meta">Business Date: <strong>${fmt(new Date(snapshot.date))}</strong> &nbsp;|&nbsp; Recorded: ${new Date(snapshot.recordedAt).toLocaleString('en-GB')} &nbsp;|&nbsp; ${snapshot.totalProducts} products</div>
      ${categorySections}
      <div style="text-align:center;margin-top:24px;font-size:10px;color:#999;border-top:1px dashed #ccc;padding-top:12px">
        Printed ${new Date().toLocaleString('en-GB')}
      </div>
      <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script>
    </body></html>`)
    win.document.close()
  }

  // ── Branch not selected guard ─────────────────────────────────────────
  if (isAdmin && !selectedBranchId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Closing Stock</h1>
          <p className="text-muted-foreground">End-of-day inventory records</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches?.map((b: any) => (
            <Card key={b.id} className="cursor-pointer hover:border-primary transition-colors bg-card"
              onClick={() => setSelectedBranchId(b.id)}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Store className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold">{b.name}</p>
                  <p className="text-xs text-muted-foreground">{b.code}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const activeBranch = branches?.find((b: any) => b.id === selectedBranchId)

  return (
    <div className="space-y-5 pb-10">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button onClick={() => setSelectedBranchId('')} className="p-1 hover:bg-muted rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h1 className="text-2xl font-bold">Closing Stock</h1>
          </div>
          {activeBranch && <p className="text-muted-foreground ml-7">{activeBranch.name}</p>}
        </div>

        {/* Branch switcher for admin */}
        {isAdmin && (
          <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
            <SelectTrigger className="w-44">
              <Store className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {branches?.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* ── Controls: navigation + jump ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between bg-card border rounded-lg p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goBack}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Prev 7 Days
          </Button>
          <Button variant="outline" size="sm" onClick={goForward} disabled={!canGoForward}>
            Next 7 Days <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
          <span className="text-sm text-muted-foreground hidden sm:block">
            {fmtShort(week[6])} — {fmtShort(week[0])}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Input type="date" value={jumpDate} onChange={e => setJumpDate(e.target.value)}
            className="h-9 w-40 text-sm" max={toISODate(today)} />
          <Button size="sm" variant="secondary" onClick={handleJump} disabled={!jumpDate}>
            Jump to Date
          </Button>
        </div>
      </div>

      {/* ── 7-day list ── */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="font-bold">DATE</TableHead>
              <TableHead className="font-bold hidden sm:table-cell">DAY</TableHead>
              <TableHead className="font-bold text-center">STATUS</TableHead>
              <TableHead className="font-bold hidden md:table-cell">PRODUCTS</TableHead>
              <TableHead className="font-bold hidden lg:table-cell">RECORDED AT</TableHead>
              <TableHead className="font-bold text-right">ACTION</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {week.map((day) => {
              const isoDay  = toISODate(day)
              const snap    = snapshotMap.get(isoDay)
              const isToday = isoDay === toISODate(today)

              return (
                <TableRow
                  key={isoDay}
                  className={`transition-colors ${snap ? 'cursor-pointer hover:bg-muted/20' : ''}`}
                  onClick={() => snap && setSelectedDate(isoDay)}
                >
                  <TableCell className="font-semibold">
                    {isToday
                      ? <span className="text-primary font-bold">Today</span>
                      : fmtShort(day)}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden sm:table-cell">
                    {day.toLocaleDateString('en-GB', { weekday: 'long' })}
                  </TableCell>
                  <TableCell className="text-center">
                    {snap
                      ? <Badge className="bg-emerald-100 text-emerald-700 border-none gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Recorded
                        </Badge>
                      : <Badge variant="outline" className="text-muted-foreground gap-1">
                          <XCircle className="w-3 h-3" /> No Record
                        </Badge>}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden md:table-cell">
                    {snap ? `${snap.productCount} products` : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">
                    {snap
                      ? <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(snap.recordedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                      {snap && (
                        <Button variant="ghost" size="sm" className="text-xs"
                          onClick={() => setSelectedDate(isoDay)}>
                          View <ChevronRight className="w-3 h-3 ml-1" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={snap ? 'outline' : 'default'}
                        className="text-xs"
                        disabled={recordMutation.isPending}
                        onClick={() => recordMutation.mutate(isoDay)}
                      >
                        <Camera className="w-3 h-3 mr-1" />
                        {snap ? 'Re-record' : 'Record Now'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* ── Snapshot Detail Modal ── */}
      <Dialog open={!!selectedDate} onOpenChange={(o) => !o && setSelectedDate(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>
                Closing Stock — {selectedDate ? fmtShort(new Date(selectedDate)) : ''}
              </DialogTitle>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white mr-6"
                size="sm"
                onClick={handlePrint}
                disabled={!snapshot}
              >
                <Printer className="w-4 h-4 mr-2" /> Print
              </Button>
            </div>
            {snapshot && (
              <p className="text-sm text-muted-foreground mt-1">
                {snapshot.branchName} &nbsp;·&nbsp; Recorded at {new Date(snapshot.recordedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} &nbsp;·&nbsp; {snapshot.totalProducts} products
              </p>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 py-2 min-h-0">
            {loadingSnapshot ? (
              <div className="text-center py-16 text-muted-foreground">Loading snapshot…</div>
            ) : !snapshot ? (
              <div className="text-center py-16 text-muted-foreground">No data found</div>
            ) : (
              snapshot.categories.map((cat: any) => {
                const isLpg       = cat.name.toUpperCase().includes('LPG')
                const totalFull   = isLpg ? cat.items.reduce((s: number, i: any) => s + (i.fullCylinders || 0), 0) : null
                const totalEmpty  = isLpg ? cat.items.reduce((s: number, i: any) => s + (i.emptyCylinders || 0), 0) : null
                const totalQty    = !isLpg ? cat.items.reduce((s: number, i: any) => s + i.quantity, 0) : null

                return (
                  <div key={cat.id} className="border rounded-xl overflow-hidden">
                    <div className="bg-muted/30 px-4 py-2.5 border-b flex items-center justify-between">
                      <h3 className="font-bold text-primary uppercase tracking-wide text-sm">{cat.name}</h3>
                      <Badge variant="outline">{cat.items.length} items</Badge>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/10 hover:bg-muted/10">
                          <TableHead className="font-bold">Product</TableHead>
                          <TableHead className="font-bold hidden sm:table-cell">Code</TableHead>
                          {isLpg ? (
                            <>
                              <TableHead className="font-bold text-blue-600 text-center">Full (Refills)</TableHead>
                              <TableHead className="font-bold text-amber-600 text-center">Empty (Shells)</TableHead>
                            </>
                          ) : (
                            <TableHead className="font-bold text-center" colSpan={2}>Quantity</TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cat.items.map((item: any) => (
                          <TableRow key={item.productId} className="hover:bg-muted/10">
                            <TableCell className="font-medium">{item.productName}</TableCell>
                            <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">{item.productCode}</TableCell>
                            {isLpg ? (
                              <>
                                <TableCell className="text-center text-lg font-black text-blue-600">{item.fullCylinders ?? 0}</TableCell>
                                <TableCell className="text-center text-lg font-black text-amber-600">{item.emptyCylinders ?? 0}</TableCell>
                              </>
                            ) : (
                              <TableCell className="text-center text-lg font-black text-primary" colSpan={2}>{item.quantity}</TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                      {/* Category totals footer */}
                      <tfoot>
                        <TableRow className="bg-muted/20 border-t-2">
                          <TableCell className="font-black text-xs uppercase tracking-widest text-muted-foreground" colSpan={2}>Total</TableCell>
                          {isLpg ? (
                            <>
                              <TableCell className="text-center font-black text-blue-700">{totalFull}</TableCell>
                              <TableCell className="text-center font-black text-amber-700">{totalEmpty}</TableCell>
                            </>
                          ) : (
                            <TableCell className="text-center font-black text-primary" colSpan={2}>{totalQty}</TableCell>
                          )}
                        </TableRow>
                      </tfoot>
                    </Table>
                  </div>
                )
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
