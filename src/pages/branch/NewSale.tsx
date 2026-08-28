import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api, { inventoryApi, salesApi, customersApi } from '@/api'
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

const VARIANT_SEPARATOR = '~~'

const NewSale = () => {
  const { user } = useAuthStore()
  const { 
    items, addItem, removeItem, updateQuantity, clearCart, 
    getSubtotal, getTotal, discount, setDiscount 
  } = useCartStore()

  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [saleType, setSaleType] = useState<SaleType>(SaleType.CASH)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')

  const [lpgModalOpen, setLpgModalOpen] = useState(false)
  const [selectedInvItem, setSelectedInvItem] = useState<any>(null)
  
  // WhatsApp Generator State
  const [invoiceReceipt, setInvoiceReceipt] = useState<{code: string, name: string, phone: string, total: number} | null>(null)

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
      } catch (error) {
        return []
      }
    }
  })

  const createSaleMutation = useMutation({
    mutationFn: (data: any) => salesApi.create(data),
    onSuccess: (response, variables) => {
      if (variables.type === SaleType.INVOICE) {
        const customer = customers.find((c: any) => c.id === variables.customerId)
        setInvoiceReceipt({
          code: response.data.saleCode,
          name: customer?.name || 'Customer',
          phone: customer?.phone || '',
          total: getTotal() - (discount || 0)
        })
      } else {
        toast.success(`Cash sale completed! Code: ${response.data.saleCode}`)
      }
      
      clearCart()
      setSearch('')
      setSelectedCustomerId('')
      setSaleType(SaleType.CASH)
      setDiscount(0)
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create sale')
    },
  })

  const filteredInventory = inventory?.filter((inv: any) => {
    if (!inv.product?.isActive) return false;
    if (search.trim() === '') return true;
    return (
      inv.product.name.toLowerCase().includes(search.toLowerCase()) ||
      inv.product.code.toLowerCase().includes(search.toLowerCase())
    )
  }) || []

  const handleCheckout = () => {
    if (items.length === 0) return toast.error('Cart is empty')
    if (saleType === SaleType.INVOICE && !selectedCustomerId) {
      return toast.error('Please select a customer for this invoice')
    }

    const saleData = {
      branchId, 
      type: saleType, 
      customerId: saleType === SaleType.INVOICE ? selectedCustomerId : undefined,
      discount,
      items: items.map(item => {
        const [productId, lpgVariant] = item.productId.split(VARIANT_SEPARATOR)
        return {
          productId,
          quantity: item.quantity,
          ...(lpgVariant ? { lpgVariant } : {}),
        }
      }),
    }

    createSaleMutation.mutate(saleData)
  }

  const handleLpgSelect = (type: 'REFILL' | 'EMPTY_SHELL' | 'COMPLETE_SET') => {
    if (!selectedInvItem) return;

    const p = selectedInvItem.product;
    const emptyPrice = p.emptyPrice != null ? Number(p.emptyPrice) : null;

    if (type === 'REFILL') {
      if (selectedInvItem.fullCylinders > 0) {
        addItem({ ...p, id: `${p.id}${VARIANT_SEPARATOR}REFILL`, name: `${p.name} (Refill)` }, 1)
        toast.success(`Added ${p.name} Refill`)
      } else toast.error('No full cylinders in stock!')
    } 
    else if (type === 'EMPTY_SHELL') {
      if (emptyPrice == null) toast.error('Empty shell price is not set for this product')
      else if (selectedInvItem.emptyCylinders > 0) {
        addItem({ ...p, id: `${p.id}${VARIANT_SEPARATOR}EMPTY_SHELL`, name: `${p.name} (Empty Shell)`, price: emptyPrice }, 1)
        toast.success(`Added ${p.name} Empty Shell`)
      } else toast.error('No empty shells in stock!')
    } 
    else if (type === 'COMPLETE_SET') {
      if (emptyPrice == null) toast.error('Empty shell price is not set for this product')
      else if (selectedInvItem.fullCylinders > 0) {
        // Complete Sets ONLY check for fullCylinders (gas) availability, empty shells are ignored.
        addItem({ ...p, id: `${p.id}${VARIANT_SEPARATOR}COMPLETE_SET`, name: `${p.name} (Complete Set)`, price: Number(p.price) + emptyPrice }, 1)
        toast.success(`Added ${p.name} Complete Set`)
      } else toast.error('No full cylinders in stock to make a complete set!')
    }

    setLpgModalOpen(false)
    setSearch('')
  }

  return (
    <div className="flex flex-col lg:h-[calc(100vh-6rem)] space-y-4 pb-10 lg:pb-0">
      <div className="flex-shrink-0">
        <h1 className="text-2xl font-bold">New Sale</h1>
        <p className="text-muted-foreground">Search and tap products to add to cart</p>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Left Side: Search & Scrollable Products Grid */}
        <div className="lg:col-span-2 flex flex-col h-[50vh] lg:h-full bg-muted/10 rounded-xl border overflow-hidden shadow-sm">
          <div className="p-4 bg-white border-b flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-4 top-4 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search product name, code, or scan barcode..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-12 h-14 text-lg bg-gray-50/50 border-gray-200 focus-visible:ring-primary shadow-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {filteredInventory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                <Package className="w-12 h-12 mb-4 opacity-30" />
                <p>No products found {search.trim() !== '' && `matching "${search}"`}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredInventory.map((inv: any) => {
                  const product = inv.product;
                  const isLpg = product.type === 'LPG_REFILL' || product.type === 'LPG_CYLINDER';
                  const availableStock = isLpg ? (inv.fullCylinders || 0) : inv.quantity;
                  const isOutOfStock = availableStock === 0;

                  return (
                    <Card
                      key={product.id}
                      className={`cursor-pointer transition-all hover:border-primary hover:shadow-md bg-white ${isOutOfStock ? 'opacity-50 grayscale' : ''}`}
                      onClick={() => {
                        if (isLpg) {
                          setSelectedInvItem({
                            ...inv, 
                            emptyCylinders: (inv.quantity || 0) - (inv.fullCylinders || 0)
                          })
                          setLpgModalOpen(true)
                        } else {
                          if (!isOutOfStock) {
                            addItem(product, 1)
                            setSearch('')
                          } else toast.error('Out of stock!')
                        }
                      }}
                    >
                      <CardContent className="p-4 flex flex-col h-full justify-between gap-3">
                        <div className="flex items-start justify-between">
                          <div className={`p-2 rounded-lg ${isLpg ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                            {isLpg ? <Flame size={16} /> : <Package size={16} />}
                          </div>
                          <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${isOutOfStock ? 'bg-red-100 text-red-700' : availableStock <= 5 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {isOutOfStock ? 'Out of Stock' : `${availableStock} left`}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm line-clamp-2 leading-snug">{product.name}</h4>
                          <p className="text-lg font-black text-primary mt-1">{formatCurrency(product.price)}</p>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Cart Section */}
        <div className="flex flex-col h-auto lg:h-full">
          <Card className="flex flex-col h-full border-primary/10 shadow-md">
            <CardHeader className="pb-4 flex-shrink-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-primary" />
                Cart ({items.length})
              </CardTitle>
            </CardHeader>
            
            <CardContent className="flex-1 flex flex-col min-h-[300px] overflow-hidden space-y-4">
              <div className="flex gap-2 flex-shrink-0">
                <Button variant={saleType === SaleType.CASH ? 'default' : 'outline'} className="flex-1" onClick={() => setSaleType(SaleType.CASH)}>Cash</Button>
                <Button variant={saleType === SaleType.INVOICE ? 'default' : 'outline'} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white" onClick={() => setSaleType(SaleType.INVOICE)}>Invoice</Button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-2 border rounded-lg p-2 bg-gray-50/50 min-h-[150px]">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-60">
                    <ShoppingCart className="w-12 h-12 mb-2" />
                    <p>Cart is empty</p>
                  </div>
                ) : (
                  items.map((item) => (
                    <div key={item.productId} className="flex items-center gap-2 p-2 bg-white border rounded-md shadow-sm">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate leading-tight">{item.product.name}</p>
                        <p className="text-xs text-primary font-bold mt-0.5">{formatCurrency(item.unitPrice)}</p>
                      </div>
                      <div className="flex items-center gap-1 bg-muted/30 rounded-md border p-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm hover:bg-white" onClick={() => updateQuantity(item.productId, item.quantity - 1)}>
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm hover:bg-white" onClick={() => updateQuantity(item.productId, item.quantity + 1)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive ml-1" onClick={() => removeItem(item.productId)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="flex-shrink-0 space-y-3">
                {saleType === SaleType.INVOICE && (
                  <div className="space-y-1.5 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <Label className="text-xs font-bold text-amber-900 uppercase tracking-wider">Select Customer (Required)</Label>
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      className="w-full p-2.5 border border-amber-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 appearance-none"
                    >
                      <option value="">-- Choose a customer --</option>
                      {customers.map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.phone ? `(${c.phone})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center gap-2 px-1">
                  <Tag className="w-4 h-4 text-muted-foreground" />
                  <Input type="number" placeholder="Apply Discount (KES)" value={discount || ''} onChange={e => setDiscount(Number(e.target.value))} className="flex-1 h-10 border-gray-200" />
                </div>

                <Separator />

                <div className="space-y-1.5 text-sm bg-slate-900 text-white p-4 rounded-xl shadow-inner">
                  <div className="flex justify-between text-slate-300">
                    <span>Subtotal</span>
                    <span>{formatCurrency(getSubtotal())}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-red-400 font-medium">
                      <span>Discount</span>
                      <span>-{formatCurrency(discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xl font-black text-white pt-2 mt-2 border-t border-slate-700">
                    <span>Total</span>
                    <span>{formatCurrency(getTotal())}</span>
                  </div>
                </div>
              </div>
            </CardContent>
            
            <CardFooter className="pt-2 flex-shrink-0">
              <Button 
                className="w-full text-lg font-bold h-14 shadow-lg" 
                disabled={items.length === 0 || createSaleMutation.isPending || (saleType === SaleType.INVOICE && !selectedCustomerId)} 
                onClick={handleCheckout}
              >
                {createSaleMutation.isPending ? 'Processing...' : `Charge ${formatCurrency(getTotal())}`}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* LPG Selection Modal */}
      <Dialog open={lpgModalOpen} onOpenChange={setLpgModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Sale Type: {selectedInvItem?.product?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <Button 
              variant="outline" 
              className={`h-16 justify-start text-left px-4 ${selectedInvItem?.fullCylinders === 0 ? 'opacity-50' : 'hover:border-blue-400'}`} 
              onClick={() => handleLpgSelect('REFILL')}
              disabled={selectedInvItem?.fullCylinders === 0}
            >
              <Flame className="w-5 h-5 mr-3 text-blue-500" />
              <div className="flex-1">
                <div className="flex justify-between w-full">
                  <p className="font-bold">Gas Refill Only</p>
                  <span className="text-xs font-medium text-blue-600">{selectedInvItem?.fullCylinders} left</span>
                </div>
                <p className="text-xs text-muted-foreground">Customer returns empty shell</p>
              </div>
            </Button>

            <Button 
              variant="outline" 
              className={`h-16 justify-start text-left px-4 ${(selectedInvItem?.emptyCylinders === 0 || selectedInvItem?.product?.emptyPrice == null) ? 'opacity-50' : 'hover:border-amber-400'}`} 
              onClick={() => handleLpgSelect('EMPTY_SHELL')}
              disabled={selectedInvItem?.emptyCylinders === 0 || selectedInvItem?.product?.emptyPrice == null}
            >
              <Package className="w-5 h-5 mr-3 text-amber-600" />
              <div className="flex-1">
                <div className="flex justify-between w-full">
                  <p className="font-bold">Empty Cylinder</p>
                  <span className="text-xs font-medium text-amber-600">{selectedInvItem?.emptyCylinders} left</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Selling shell asset ({selectedInvItem?.product?.emptyPrice != null ? formatCurrency(selectedInvItem.product.emptyPrice) : 'price not set'})
                </p>
              </div>
            </Button>

            <Button 
              className={`h-16 justify-start text-left px-4 ${(selectedInvItem?.fullCylinders === 0 || selectedInvItem?.product?.emptyPrice == null) ? 'opacity-50' : ''}`}
              onClick={() => handleLpgSelect('COMPLETE_SET')}
              disabled={selectedInvItem?.fullCylinders === 0 || selectedInvItem?.product?.emptyPrice == null}
            >
              <Flame className="w-5 h-5 mr-3" />
              <div className="flex-1">
                <p className="font-bold">Complete Set (Gas + Shell)</p>
                <p className="text-xs opacity-90">
                  Customer takes new cylinder ({selectedInvItem?.product?.emptyPrice != null ? formatCurrency(Number(selectedInvItem.product.price) + Number(selectedInvItem.product.emptyPrice)) : 'price not set'})
                </p>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invoice WhatsApp/SMS Generator Modal */}
      <Dialog open={!!invoiceReceipt} onOpenChange={() => setInvoiceReceipt(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-amber-600 flex items-center gap-2">
              <Package className="w-5 h-5" /> Invoice Generated Successfully
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              The invoice has been saved. Copy the message below to send to the customer and the admin via WhatsApp/SMS.
            </p>
            <textarea 
              readOnly 
              className="w-full h-32 p-3 bg-muted rounded-md text-sm border focus:outline-none"
              value={`Hello ${invoiceReceipt?.name},\n\nAn invoice (${invoiceReceipt?.code}) for KES ${invoiceReceipt?.total.toLocaleString()} has been generated for your recent purchase at Njugush POS.\n\nPlease arrange payment. Thank you!`}
            />
            <Button 
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              onClick={() => {
                const msg = `Hello ${invoiceReceipt?.name},\n\nAn invoice (${invoiceReceipt?.code}) for KES ${invoiceReceipt?.total.toLocaleString()} has been generated for your recent purchase at Njugush POS.\n\nPlease arrange payment. Thank you!`
                navigator.clipboard.writeText(msg)
                toast.success('Message copied to clipboard!')
              }}
            >
              Copy WhatsApp Message
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setInvoiceReceipt(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default NewSale
