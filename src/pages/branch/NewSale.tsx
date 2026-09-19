import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryApi, salesApi, customersApi } from '@/api'
import { useAuthStore, useCartStore } from '@/store'
import { SaleType } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'
import { ShoppingCart, Minus, Plus, Trash2, Search, Package, Flame, Tag } from 'lucide-react'
import { CheckoutTerminal } from './CheckoutTerminal'

const VARIANT_SEPARATOR = '~~'

const NewSale = () => {
  const { user } = useAuthStore()
  const {
    items, addItem, removeItem, updateQuantity, updateItemDiscount, clearCart,
    getSubtotal, getTotalDiscount, getTotal,
  } = useCartStore()

  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [saleType, setSaleType] = useState<SaleType>(SaleType.CASH)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [customerName, setCustomerName] = useState('')

  const [discountOpenFor, setDiscountOpenFor] = useState<string | null>(null)
  const [lpgModalOpen, setLpgModalOpen] = useState(false)
  const [selectedInvItem, setSelectedInvItem] = useState<any>(null)
  
  const [pendingSaleId, setPendingSaleId] = useState<string | null>(null)
  const [invoiceReceipt, setInvoiceReceipt] = useState<any>(null)

  const requiresCustomer = saleType === SaleType.INVOICE || saleType === SaleType.WHOLESALE
  const branchId = user?.branchId || ''

  const { data: inventory } = useQuery({
    queryKey: ['inventory', branchId],
    queryFn: async () => {
      if (!branchId) return []
      const response = await inventoryApi.getAll({ branchId })
      return response.data
    },
    enabled: !!branchId,
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      try {
        const response = await customersApi.getAll()
        const data = Array.isArray(response.data) ? response.data : (response.data?.data || [])
        return data.filter((c: any) => c.isActive)
      } catch { return [] }
    },
  })

  // 🚀 ARCHITECTURE FIX: This mutation now strictly creates a PENDING sale.
  const createPendingSaleMutation = useMutation({
    mutationFn: (data: any) => salesApi.create({ ...data, status: 'PENDING' }),
    onSuccess: (response, variables) => {
      if (variables.type === SaleType.INVOICE) {
        const customer = customers.find((c: any) => c.id === variables.customerId)
        setInvoiceReceipt({
          code: response.data.saleCode,
          name: customer?.name || 'Customer',
          total: getTotal(),
        })
        handleReset()
      } else {
        // Proceed to Checkout Terminal for Payment
        setPendingSaleId(response.data.id)
      }
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to initialize sale'),
  })

  // Cancels the sale if the user exits the terminal without paying
  const cancelSaleMutation = useMutation({
    mutationFn: (id: string) => salesApi.cancel(id),
    onSuccess: () => {
      setPendingSaleId(null)
      toast.info('Sale cancelled')
    }
  })

  const filteredInventory = inventory?.filter((inv: any) => {
    if (!inv.product?.isActive) return false
    const isLpg = inv.product.type === 'LPG_REFILL' || inv.product.type === 'LPG_CYLINDER'
    const availableStock = isLpg ? (inv.fullCylinders || 0) : inv.quantity
    if (availableStock === 0) return false
    if (saleType === SaleType.WHOLESALE && Number(inv.product.wholesalePrice || 0) === 0) return false
    if (search.trim() === '') return true
    return inv.product.name.toLowerCase().includes(search.toLowerCase()) || inv.product.code.toLowerCase().includes(search.toLowerCase())
  }) || []

  const handleReset = () => {
    clearCart()
    setSearch('')
    setSelectedCustomerId('')
    setCustomerName('')
    setSaleType(SaleType.CASH)
    setPendingSaleId(null)
    queryClient.invalidateQueries({ queryKey: ['sales'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    queryClient.invalidateQueries({ queryKey: ['inventory'] })
  }

  const handleInitializeCheckout = () => {
    if (items.length === 0) return toast.error('Cart is empty')
    if (requiresCustomer && !selectedCustomerId) return toast.error('Please select a customer for this sale')
    
    createPendingSaleMutation.mutate({
      branchId,
      type: saleType,
      customerId: requiresCustomer ? selectedCustomerId : undefined,
      customerName: !requiresCustomer && customerName.trim() ? customerName.trim() : undefined,
      items: items.map(item => {
        const [productId, lpgVariant] = item.productId.split(VARIANT_SEPARATOR)
        return { productId, quantity: item.quantity, discount: item.discount, ...(lpgVariant ? { lpgVariant } : {}) }
      }),
    })
  }

  const handleLpgSelect = (type: 'REFILL' | 'EMPTY_SHELL' | 'COMPLETE_SET') => {
    if (!selectedInvItem) return
    const p = selectedInvItem.product
    const baseGasPrice = saleType === SaleType.WHOLESALE ? Number(p.wholesalePrice || p.price) : Number(p.price)
    const emptyPrice = saleType === SaleType.WHOLESALE ? Number(p.wholesaleEmptyPrice || p.emptyPrice || 0) : Number(p.emptyPrice || 0)

    if (type === 'REFILL') addItem({ ...p, id: `${p.id}${VARIANT_SEPARATOR}REFILL`, name: `${p.name} (Refill)`, price: baseGasPrice }, 1)
    else if (type === 'EMPTY_SHELL') addItem({ ...p, id: `${p.id}${VARIANT_SEPARATOR}EMPTY_SHELL`, name: `${p.name} (Empty Shell)`, price: emptyPrice }, 1)
    else addItem({ ...p, id: `${p.id}${VARIANT_SEPARATOR}COMPLETE_SET`, name: `${p.name} (Complete Set)`, price: baseGasPrice + emptyPrice }, 1)
    
    setLpgModalOpen(false)
    setSearch('')
  }

  const totalDiscount = getTotalDiscount()
  const subtotal = getSubtotal()
  const total = getTotal()

  return (
    <div className="flex flex-col lg:min-h-[calc(100vh-6rem)] bg-background space-y-4 pb-10 lg:pb-0">
      <div className="flex-shrink-0">
        <h1 className="text-2xl font-bold">New Sale</h1>
        <p className="text-muted-foreground">Search and tap products to add to cart</p>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 flex-1 min-h-0">
        <div className="lg:col-span-2 flex flex-col h-[50vh] lg:h-full bg-muted/10 rounded-xl border overflow-hidden shadow-sm">
          <div className="p-4 bg-card border-b flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-4 top-4 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search product name, code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-12 h-14 text-lg focus-visible:ring-primary shadow-sm"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {filteredInventory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                <Package className="w-12 h-12 mb-4 opacity-30" />
                <p>No products found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredInventory.map((inv: any) => {
                  const product = inv.product
                  const isLpg = product.type === 'LPG_REFILL' || product.type === 'LPG_CYLINDER'
                  const availableStock = isLpg ? (inv.fullCylinders || 0) : inv.quantity
                  const displayPrice = saleType === SaleType.WHOLESALE ? (product.wholesalePrice || product.price) : product.price
                  return (
                    <Card
                      key={product.id}
                      className="cursor-pointer transition-all hover:border-primary hover:shadow-md bg-card"
                      onClick={() => {
                        if (isLpg) {
                          setSelectedInvItem({ ...inv, emptyCylinders: (inv.quantity || 0) - (inv.fullCylinders || 0) })
                          setLpgModalOpen(true)
                        } else {
                          addItem({ ...product, price: displayPrice }, 1)
                          setSearch('')
                        }
                      }}
                    >
                      <CardContent className="p-4 flex flex-col h-full justify-between gap-3">
                        <div className="flex items-start justify-between">
                          <div className={`p-2 rounded-lg ${isLpg ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                            {isLpg ? <Flame size={16} /> : <Package size={16} />}
                          </div>
                          <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${availableStock <= 5 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {availableStock} left
                          </span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm line-clamp-2 leading-snug">{product.name}</h4>
                          <p className="text-lg font-black text-primary mt-1">{formatCurrency(displayPrice)}</p>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── CART ── */}
        <div className="flex flex-col h-auto lg:h-full">
          <Card className="flex flex-col h-full border-primary/10 shadow-md">
            <CardHeader className="pb-4 flex-shrink-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-primary" />
                Cart ({items.length})
              </CardTitle>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col min-h-[300px] overflow-hidden space-y-4">
              <div className="flex gap-2 flex-shrink-0 bg-muted/30 p-1 rounded-lg">
                <Button variant={saleType === SaleType.CASH ? 'default' : 'ghost'} className="flex-1" onClick={() => handleTypeSwitch(SaleType.CASH)}>Retail</Button>
                <Button variant={saleType === SaleType.WHOLESALE ? 'default' : 'ghost'} className={`flex-1 ${saleType === SaleType.WHOLESALE ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`} onClick={() => handleTypeSwitch(SaleType.WHOLESALE)}>Wholesale</Button>
                <Button variant={saleType === SaleType.INVOICE ? 'default' : 'ghost'} className={`flex-1 ${saleType === SaleType.INVOICE ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}`} onClick={() => handleTypeSwitch(SaleType.INVOICE)}>Invoice</Button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 border rounded-lg p-2 bg-muted/20 min-h-[150px]">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-60">
                    <ShoppingCart className="w-12 h-12 mb-2" />
                    <p>Cart is empty</p>
                  </div>
                ) : items.map((item) => (
                  <div key={item.productId} className="bg-card border rounded-md shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 p-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate leading-tight">{item.product.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-primary font-bold">{formatCurrency(item.unitPrice)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 bg-muted/30 rounded-md border p-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm hover:bg-muted" onClick={() => updateQuantity(item.productId, item.quantity - 1)}>
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm hover:bg-muted" onClick={() => updateQuantity(item.productId, item.quantity + 1)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0" onClick={() => removeItem(item.productId)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex-shrink-0 space-y-3">
                {!requiresCustomer && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customer Name (optional)</Label>
                    <Input placeholder="e.g. John Kamau" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="h-9 text-sm" />
                  </div>
                )}
                {requiresCustomer && (
                  <div className="space-y-1.5 p-3 bg-amber-50 border border-amber-200 rounded-lg dark:bg-amber-900/20 dark:border-amber-900/50">
                    <Label className="text-xs font-bold text-amber-900 dark:text-amber-500 uppercase tracking-wider">Select Customer (Required)</Label>
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      className="w-full p-2.5 border border-amber-300 rounded-md text-sm bg-card focus:outline-none focus:ring-2 focus:ring-amber-500 appearance-none"
                    >
                      <option value="">-- Choose a customer --</option>
                      {customers.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}
                <Separator />
                <div className="space-y-1.5 text-sm bg-slate-900 text-white p-4 rounded-xl shadow-inner">
                  <div className="flex justify-between text-slate-300">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-xl font-black text-white pt-2 mt-2 border-t border-slate-700">
                    <span>Total</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>
            </CardContent>

            <CardFooter className="pt-2 flex-shrink-0">
              <Button
                className={`w-full text-lg font-bold h-14 shadow-lg ${saleType === SaleType.WHOLESALE ? 'bg-purple-600 hover:bg-purple-700' : ''}`}
                disabled={items.length === 0 || createPendingSaleMutation.isPending || (requiresCustomer && !selectedCustomerId)}
                onClick={handleInitializeCheckout}
              >
                {createPendingSaleMutation.isPending ? 'Processing...' : `Charge ${formatCurrency(total)}`}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      {pendingSaleId && (
        <CheckoutTerminal
          saleId={pendingSaleId}
          total={total}
          onSuccess={() => { toast.success('Sale Completed Successfully!'); handleReset(); }}
          onCancel={() => { cancelSaleMutation.mutate(pendingSaleId) }}
        />
      )}

      {/* LPG selection modal */}
      <Dialog open={lpgModalOpen} onOpenChange={setLpgModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Select Sale Type: {selectedInvItem?.product?.name}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-4">
            <Button variant="outline" className={`h-16 justify-start text-left px-4 ${selectedInvItem?.fullCylinders === 0 ? 'opacity-50' : 'hover:border-blue-400'}`} onClick={() => handleLpgSelect('REFILL')} disabled={selectedInvItem?.fullCylinders === 0}>
              <Flame className="w-5 h-5 mr-3 text-blue-500" />
              <div className="flex-1"><div className="flex justify-between w-full"><p className="font-bold">Gas Refill Only</p></div><p className="text-xs text-muted-foreground">Customer returns empty shell</p></div>
            </Button>
            <Button variant="outline" className={`h-16 justify-start text-left px-4 ${(selectedInvItem?.emptyCylinders <= 0) ? 'opacity-50' : 'hover:border-amber-400'}`} onClick={() => handleLpgSelect('EMPTY_SHELL')} disabled={selectedInvItem?.emptyCylinders <= 0}>
              <Package className="w-5 h-5 mr-3 text-amber-600" />
              <div className="flex-1"><div className="flex justify-between w-full"><p className="font-bold">Empty Cylinder</p></div></div>
            </Button>
            <Button className={`h-16 justify-start text-left px-4 ${(selectedInvItem?.fullCylinders === 0) ? 'opacity-50' : ''}`} onClick={() => handleLpgSelect('COMPLETE_SET')} disabled={selectedInvItem?.fullCylinders === 0}>
              <Flame className="w-5 h-5 mr-3" />
              <div className="flex-1"><p className="font-bold">Complete Set (Gas + Shell)</p></div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default NewSale
