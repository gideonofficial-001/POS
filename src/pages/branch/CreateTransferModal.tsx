import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { transfersApi, branchesApi, inventoryApi } from '@/api'
import { useAuthStore } from '@/store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { ArrowLeftRight, Package, Search, Plus, Minus, Trash2, Flame, Loader2 } from 'lucide-react'

const VARIANT_SEPARATOR = '~~'

export function CreateTransferModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const { user } = useAuthStore()
  const userBranchId = user?.branchId
  
  const [toBranchId, setToBranchId] = useState('')
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<any[]>([])
  
  const [lpgModalOpen, setLpgModalOpen] = useState(false)
  const [selectedInvItem, setSelectedInvItem] = useState<any>(null)

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await branchesApi.getAll()
      return res.data.filter((b: any) => b.id !== userBranchId && b.isActive)
    }
  })

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
      onSuccess()
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
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      {/* Container is explicitly locked to 95vh on mobile, 85vh on PC */}
      <DialogContent className="max-w-5xl h-[95vh] lg:h-[85vh] p-0 flex flex-col overflow-hidden bg-white gap-0">
        
        <DialogHeader className="px-4 lg:px-6 py-3 lg:py-4 border-b shrink-0 bg-white">
          <DialogTitle className="flex items-center gap-2 text-lg lg:text-xl">
            <ArrowLeftRight className="w-5 h-5 text-blue-600" /> New Transfer
          </DialogTitle>
        </DialogHeader>

        {/* The split screen wrapper */}
        <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-3 bg-slate-50">
          
          {/* LEFT: PRODUCTS LIST (Takes remaining height on mobile) */}
          <div className="flex-1 lg:col-span-2 flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r bg-white">
            <div className="p-3 lg:p-4 border-b space-y-2 lg:space-y-3 shrink-0 bg-slate-50/80">
              <select 
                value={toBranchId} onChange={(e) => setToBranchId(e.target.value)}
                className="w-full p-2.5 lg:p-3 border border-blue-200 bg-white rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none shadow-sm"
              >
                <option value="">-- Select Destination Branch --</option>
                {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <div className="relative">
                <Search className="absolute left-3.5 top-3 lg:top-3.5 h-4 w-4 lg:h-5 lg:w-5 text-muted-foreground" />
                <Input placeholder="Search inventory..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 lg:pl-12 h-10 lg:h-12 bg-white shadow-sm" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 lg:p-4 bg-slate-50/50">
              {filteredInventory.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground"><Package className="w-10 h-10 mx-auto opacity-30 mb-2" />No products found</div>
              ) : (
                <div className="grid grid-cols-2 gap-2 lg:gap-3">
                  {filteredInventory.map((inv: any) => {
                    const p = inv.product
                    const isLpg = p.isLpg || p.isCylinderTracked
                    const stock = isLpg ? (inv.fullCylinders || 0) : inv.quantity
                    const outOfStock = stock === 0 && !isLpg

                    return (
                      <Card key={p.id} className={`cursor-pointer hover:border-blue-400 bg-white shadow-sm transition-colors ${outOfStock ? 'opacity-50' : ''}`}
                        onClick={() => {
                          if (isLpg) { setSelectedInvItem(inv); setLpgModalOpen(true) }
                          else if (!outOfStock) handleAddItem(p, 'STANDARD', '', inv.quantity)
                        }}
                      >
                        <CardContent className="p-3 lg:p-4 flex flex-col h-full justify-between gap-2">
                          <div className={`p-1.5 lg:p-2 w-fit rounded-lg ${isLpg ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                            {isLpg ? <Flame size={14} /> : <Package size={14} />}
                          </div>
                          <h4 className="font-semibold text-xs lg:text-sm leading-tight">{p.name}</h4>
                          <span className="text-[10px] lg:text-xs font-bold text-muted-foreground bg-slate-100 w-fit px-2 py-0.5 rounded-full">
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

          {/* RIGHT: CART (Locks to 40% height on mobile, full height on PC) */}
          <div className="h-[40%] lg:h-auto lg:flex-1 flex flex-col min-h-0 bg-slate-50">
            <div className="px-3 lg:px-4 py-3 lg:py-5 border-b font-bold text-sm lg:text-lg shrink-0 bg-white">
              Transfer Cart ({items.length})
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 lg:p-4 space-y-2">
              {items.length === 0 ? (
                <div className="text-center text-muted-foreground py-6 lg:py-10 opacity-60 flex flex-col items-center">
                  <ArrowLeftRight className="w-8 h-8 lg:w-10 lg:h-10 mb-2" />
                  <p className="text-sm">Cart is empty</p>
                </div>
              ) : items.map(item => (
                <div key={item.cartId} className="flex items-center gap-2 p-2 bg-white border rounded-md text-sm shadow-sm">
                  <div className="flex-1 leading-tight font-medium text-[11px] lg:text-xs">{item.name}</div>
                  <div className="flex items-center gap-1 bg-slate-50 rounded-md border p-0.5 shrink-0">
                    <Button variant="ghost" size="icon" className="h-5 w-5 lg:h-6 lg:w-6 hover:bg-white" onClick={() => handleUpdateQty(item.cartId, -1)}><Minus className="w-3 h-3" /></Button>
                    <span className="w-4 text-center font-bold text-[11px] lg:text-xs">{item.quantity}</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5 lg:h-6 lg:w-6 hover:bg-white" onClick={() => handleUpdateQty(item.cartId, 1)}><Plus className="w-3 h-3" /></Button>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 lg:h-7 lg:w-7 text-destructive hover:bg-red-100 shrink-0" onClick={() => handleRemove(item.cartId)}><Trash2 className="w-3 h-3 lg:w-4 lg:h-4" /></Button>
                </div>
              ))}
            </div>

            <div className="p-3 lg:p-4 border-t bg-white shrink-0 space-y-2 lg:space-y-3">
              <Input placeholder="Optional notes..." value={notes} onChange={e => setNotes(e.target.value)} className="bg-slate-50 h-9 lg:h-10 text-sm" />
              <Button className="w-full h-10 lg:h-12 text-sm lg:text-base font-bold bg-blue-600 hover:bg-blue-700 shadow-sm" onClick={handleSubmit} disabled={items.length === 0 || !toBranchId || submitMutation.isPending}>
                {submitMutation.isPending ? <Loader2 className="w-4 h-4 lg:w-5 lg:h-5 animate-spin" /> : 'Submit Transfer'}
              </Button>
            </div>
            
          </div>
        </div>
      </DialogContent>

      <Dialog open={lpgModalOpen} onOpenChange={setLpgModalOpen}>
        <DialogContent className="max-w-[90vw] lg:max-w-md rounded-xl">
          <DialogHeader><DialogTitle className="text-lg">Transfer Setup: {selectedInvItem?.product?.name}</DialogTitle></DialogHeader>
          <div className="grid gap-2 lg:gap-3 py-2">
            <Button variant="outline" className="h-12 lg:h-14 justify-between px-3 lg:px-4 border-blue-200 hover:bg-blue-50"
              disabled={(selectedInvItem?.fullCylinders || 0) === 0}
              onClick={() => handleAddItem(selectedInvItem.product, 'REFILL', '(Gas Refill)', selectedInvItem.fullCylinders)}
            >
              <div className="flex items-center text-sm lg:text-base"><Flame className="w-4 h-4 mr-2 text-blue-500"/> Gas Refill Only</div>
              <Badge variant="secondary">{selectedInvItem?.fullCylinders || 0} left</Badge>
            </Button>
            <Button variant="outline" className="h-12 lg:h-14 justify-between px-3 lg:px-4 border-amber-200 hover:bg-amber-50"
              disabled={((selectedInvItem?.quantity || 0) - (selectedInvItem?.fullCylinders || 0)) <= 0}
              onClick={() => handleAddItem(selectedInvItem.product, 'EMPTY_SHELL', '(Empty Shell)', (selectedInvItem.quantity - (selectedInvItem.fullCylinders || 0)))}
            >
              <div className="flex items-center text-sm lg:text-base"><Package className="w-4 h-4 mr-2 text-amber-600"/> Empty Shell Only</div>
              <Badge variant="secondary">{Math.max(0, (selectedInvItem?.quantity || 0) - (selectedInvItem?.fullCylinders || 0))} left</Badge>
            </Button>
            <Button className="h-12 lg:h-14 justify-between px-3 lg:px-4 bg-purple-600 hover:bg-purple-700"
              disabled={(selectedInvItem?.fullCylinders || 0) === 0}
              onClick={() => handleAddItem(selectedInvItem.product, 'CYLINDER', '(Complete Set)', selectedInvItem.fullCylinders)}
            >
              <div className="flex items-center text-sm lg:text-base"><Flame className="w-4 h-4 mr-2"/> Complete Set</div>
              <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30">{selectedInvItem?.fullCylinders || 0} sets</Badge>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
