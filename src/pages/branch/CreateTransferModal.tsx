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
      {/* Container max-height 85vh. overflow-hidden prevents page scrolling. gap-0 prevents weird spacing */}
      <DialogContent className="max-w-5xl h-[85vh] p-0 flex flex-col overflow-hidden bg-white gap-0">
        
        {/* MODAL HEADER - Fixed height, won't shrink */}
        <DialogHeader className="px-6 py-4 border-b shrink-0 bg-white">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ArrowLeftRight className="w-5 h-5 text-blue-600" /> New Transfer
          </DialogTitle>
        </DialogHeader>

        {/* MODAL BODY - The grid must have min-h-0 to allow internal scrolling */}
        <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-3 bg-slate-50">
          
          {/* LEFT: PRODUCTS LIST */}
          <div className="lg:col-span-2 flex flex-col min-h-0 border-r bg-white">
            
            {/* Left Header - Search & Select */}
            <div className="p-4 border-b space-y-3 shrink-0 bg-slate-50/80">
              <select 
                value={toBranchId} onChange={(e) => setToBranchId(e.target.value)}
                className="w-full p-3 border border-blue-200 bg-white rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none shadow-sm"
              >
                <option value="">-- Select Destination Branch --</option>
                {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              
              <div className="relative">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground" />
                <Input placeholder="Search inventory..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-12 h-12 bg-white shadow-sm" />
              </div>
            </div>

            {/* Scrollable Product Grid */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
              {filteredInventory.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground"><Package className="w-10 h-10 mx-auto opacity-30 mb-2" />No products found</div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
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
                        <CardContent className="p-4 flex flex-col h-full justify-between gap-2">
                          <div className={`p-2 w-fit rounded-lg ${isLpg ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                            {isLpg ? <Flame size={16} /> : <Package size={16} />}
                          </div>
                          <h4 className="font-semibold text-sm leading-tight">{p.name}</h4>
                          <span className="text-xs font-bold text-muted-foreground bg-slate-100 w-fit px-2 py-0.5 rounded-full">
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
          <div className="flex flex-col min-h-0 bg-slate-50">
            
            {/* Cart Title */}
            <div className="px-4 py-5 border-b font-bold text-lg shrink-0 bg-white">
              Transfer Cart ({items.length})
            </div>
            
            {/* Scrollable Cart Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {items.length === 0 ? (
                <div className="text-center text-muted-foreground py-10 opacity-60 flex flex-col items-center">
                  <ArrowLeftRight className="w-10 h-10 mb-2" />
                  <p>Cart is empty</p>
                </div>
              ) : items.map(item => (
                <div key={item.cartId} className="flex items-center gap-2 p-2 bg-white border rounded-md text-sm shadow-sm">
                  <div className="flex-1 leading-tight font-medium text-xs">{item.name}</div>
                  <div className="flex items-center gap-1 bg-slate-50 rounded-md border p-0.5 shrink-0">
                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-white" onClick={() => handleUpdateQty(item.cartId, -1)}><Minus className="w-3 h-3" /></Button>
                    <span className="w-4 text-center font-bold text-xs">{item.quantity}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-white" onClick={() => handleUpdateQty(item.cartId, 1)}><Plus className="w-3 h-3" /></Button>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-red-100 shrink-0" onClick={() => handleRemove(item.cartId)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              ))}
            </div>

            {/* Fixed Footer with Submit Button */}
            <div className="p-4 border-t bg-white shrink-0 space-y-3">
              <Input placeholder="Optional transfer notes..." value={notes} onChange={e => setNotes(e.target.value)} className="bg-slate-50" />
              <Button className="w-full h-12 text-base font-bold bg-blue-600 hover:bg-blue-700 shadow-sm" onClick={handleSubmit} disabled={items.length === 0 || !toBranchId || submitMutation.isPending}>
                {submitMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Submit Transfer'}
              </Button>
            </div>
            
          </div>
        </div>
      </DialogContent>

      {/* LPG SELECTION SUB-MODAL */}
      <Dialog open={lpgModalOpen} onOpenChange={setLpgModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Transfer Setup: {selectedInvItem?.product?.name}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-4">
            <Button variant="outline" className="h-14 justify-between px-4 border-blue-200 hover:bg-blue-50"
              disabled={(selectedInvItem?.fullCylinders || 0) === 0}
              onClick={() => handleAddItem(selectedInvItem.product, 'REFILL', '(Gas Refill)', selectedInvItem.fullCylinders)}
            >
              <div className="flex items-center"><Flame className="w-4 h-4 mr-2 text-blue-500"/> Gas Refill Only</div>
              <Badge variant="secondary">{selectedInvItem?.fullCylinders || 0} left</Badge>
            </Button>
            <Button variant="outline" className="h-14 justify-between px-4 border-amber-200 hover:bg-amber-50"
              disabled={((selectedInvItem?.quantity || 0) - (selectedInvItem?.fullCylinders || 0)) <= 0}
              onClick={() => handleAddItem(selectedInvItem.product, 'EMPTY_SHELL', '(Empty Shell)', (selectedInvItem.quantity - (selectedInvItem.fullCylinders || 0)))}
            >
              <div className="flex items-center"><Package className="w-4 h-4 mr-2 text-amber-600"/> Empty Shell Only</div>
              <Badge variant="secondary">{Math.max(0, (selectedInvItem?.quantity || 0) - (selectedInvItem?.fullCylinders || 0))} left</Badge>
            </Button>
            <Button className="h-14 justify-between px-4 bg-purple-600 hover:bg-purple-700"
              disabled={(selectedInvItem?.fullCylinders || 0) === 0}
              onClick={() => handleAddItem(selectedInvItem.product, 'CYLINDER', '(Complete Set)', selectedInvItem.fullCylinders)}
            >
              <div className="flex items-center"><Flame className="w-4 h-4 mr-2"/> Complete Set (Gas + Shell)</div>
              <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30">{selectedInvItem?.fullCylinders || 0} sets</Badge>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
"w-5 h-5 animate-spin" /> : 'Submit Transfer'}
              </Button>
            </div>
            
          </div>
        </div>
      </DialogContent>

      {/* LPG SELECTION SUB-MODAL */}
      <Dialog open={lpgModalOpen} onOpenChange={setLpgModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Transfer Setup: {selectedInvItem?.product?.name}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-4">
            <Button variant="outline" className="h-14 justify-between px-4 border-blue-200 hover:bg-blue-50"
              disabled={(selectedInvItem?.fullCylinders || 0) === 0}
              onClick={() => handleAddItem(selectedInvItem.product, 'REFILL', '(Gas Refill)', selectedInvItem.fullCylinders)}
            >
              <div className="flex items-center"><Flame className="w-4 h-4 mr-2 text-blue-500"/> Gas Refill Only</div>
              <Badge variant="secondary">{selectedInvItem?.fullCylinders || 0} left</Badge>
            </Button>
            <Button variant="outline" className="h-14 justify-between px-4 border-amber-200 hover:bg-amber-50"
              disabled={((selectedInvItem?.quantity || 0) - (selectedInvItem?.fullCylinders || 0)) <= 0}
              onClick={() => handleAddItem(selectedInvItem.product, 'EMPTY_SHELL', '(Empty Shell)', (selectedInvItem.quantity - (selectedInvItem.fullCylinders || 0)))}
            >
              <div className="flex items-center"><Package className="w-4 h-4 mr-2 text-amber-600"/> Empty Shell Only</div>
              <Badge variant="secondary">{Math.max(0, (selectedInvItem?.quantity || 0) - (selectedInvItem?.fullCylinders || 0))} left</Badge>
            </Button>
            <Button className="h-14 justify-between px-4 bg-purple-600 hover:bg-purple-700"
              disabled={(selectedInvItem?.fullCylinders || 0) === 0}
              onClick={() => handleAddItem(selectedInvItem.product, 'CYLINDER', '(Complete Set)', selectedInvItem.fullCylinders)}
            >
              <div className="flex items-center"><Flame className="w-4 h-4 mr-2"/> Complete Set (Gas + Shell)</div>
              <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30">{selectedInvItem?.fullCylinders || 0} sets</Badge>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
