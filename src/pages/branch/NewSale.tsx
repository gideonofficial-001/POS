import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { inventoryApi } from '@/api'
import { useAuthStore, useCartStore } from '@/store'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Search, ShoppingCart, Minus, Plus, Trash2, Package, Flame } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

const NewSale = () => {
  const { user } = useAuthStore()
  const { items, addItem, removeItem, updateQuantity, getTotal, clearCart } = useCartStore()
  const [search, setSearch] = useState('')
  
  // Modal States
  const [lpgModalOpen, setLpgModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)

  const { data: inventory } = useQuery({
    queryKey: ['inventory', user?.branchId],
    queryFn: async () => (await inventoryApi.getAll({ branchId: user?.branchId })).data,
    enabled: !!user?.branchId,
  })

  const filteredInventory = inventory?.filter((inv: any) => 
    inv.product?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const handleLpgSelect = (type: 'REFILL' | 'EMPTY' | 'BOTH') => {
    if (!selectedProduct) return;
    
    if (type === 'REFILL') {
      addItem({ ...selectedProduct, name: `${selectedProduct.name} (Refill)` }, 1)
    } else if (type === 'EMPTY') {
      // Mocking the empty price for the UI test
      addItem({ ...selectedProduct, id: selectedProduct.id + '-empty', name: `${selectedProduct.name} (Empty Shell)`, price: 3500 }, 1)
    } else if (type === 'BOTH') {
      addItem({ ...selectedProduct, name: `${selectedProduct.name} (Complete Set)`, price: Number(selectedProduct.price) + 3500 }, 1)
    }
    setLpgModalOpen(false)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <h1 className="text-2xl font-bold">New Sale (Option 1: Modal Flow)</h1>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filteredInventory?.map((inv: any) => {
            const p = inv.product
            const isLpg = p.type.includes('LPG')
            
            return (
              <Card key={p.id} className="cursor-pointer hover:border-primary transition-all" onClick={() => {
                if (isLpg) {
                  setSelectedProduct(p)
                  setLpgModalOpen(true)
                } else {
                  addItem(p, 1)
                }
              }}>
                <CardContent className="p-4">
                  <Badge variant="secondary" className="mb-2 text-xs">{isLpg ? 'LPG' : 'STANDARD'}</Badge>
                  <h4 className="font-medium text-sm mb-1">{p.name}</h4>
                  <p className="text-lg font-bold text-primary">{formatCurrency(p.price)}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Cart (Simplified for test) */}
      <Card className="sticky top-4 h-fit">
        <CardHeader><CardTitle className="flex items-center gap-2"><ShoppingCart className="w-5 h-5"/> Cart</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {items.map(item => (
            <div key={item.productId} className="flex justify-between items-center text-sm border-b pb-2">
              <div className="flex-1 pr-2">
                <p className="font-medium">{item.product.name}</p>
                <p className="text-primary">{formatCurrency(item.unitPrice)} x {item.quantity}</p>
              </div>
              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeItem(item.productId)}><Trash2 className="w-4 h-4"/></Button>
            </div>
          ))}
          <div className="text-xl font-bold pt-2">Total: {formatCurrency(getTotal())}</div>
        </CardContent>
        <CardFooter><Button className="w-full" onClick={clearCart}>Clear Cart</Button></CardFooter>
      </Card>

      {/* The Option 1 Modal */}
      <Dialog open={lpgModalOpen} onOpenChange={setLpgModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Item: {selectedProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <Button variant="outline" className="h-16 justify-start text-left px-4" onClick={() => handleLpgSelect('REFILL')}>
              <Flame className="w-5 h-5 mr-3 text-blue-500" />
              <div><p className="font-bold">Gas Refill Only</p><p className="text-xs text-muted-foreground">Exchange empty for full ({formatCurrency(selectedProduct?.price)})</p></div>
            </Button>
            <Button variant="outline" className="h-16 justify-start text-left px-4" onClick={() => handleLpgSelect('EMPTY')}>
              <Package className="w-5 h-5 mr-3 text-amber-600" />
              <div><p className="font-bold">Empty Cylinder Only</p><p className="text-xs text-muted-foreground">Selling an empty shell (KES 3,500)</p></div>
            </Button>
            <Button className="h-16 justify-start text-left px-4 bg-primary text-primary-foreground" onClick={() => handleLpgSelect('BOTH')}>
              <Flame className="w-5 h-5 mr-3" />
              <div><p className="font-bold">Complete Set</p><p className="text-xs opacity-90">Gas + New Cylinder (KES {Number(selectedProduct?.price) + 3500})</p></div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default NewSale
