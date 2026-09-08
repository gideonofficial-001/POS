import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { transfersApi, branchesApi, inventoryApi } from '@/api'
import { useAuthStore } from '@/store'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import { ArrowLeftRight, CheckCircle2, XCircle, Package, Search, Plus, Minus, Trash2, Flame, ArrowRight, ArrowDownLeft, ArrowUpRight, Loader2 } from 'lucide-react'

const VARIANT_SEPARATOR = '~~'

export default function TransfersPage() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  
  const [activeTab, setActiveTab] = useState('incoming')
  const [showNewTransfer, setShowNewTransfer] = useState(false)
  const [rejectionTarget, setRejectionTarget] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  // Queries
  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ['transfers', user?.branchId],
    queryFn: async () => {
      const res = await transfersApi.getAll()
      return res.data
    }
  })

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await branchesApi.getAll()
      return res.data.filter((b: any) => b.id !== user?.branchId && b.isActive)
    }
  })

  // Mutations
  const approveMutation = useMutation({
    mutationFn: (id: string) => transfersApi.approve(id),
    onSuccess: () => {
      toast.success('Transfer approved successfully')
      queryClient.invalidateQueries({ queryKey: ['transfers'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to approve transfer')
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string, reason: string }) => transfersApi.reject(id, reason),
    onSuccess: () => {
      toast.success('Transfer rejected')
      setRejectionTarget(null)
      setRejectionReason('')
      queryClient.invalidateQueries({ queryKey: ['transfers'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to reject transfer')
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => transfersApi.cancel(id),
    onSuccess: () => {
      toast.success('Transfer cancelled')
      queryClient.invalidateQueries({ queryKey: ['transfers'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to cancel transfer')
  })

  // Data Filtering
  const incoming = transfers.filter((t: any) => t.toBranchId === user?.branchId && t.status === 'PENDING')
  const outgoing = transfers.filter((t: any) => t.fromBranchId === user?.branchId && t.status === 'PENDING')
  const history = transfers.filter((t: any) => t.status !== 'PENDING')

  // 🚀 The Magic Function: Translates backend LPG logic to frontend labels
  const getVariantLabel = (item: any) => {
    const isLpg = item.product?.isLpg || item.product?.isCylinderTracked
    if (isLpg) {
      if (item.lpgComponent === 'REFILL') return <span className="text-blue-600 font-semibold text-xs ml-1">(Gas Refill)</span>
      if (item.lpgComponent === 'CYLINDER') return <span className="text-purple-600 font-semibold text-xs ml-1">(Complete Set)</span>
      if (!item.lpgComponent) return <span className="text-amber-600 font-semibold text-xs ml-1">(Empty Shell)</span>
    }
    return null
  }

  // ─── Render: NEW TRANSFER CART VIEW ───────────────────────────────────────
  if (showNewTransfer) {
    return <NewTransferCart 
      branches={branches} 
      onClose={() => setShowNewTransfer(false)} 
      userBranchId={user?.branchId} 
    />
  }

  // ─── Render: MAIN LIST VIEW ───────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowLeftRight className="w-6 h-6" /> Transfers
          </h1>
          <p className="text-muted-foreground">Manage stock transfers between branches</p>
        </div>
        <Button onClick={() => setShowNewTransfer(true)} className="bg-blue-600 hover:bg-blue-700">
          <ArrowLeftRight className="w-4 h-4 mr-2" /> New Transfer
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="incoming" className="flex items-center gap-2">
            <ArrowDownLeft className="w-4 h-4" /> Incoming
            {incoming.length > 0 && <Badge variant="destructive" className="ml-1">{incoming.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="outgoing" className="flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4" /> Outgoing
            {outgoing.length > 0 && <Badge variant="secondary" className="ml-1">{outgoing.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Loading transfers...</div>
        ) : (
          <>
            {/* INCOMING TABS */}
            <TabsContent value="incoming" className="space-y-4">
              {incoming.length === 0 ? (
                <EmptyState message="No pending incoming transfers" />
              ) : (
                incoming.map((t: any) => (
                  <TransferCard 
                    key={t.id} transfer={t} type="INCOMING" 
                    getVariantLabel={getVariantLabel}
                    onApprove={() => approveMutation.mutate(t.id)}
                    onReject={() => setRejectionTarget(t.id)}
                    isProcessing={approveMutation.isPending}
                  />
                ))
              )}
            </TabsContent>

            {/* OUTGOING TABS */}
            <TabsContent value="outgoing" className="space-y-4">
              {outgoing.length === 0 ? (
                <EmptyState message="No pending outgoing transfers" />
              ) : (
                outgoing.map((t: any) => (
                  <TransferCard 
                    key={t.id} transfer={t} type="OUTGOING" 
                    getVariantLabel={getVariantLabel}
                    onCancel={() => {
                      if(window.confirm('Cancel this transfer request?')) cancelMutation.mutate(t.id)
                    }}
                    isProcessing={cancelMutation.isPending}
                  />
                ))
              )}
            </TabsContent>

            {/* HISTORY TABS */}
            <TabsContent value="history" className="space-y-4">
              {history.length === 0 ? (
                <EmptyState message="No transfer history found" />
              ) : (
                history.map((t: any) => (
                  <TransferCard key={t.id} transfer={t} type="HISTORY" getVariantLabel={getVariantLabel} />
                ))
              )}
            </TabsContent>
          </>
        )}
      </Tabs>

      {/* Reject Modal */}
      <Dialog open={!!rejectionTarget} onOpenChange={(o) => !o && setRejectionTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Transfer</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Label>Reason for rejection *</Label>
            <Input value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="e.g. Stock not needed..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectionTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={!rejectionReason.trim() || rejectMutation.isPending} onClick={() => rejectionTarget && rejectMutation.mutate({ id: rejectionTarget, reason: rejectionReason })}>
              {rejectMutation.isPending ? 'Rejecting...' : 'Reject Transfer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── HELPER COMPONENTS ────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 text-muted-foreground border rounded-xl bg-white shadow-sm">
      <Package className="w-10 h-10 mx-auto mb-3 opacity-20" />
      <p>{message}</p>
    </div>
  )
}

function TransferCard({ transfer, type, getVariantLabel, onApprove, onReject, onCancel, isProcessing }: any) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-4 border-b pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={transfer.status === 'COMPLETED' ? 'success' : transfer.status === 'REJECTED' ? 'destructive' : transfer.status === 'CANCELLED' ? 'secondary' : 'warning'}>
                {transfer.status}
              </Badge>
              <span className="font-bold">{transfer.fromBranch?.name} <ArrowRight className="inline w-3 h-3 text-muted-foreground mx-1"/> {transfer.toBranch?.name}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {transfer.requestedBy?.firstName} {transfer.requestedBy?.lastName} · {formatDateTime(transfer.createdAt)}
            </p>
          </div>
          
          {type === 'INCOMING' && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={onReject} disabled={isProcessing}>Reject</Button>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={onApprove} disabled={isProcessing}>Accept All</Button>
            </div>
          )}
          {type === 'OUTGOING' && (
            <Button size="sm" variant="outline" className="text-red-600 border-red-200" onClick={onCancel} disabled={isProcessing}>Cancel Transfer</Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {transfer.items.map((item: any) => (
            <div key={item.id} className="flex items-center justify-between p-2 bg-slate-50 border rounded-md text-sm">
              <div className="font-medium">
                {item.product.name} {getVariantLabel(item)}
              </div>
              <Badge variant="outline" className="font-bold">x {item.quantity}</Badge>
            </div>
          ))}
        </div>
        {transfer.notes && (
          <p className="text-sm mt-4 text-muted-foreground italic border-l-2 pl-3">" {transfer.notes} "</p>
        )}
      </CardContent>
    </Card>
  )
}

// ─── NEW TRANSFER CART UI ──────────────────────────────────────────────────

function NewTransferCart({ branches, onClose, userBranchId }: { branches: any[], onClose: () => void, userBranchId?: string }) {
  const queryClient = useQueryClient()
  const [toBranchId, setToBranchId] = useState('')
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<any[]>([])
  
  const [lpgModalOpen, setLpgModalOpen] = useState(false)
  const [selectedInvItem, setSelectedInvItem] = useState<any>(null)

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory', userBranchId],
    queryFn: async () => {
      if (!userBranchId) return []
      const res = await inventoryApi.getAll({ branchId: userBranchId })
      return res.data
    },
    enabled: !!userBranchId
  })

  const submitMutation = useMutation({
    mutationFn: (data: any) => transfersApi.create(data),
    onSuccess: () => {
      toast.success('Transfer request sent successfully!')
      queryClient.invalidateQueries({ queryKey: ['transfers'] })
      onClose()
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to submit transfer')
  })

  const filteredInventory = inventory.filter((inv: any) => {
    if (!inv.product?.isActive) return false
    if (!search.trim()) return true
    return inv.product.name.toLowerCase().includes(search.toLowerCase())
  })

  const handleAddItem = (product: any, variant: string, nameExt: string, max: number) => {
    if (max <= 0) return toast.error('Insufficient stock!')
    
    const cartId = `${product.id}${VARIANT_SEPARATOR}${variant}`
    setItems(prev => {
      const existing = prev.find(i => i.cartId === cartId)
      if (existing) {
        if (existing.quantity >= max) { toast.error('Maximum available stock reached'); return prev }
        return prev.map(i => i.cartId === cartId ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, { cartId, productId: product.id, name: `${product.name} ${nameExt}`, variant, quantity: 1, max }]
    })
    setSearch('')
    setLpgModalOpen(false)
  }

  const handleRemove = (cartId: string) => setItems(prev => prev.filter(i => i.cartId !== cartId))
  const handleUpdateQty = (cartId: string, delta: number) => {
    setItems(prev => prev.map(i => {
      if (i.cartId === cartId) {
        const newQ = i.quantity + delta
        if (newQ > 0 && newQ <= i.max) return { ...i, quantity: newQ }
      }
      return i
    }))
  }

  const handleSubmit = () => {
    if (!toBranchId) return toast.error('Select a destination branch')
    if (items.length === 0) return toast.error('Cart is empty')
    
    submitMutation.mutate({
      toBranchId,
      notes,
      items: items.map(i => ({ productId: i.productId, quantity: i.quantity, variant: i.variant }))
    })
  }

  return (
    <div className="flex flex-col lg:h-[calc(100vh-6rem)] space-y-4 pb-10 lg:pb-0">
      <div className="flex items-center gap-4 flex-shrink-0">
        <Button variant="outline" size="icon" onClick={onClose}><ArrowLeftRight className="w-4 h-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold">New Transfer</h1>
          <p className="text-muted-foreground">Select items to send to another branch</p>
        </div>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* LEFT: PRODUCTS LIST */}
        <div className="lg:col-span-2 flex flex-col h-[50vh] lg:h-full bg-muted/10 rounded-xl border overflow-hidden shadow-sm">
          <div className="p-4 bg-white border-b space-y-3 flex-shrink-0">
            <select 
              value={toBranchId} onChange={(e) => setToBranchId(e.target.value)}
              className="w-full p-3 border border-blue-200 bg-blue-50/50 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
            >
              <option value="">-- Select Destination Branch --</option>
              {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            
            <div className="relative">
              <Search className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground" />
              <Input placeholder="Search inventory..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-12 h-12 bg-gray-50/50" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {filteredInventory.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground"><Package className="w-10 h-10 mx-auto opacity-30 mb-2" />No products found</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredInventory.map((inv: any) => {
                  const p = inv.product
                  const isLpg = p.isLpg || p.isCylinderTracked
                  const stock = isLpg ? (inv.fullCylinders || 0) : inv.quantity
                  const outOfStock = stock === 0 && !isLpg // LPG might have empty shells even if gas is 0

                  return (
                    <Card key={p.id} className={`cursor-pointer hover:border-primary bg-white ${outOfStock ? 'opacity-50' : ''}`}
                      onClick={() => {
                        if (isLpg) { setSelectedInvItem(inv); setLpgModalOpen(true) }
                        else if (!outOfStock) handleAddItem(p, 'STANDARD', '', inv.quantity)
                      }}
                    >
                      <CardContent className="p-4 flex flex-col h-full justify-between gap-2">
                        <div className={`p-2 w-fit rounded-lg ${isLpg ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                          {isLpg ? <Flame size={16} /> : <Package size={16} />}
                        </div>
                        <h4 className="font-semibold text-sm leading-tight">{p.name}</h4>
                        <span className="text-xs font-bold text-muted-foreground bg-muted w-fit px-2 py-0.5 rounded-full">
                          {isLpg ? `Gas: ${inv.fullCylinders || 0} | Shells: ${(inv.quantity || 0) - (inv.fullCylinders || 0)}` : `${inv.quantity} in stock`}
                        </span>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: CART */}
        <div className="flex flex-col h-auto lg:h-full">
          <Card className="flex flex-col h-full shadow-md">
            <CardHeader className="pb-3 border-b"><CardTitle>Transfer List ({items.length})</CardTitle></CardHeader>
            <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
              
              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {items.length === 0 ? (
                  <div className="text-center text-muted-foreground py-10 opacity-60"><ArrowLeftRight className="w-10 h-10 mx-auto mb-2" />Cart is empty</div>
                ) : items.map(item => (
                  <div key={item.cartId} className="flex items-center gap-2 p-2 bg-slate-50 border rounded-md text-sm">
                    <div className="flex-1 leading-tight font-medium">{item.name}</div>
                    <div className="flex items-center gap-1 bg-white rounded-md border p-0.5">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleUpdateQty(item.cartId, -1)}><Minus className="w-3 h-3" /></Button>
                      <span className="w-5 text-center font-bold">{item.quantity}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleUpdateQty(item.cartId, 1)}><Plus className="w-3 h-3" /></Button>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-red-100" onClick={() => handleRemove(item.cartId)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t space-y-3">
                <Input placeholder="Optional transfer notes..." value={notes} onChange={e => setNotes(e.target.value)} />
                <Button className="w-full h-12 text-lg font-bold" onClick={handleSubmit} disabled={items.length === 0 || !toBranchId || submitMutation.isPending}>
                  {submitMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Transfer'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* LPG SELECTION MODAL - Featuring the Complete Gas Transfer Button */}
      <Dialog open={lpgModalOpen} onOpenChange={setLpgModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Transfer Setup: {selectedInvItem?.product?.name}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-4">
            
            {/* 1. REFILL */}
            <Button variant="outline" className="h-14 justify-between px-4 border-blue-200 hover:bg-blue-50"
              disabled={(selectedInvItem?.fullCylinders || 0) === 0}
              onClick={() => handleAddItem(selectedInvItem.product, 'REFILL', '(Gas Refill Only)', selectedInvItem.fullCylinders)}
            >
              <div className="flex items-center"><Flame className="w-4 h-4 mr-2 text-blue-500"/> Gas Refill Only</div>
              <Badge variant="secondary">{selectedInvItem?.fullCylinders || 0} left</Badge>
            </Button>

            {/* 2. EMPTY SHELL */}
            <Button variant="outline" className="h-14 justify-between px-4 border-amber-200 hover:bg-amber-50"
              disabled={((selectedInvItem?.quantity || 0) - (selectedInvItem?.fullCylinders || 0)) <= 0}
              onClick={() => handleAddItem(selectedInvItem.product, 'EMPTY_SHELL', '(Empty Shell)', (selectedInvItem.quantity - (selectedInvItem.fullCylinders || 0)))}
            >
              <div className="flex items-center"><Package className="w-4 h-4 mr-2 text-amber-600"/> Empty Shell Only</div>
              <Badge variant="secondary">{Math.max(0, (selectedInvItem?.quantity || 0) - (selectedInvItem?.fullCylinders || 0))} left</Badge>
            </Button>

            {/* 3. COMPLETE SET (CYLINDER) */}
            <Button className="h-14 justify-between px-4 bg-purple-600 hover:bg-purple-700"
              disabled={(selectedInvItem?.fullCylinders || 0) === 0}
              onClick={() => handleAddItem(selectedInvItem.product, 'CYLINDER', '(Complete Set: Gas + Shell)', selectedInvItem.fullCylinders)}
            >
              <div className="flex items-center"><Flame className="w-4 h-4 mr-2"/> Complete Set (Gas + Shell)</div>
              <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30">{selectedInvItem?.fullCylinders || 0} sets</Badge>
            </Button>

          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
