import { useState, Fragment } from 'react'
import { useQuery } from '@tanstack/react-query'
import { inventoryApi } from '@/api'
import { useAuthStore, useCartStore } from '@/store'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, ShoppingCart, Trash2, Flame, Package } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

const NewSale = () => {
  const { user } = useAuthStore()
  const { items, addItem, removeItem, getTotal, clearCart } = useCartStore()
  const [search, setSearch] = useState('')

  const { data: inventory } = useQuery({
    queryKey: ['inventory', user?.branchId],
    queryFn: async () => {
      if (!user?.branchId) return []
      const res = await inventoryApi.getAll({ branchId: user?.branchId })
      return res.data
    },
    enabled: !!user?.branchId,
  })

  const filteredInventory = inventory?.filter((inv: any) => 
    inv.product?.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <h1 className="text-2xl font-bold">New Sale (Option 2: Split Cards)</h1>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filteredInventory?.map((inv: any) => {
            const p = inv.product
            const isLpg = p.type?.includes('LPG')
            
            // If it is LPG, render TWO distinct cards side by side
            if (isLpg) {
              return (
                <Fragment key={p.id}>
                  {/* Refill Card */}
                  <Card className="cursor-pointer border-blue-200 hover:border-blue-500 bg-blue-50/30 transition-all" onClick={() => addItem({ ...p, name: `${p.name} (Refill)` }, 1)}>
                    <CardContent className="p-4 flex flex-col h-full justify-between">
                      <div>
                        <Badge variant="outline" className="mb-2 text-xs bg-blue-100 text-blue-700 border-none">
                          <Flame className="w-3 h-3 mr-1"/> REFILL
                        </Badge>
                        <h4 className="font-medium text-sm mb-1 line-clamp-2">{p.name}</h4>
                      </div>
                      <p className="text-lg font-bold text-blue-700">{formatCurrency(p.price)}</p>
                    </CardContent>
                  </Card>
                  
                  {/* Empty Shell Card */}
                  <Card className="cursor-pointer border-amber-200 hover:border-amber-500 bg-amber-50/30 transition-all" onClick={() => addItem({ ...p, id: p.id + '-empty', name: `${p.name} (Empty Shell)`, price: 3500 }, 1)}>
                    <CardContent className="p-4 flex flex-col h-full justify-between">
                      <div>
                        <Badge variant="outline" className="mb-2 text-xs bg-amber-100 text-amber-700 border-none">
                          <Package className="w-3 h-3 mr-1"/> SHELL ONLY
                        </Badge>
                        <h4 className="font-medium text-sm mb-1 line-clamp-2">{p.name}</h4>
                      </div>
                      <p className="text-lg font-bold text-amber-700">KES 3,500</p>
                    </CardContent>
                  </Card>
                </Fragment>
              )
            }

            // Standard Product Card (Accessories/Electronics)
            return (
              <Card key={p.id} className="cursor-pointer hover:border-primary transition-all" onClick={() => addItem(p, 1)}>
                <CardContent className="p-4 flex flex-col h-full justify-between">
                  <div>
                    <Badge variant="secondary" className="mb-2 text-xs">STANDARD</Badge>
                    <h4 className="font-medium text-sm mb-1 line-clamp-2">{p.name}</h4>
                  </div>
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
          <div className="text-xl font-bold pt-2 border-t mt-2">Total: {formatCurrency(getTotal())}</div>
        </CardContent>
        <CardFooter><Button className="w-full" onClick={clearCart}>Clear Cart</Button></CardFooter>
      </Card>
    </div>
  )
}
export default NewSale
