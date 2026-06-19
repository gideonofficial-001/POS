import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productsApi, inventoryApi, salesApi, customersApi } from '@/api'
import { useAuthStore, useCartStore } from '@/store'
import { SaleType } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import {
  ShoppingCart, Minus, Plus, Trash2, Search, Package, Flame, Zap, Tag
} from 'lucide-react'

const NewSale = () => {
  const { user } = useAuthStore()
  const { items, addItem, removeItem, updateQuantity, clearCart, getSubtotal, getTotal, customerName, customerPhone, setCustomerInfo, discount, setDiscount } = useCartStore()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [saleType, setSaleType] = useState<SaleType>(SaleType.CASH)
  const [activeCategory, setActiveCategory] = useState('all')

  const branchId = user?.branchId || ''

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const response = await productsApi.getAll({ isActive: true })
      return response.data
    },
  })

  const { data: inventory } = useQuery({
    queryKey: ['inventory', branchId],
    queryFn: async () => {
      if (!branchId) return []
      const response = await inventoryApi.getAll({ branchId })
      return response.data
    },
    enabled: !!branchId,
  })

  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const response = await customersApi.getAll({ isInvoiceEligible: true })
      return response.data
    },
    enabled: saleType === SaleType.INVOICE,
  })

  const createSaleMutation = useMutation({
    mutationFn: (data: any) => salesApi.create(data),
    onSuccess: (response) => {
      toast.success(`Sale completed! Code: ${response.data.saleCode}`)
      clearCart()
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create sale')
    },
  })

  const getStock = (productId: string) => {
    const inv = inventory?.find((i: any) => i.productId === productId)
    return inv?.quantity || 0
  }

  const filteredProducts = products?.filter((product: any) => {
    const matchesCategory = activeCategory === 'all' || product.type === activeCategory
    const matchesSearch = !search || 
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.code.toLowerCase().includes(search.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const handleCheckout = () => {
    if (items.length === 0) {
      toast.error('Cart is empty')
      return
    }

    const saleData = {
      branchId,
      type: saleType,
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      discount,
      items: items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    }

    createSaleMutation.mutate(saleData)
  }

  const categories = [
    { id: 'all', label: 'All', icon: Package },
    { id: 'LPG_REFILL', label: 'LPG Refills', icon: Flame },
    { id: 'LPG_CYLINDER', label: 'Cylinders', icon: Package },
    { id: 'ELECTRONICS', label: 'Electronics', icon: Zap },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">New Sale</h1>
        <p className="text-muted-foreground">Create a new sale transaction</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Products Section */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products by name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Categories */}
          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="grid grid-cols-4">
              {categories.map(cat => (
                <TabsTrigger key={cat.id} value={cat.id} className="flex items-center gap-2">
                  <cat.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{cat.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Products Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredProducts?.map((product: any) => {
              const stock = getStock(product.id)
              const cartItem = items.find(i => i.productId === product.id)
              const inCart = cartItem?.quantity || 0

              return (
                <Card
                  key={product.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${stock === 0 ? 'opacity-50' : ''}`}
                  onClick={() => {
                    if (stock > inCart) {
                      addItem(product, 1)
                      toast.success(`${product.name} added`)
                    } else {
                      toast.error('Insufficient stock')
                    }
                  }}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <Badge variant="secondary" className="text-xs">{product.type.replace('_', ' ')}</Badge>
                      <span className={`text-xs font-medium ${stock <= 10 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {stock} left
                      </span>
                    </div>
                    <h4 className="font-medium text-sm mb-1 truncate">{product.name}</h4>
                    <p className="text-lg font-bold text-primary">{formatCurrency(product.price)}</p>
                    {product.cylinderSize && <p className="text-xs text-muted-foreground">{product.cylinderSize}</p>}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {filteredProducts?.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No products found</p>
            </div>
          )}
        </div>

        {/* Cart Section */}
        <div className="space-y-4">
          <Card className="sticky top-24">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Cart ({items.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sale Type */}
              <div className="flex gap-2">
                <Button
                  variant={saleType === SaleType.CASH ? 'default' : 'outline'}
                  className="flex-1"
                  size="sm"
                  onClick={() => setSaleType(SaleType.CASH)}
                >
                  Cash
                </Button>
                <Button
                  variant={saleType === SaleType.INVOICE ? 'default' : 'outline'}
                  className="flex-1"
                  size="sm"
                  onClick={() => setSaleType(SaleType.INVOICE)}
                >
                  Invoice
                </Button>
              </div>

              {/* Cart Items */}
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {items.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">Cart is empty</p>
                ) : (
                  items.map((item) => (
                    <div key={item.productId} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(item.unitPrice)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.productId, item.quantity - 1)}>
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-6 text-center text-sm">{item.quantity}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            const stock = getStock(item.productId)
                            if (item.quantity < stock) {
                              updateQuantity(item.productId, item.quantity + 1)
                            } else {
                              toast.error('Max stock reached')
                            }
                          }}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(item.productId)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <Separator />

              {/* Customer Info */}
              <div className="space-y-2">
                <Input placeholder="Customer name (optional)" value={customerName} onChange={e => setCustomerInfo(e.target.value, customerPhone)} />
                <Input placeholder="Customer phone (optional)" value={customerPhone} onChange={e => setCustomerInfo(customerName, e.target.value)} />
              </div>

              {/* Discount */}
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="Discount (KES)"
                  value={discount || ''}
                  onChange={e => setDiscount(Number(e.target.value))}
                  className="flex-1"
                />
              </div>

              <Separator />

              {/* Totals */}
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(getSubtotal())}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span>Discount</span>
                    <span>-{formatCurrency(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(getTotal())}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                size="lg"
                disabled={items.length === 0 || createSaleMutation.isPending}
                onClick={handleCheckout}
              >
                {createSaleMutation.isPending ? 'Processing...' : 'Complete Sale'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default NewSale