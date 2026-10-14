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
import {
  ShoppingCart, Minus, Plus, Trash2, Search, Package, Flame, Tag,
  Bookmark, RotateCcw, ShieldAlert, KeyRound, Check
} from 'lucide-react'
import { PaymentSplitModal, PaymentEntry } from './PaymentSplitModal'
import { ThermalReceiptModal } from './ThermalReceiptModal'

const VARIANT_SEPARATOR = '~~'

const NewSale = () => {
  const { user } = useAuthStore()
  const {
    items, addItem, removeItem, updateQuantity, updateItemDiscount, updateItemCylinder, clearCart,
    getSubtotal, getTotalDiscount, getTotal,
    parkedCarts, parkCurrentCart, recallCart, removeParkedCart,
  } = useCartStore()

  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [saleType, setSaleType] = useState<SaleType>(SaleType.CASH)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [customerName, setCustomerName] = useState('')

  // Tracks which cart item has its discount input open
  const [discountOpenFor, setDiscountOpenFor] = useState<string | null>(null)

  // Cylinder Selection State
  const [cylinderPickerItem, setCylinderPickerItem] = useState<any | null>(null)
  const [availableCylinders, setAvailableCylinders] = useState<any[]>([])
  const [loadingCylinders, setLoadingCylinders] = useState(false)
  const [cylinderSearch, setCylinderSearch] = useState('')

  // Discount Override Modal State
  const [overrideModalOpen, setOverrideModalOpen] = useState(false)
  const [managerOverrideCode, setManagerOverrideCode] = useState('')
  const [discountReason, setDiscountReason] = useState('')

  const [lpgModalOpen, setLpgModalOpen] = useState(false)
  const [selectedInvItem, setSelectedInvItem] = useState<any>(null)
  const [splitModalOpen, setSplitModalOpen] = useState(false)
  const [parkedModalOpen, setParkedModalOpen] = useState(false)
  const [pendingSaleData, setPendingSaleData] = useState<any>(null)
  const [completedReceipt, setCompletedReceipt] = useState<any>(null)
  const [invoiceReceipt, setInvoiceReceipt] = useState<{
    code: string; name: string; phone: string; total: number; itemsStr: string
  } | null>(null)

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

  const openCylinderPickerForItem = async (item: any) => {
    setCylinderPickerItem(item)
    setCylinderSearch('')
    setLoadingCylinders(true)
    const [rawProductId, lpgVariant] = item.productId.split(VARIANT_SEPARATOR)
    const status = lpgVariant === 'EMPTY_SHELL' ? 'EMPTY' : 'FULL'
    try {
      const res = await inventoryApi.getAvailableCylinders(branchId, rawProductId, status)
      setAvailableCylinders(Array.isArray(res.data) ? res.data : [])
    } catch {
      toast.error('Failed to load available cylinders')
      setAvailableCylinders([])
    } finally {
      setLoadingCylinders(false)
    }
  }

  const createSaleMutation = useMutation({
    mutationFn: (data: any) => salesApi.create(data),
    onSuccess: (response, variables) => {
      const itemsSnapshot = items.map(item => {
        const [, lpgVariant] = item.productId.split(VARIANT_SEPARATOR)
        const label = lpgVariant === 'REFILL' ? ' (Refill)' : lpgVariant === 'EMPTY_SHELL' ? ' (Empty Shell)' : lpgVariant === 'COMPLETE_SET' ? ' (Complete Set)' : ''
        return {
          name: `${item.product.name}${label}${item.cylinderSerial ? ` [${item.cylinderSerial}]` : ''}`,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          total: item.total,
        }
      })

      const paymentList = variables.payments && variables.payments.length > 0
        ? variables.payments
        : [{ method: variables.type === SaleType.INVOICE ? 'INVOICE' : 'CASH', amount: getTotal() }]

      const customerObj = customers.find((c: any) => c.id === variables.customerId)

      // Set thermal receipt data for immediate receipt display & printing
      setCompletedReceipt({
        saleCode: response.data.saleCode,
        date: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        branchName: response.data?.branch?.name || user?.branchId || 'Branch',
        cashierName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Cashier',
        customerName: customerObj?.name || variables.customerName || undefined,
        customerPhone: customerObj?.phone || undefined,
        saleType: variables.type,
        items: itemsSnapshot,
        subtotal: getSubtotal(),
        totalDiscount: getTotalDiscount(),
        total: getTotal(),
        payments: paymentList,
      })

      if (variables.type === SaleType.INVOICE) {
        const itemsListStr = items.map(item => {
          const [, lpgVariant] = item.productId.split(VARIANT_SEPARATOR)
          const label = lpgVariant === 'REFILL' ? ' (Refill)' : lpgVariant === 'EMPTY_SHELL' ? ' (Empty Shell)' : lpgVariant === 'COMPLETE_SET' ? ' (Complete Set)' : ''
          return `${item.quantity}x ${item.product.name}${label}`
        }).join('\n- ')
        setInvoiceReceipt({
          code: response.data.saleCode,
          name: customerObj?.name || 'Customer',
          phone: customerObj?.phone || '',
          total: getTotal(),
          itemsStr: itemsListStr,
        })
      } else {
        toast.success(`Sale completed! Code: ${response.data.saleCode}`)
      }

      clearCart()
      setSearch('')
      setSelectedCustomerId('')
      setCustomerName('')
      setSaleType(SaleType.CASH)
      setDiscountOpenFor(null)
      setSplitModalOpen(false)
      setPendingSaleData(null)
      setManagerOverrideCode('')
      setDiscountReason('')
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to create sale'),
  })

  const filteredInventory = inventory?.filter((inv: any) => {
    if (!inv.product?.isActive) return false
    const isLpg = inv.product.type === 'LPG_REFILL' || inv.product.type === 'LPG_CYLINDER'
    const availableStock = isLpg ? (inv.fullCylinders || 0) : inv.quantity
    if (availableStock === 0) return false
    if (saleType === SaleType.WHOLESALE) {
      if (Number(inv.product.wholesalePrice || 0) === 0) return false
    }
    if (search.trim() === '') return true
    return (
      inv.product.name.toLowerCase().includes(search.toLowerCase()) ||
      inv.product.code.toLowerCase().includes(search.toLowerCase())
    )
  }) || []

  const handleTypeSwitch = (newType: SaleType) => {
    if (items.length > 0 && newType !== saleType) {
      if (window.confirm('Changing the sale type will clear your current cart. Do you want to proceed?')) {
        clearCart(); setSaleType(newType); setDiscountOpenFor(null)
      }
    } else {
      setSaleType(newType)
    }
  }

  const buildSaleData = () => ({
    branchId,
    type: saleType,
    customerId: requiresCustomer ? selectedCustomerId : undefined,
    customerName: !requiresCustomer && customerName.trim() ? customerName.trim() : undefined,
    idempotencyKey: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `sale_${Date.now()}_${Math.random()}`,
    discountReason: discountReason.trim() || undefined,
    managerOverrideCode: managerOverrideCode.trim() || undefined,
    items: items.map(item => {
      const [productId, lpgVariant] = item.productId.split(VARIANT_SEPARATOR)
      return {
        productId,
        quantity: item.quantity,
        discount: item.discount,
        ...(lpgVariant ? { lpgVariant } : {}),
        cylinderId: item.cylinderId || undefined,
        serialNumber: item.cylinderSerial || undefined,
      }
    }),
  })

  const totalDiscount = getTotalDiscount()
  const subtotal = getSubtotal()
  const total = getTotal()

  const handleCheckout = () => {
    if (items.length === 0) return toast.error('Cart is empty')
    if (requiresCustomer && !selectedCustomerId) return toast.error('Please select a customer for this sale')

    // Tracked cylinder assignment is optional (no scanner required)

    // Verify discount limits for branch manager
    const requiresOverride = user?.role === 'BRANCH_MANAGER' && (totalDiscount > 500 || totalDiscount > (subtotal * 0.10 + 0.01))
    if (requiresOverride && !managerOverrideCode.trim()) {
      setOverrideModalOpen(true)
      return
    }

    const saleData = buildSaleData()
    if (saleType === SaleType.INVOICE) {
      createSaleMutation.mutate(saleData)
    } else {
      setPendingSaleData(saleData)
      setSplitModalOpen(true)
    }
  }

  const handlePaymentConfirm = (payments: PaymentEntry[]) => {
    setSplitModalOpen(false)
    if (pendingSaleData) {
      createSaleMutation.mutate({ ...pendingSaleData, payments })
    }
  }

  const handleLpgSelect = (type: 'REFILL' | 'EMPTY_SHELL' | 'COMPLETE_SET') => {
    if (!selectedInvItem) return
    const p = selectedInvItem.product
    const baseGasPrice = saleType === SaleType.WHOLESALE ? Number(p.wholesalePrice || p.price) : Number(p.price)
    const rawEmptyPrice = saleType === SaleType.WHOLESALE ? (p.wholesaleEmptyPrice || p.emptyPrice) : p.emptyPrice
    const emptyPrice = rawEmptyPrice != null ? Number(rawEmptyPrice) : null

    if (type === 'REFILL') {
      if (selectedInvItem.fullCylinders > 0) {
        addItem({ ...p, id: `${p.id}${VARIANT_SEPARATOR}REFILL`, name: `${p.name} (Refill)`, price: baseGasPrice }, 1)
        toast.success(`Added ${p.name} Refill`)
      } else toast.error('No full cylinders in stock!')
    } else if (type === 'EMPTY_SHELL') {
      if (emptyPrice == null) toast.error('Empty shell price is not set for this product')
      else if (selectedInvItem.emptyCylinders > 0) {
        addItem({ ...p, id: `${p.id}${VARIANT_SEPARATOR}EMPTY_SHELL`, name: `${p.name} (Empty Shell)`, price: emptyPrice }, 1)
        toast.success(`Added ${p.name} Empty Shell`)
      } else toast.error('No empty shells in stock!')
    } else if (type === 'COMPLETE_SET') {
      if (emptyPrice == null) toast.error('Empty shell price is not set for this product')
      else if (selectedInvItem.fullCylinders > 0) {
        addItem({ ...p, id: `${p.id}${VARIANT_SEPARATOR}COMPLETE_SET`, name: `${p.name} (Complete Set)`, price: baseGasPrice + emptyPrice }, 1)
        toast.success(`Added ${p.name} Complete Set`)
      } else toast.error('No full cylinders in stock to make a complete set!')
    }
    setLpgModalOpen(false)
    setSearch('')
  }

  return (
    <div className="flex flex-col lg:min-h-[calc(100vh-6rem)] bg-background space-y-4 pb-10 lg:pb-0">
      <div className="flex-shrink-0">
        <h1 className="text-2xl font-bold">New Sale</h1>
        <p className="text-muted-foreground">Search and tap products to add to cart</p>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 flex-1 min-h-0">

        {/* ── PRODUCTS GRID ── */}
        <div className="lg:col-span-2 flex flex-col h-[50vh] lg:h-full bg-muted/10 rounded-xl border overflow-hidden shadow-sm">
          <div className="p-4 bg-card border-b flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-4 top-4 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search product name, code, or scan barcode..."
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
                <p>No products found {search.trim() !== '' && `matching "${search}"`}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredInventory.map((inv: any) => {
                  const product = inv.product
                  const isLpg = product.type === 'LPG_REFILL' || product.type === 'LPG_CYLINDER'
                  const availableStock = isLpg ? (inv.fullCylinders || 0) : inv.quantity
                  const displayPrice = saleType === SaleType.WHOLESALE
                    ? (product.wholesalePrice || product.price) : product.price
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
                          {product.isCylinderTracked && (
                            <span className="text-[10px] text-muted-foreground font-medium block mt-0.5">
                              • Serialized (Optional)
                            </span>
                          )}
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
            <CardHeader className="pb-3 flex-shrink-0 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-primary" />
                Cart ({items.length})
              </CardTitle>
              <div className="flex items-center gap-1.5">
                {parkedCarts.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs border-amber-300 dark:border-emerald-500/40 text-amber-800 dark:text-emerald-300 bg-amber-50 dark:bg-emerald-950/30 hover:bg-amber-100 dark:hover:bg-emerald-950/50"
                    onClick={() => setParkedModalOpen(true)}
                  >
                    <Bookmark className="w-3.5 h-3.5 text-amber-600 dark:text-emerald-400" />
                    Parked ({parkedCarts.length})
                  </Button>
                )}
                {items.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                    title="Park this cart to serve another customer"
                    onClick={() => {
                      const note = window.prompt('Cart label/note (e.g. customer name or car reg):')
                      if (note !== null) {
                        parkCurrentCart(note.trim() || undefined)
                        toast.success('Cart parked')
                      }
                    }}
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    Park
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="flex-1 flex flex-col min-h-[300px] overflow-hidden space-y-4">

              {/* Sale type tabs */}
              <div className="flex gap-2 flex-shrink-0 bg-muted/30 p-1 rounded-lg">
                <Button variant={saleType === SaleType.CASH ? 'default' : 'ghost'} className="flex-1" onClick={() => handleTypeSwitch(SaleType.CASH)}>Retail</Button>
                <Button variant={saleType === SaleType.WHOLESALE ? 'default' : 'ghost'} className={`flex-1 ${saleType === SaleType.WHOLESALE ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`} onClick={() => handleTypeSwitch(SaleType.WHOLESALE)}>Wholesale</Button>
                <Button variant={saleType === SaleType.INVOICE ? 'default' : 'ghost'} className={`flex-1 ${saleType === SaleType.INVOICE ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}`} onClick={() => handleTypeSwitch(SaleType.INVOICE)}>Invoice</Button>
              </div>

              {/* Cart items */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 border rounded-lg p-2 bg-muted/20 min-h-[150px]">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-60">
                    <ShoppingCart className="w-12 h-12 mb-2" />
                    <p>Cart is empty</p>
                  </div>
                ) : items.map((item) => (
                  <div key={item.productId} className="bg-card border rounded-md shadow-sm overflow-hidden">
                    {/* Main row */}
                    <div className="flex items-center gap-2 p-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate leading-tight">{item.product.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-primary font-bold">{formatCurrency(item.unitPrice)}</p>
                          {item.discount > 0 && (
                            <span className="text-[10px] text-emerald-600 font-semibold">-{formatCurrency(item.discount)}</span>
                          )}
                        </div>
                      </div>

                      {/* Qty controls */}
                      <div className="flex items-center gap-1 bg-muted/30 rounded-md border p-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm hover:bg-muted" onClick={() => updateQuantity(item.productId, item.quantity - 1)}>
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-sm hover:bg-muted" onClick={() => updateQuantity(item.productId, item.quantity + 1)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>

                      {/* Discount toggle */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-7 w-7 rounded-sm shrink-0 ${item.discount > 0 ? 'text-emerald-600 bg-emerald-50' : 'text-muted-foreground hover:bg-muted'}`}
                        title="Apply discount to this item"
                        onClick={() => setDiscountOpenFor(discountOpenFor === item.productId ? null : item.productId)}
                      >
                        <Tag className="w-3.5 h-3.5" />
                      </Button>

                      {/* Delete */}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0" onClick={() => removeItem(item.productId)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    {/* Serialized Cylinder Selection Row (Optional until barcode scanners installed) */}
                    {item.product.isCylinderTracked && (
                      <div className="px-2.5 py-1.5 bg-muted/40 border-t flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Flame className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="font-semibold text-muted-foreground shrink-0">Cylinder (opt):</span>
                          {item.cylinderSerial ? (
                            <span className="font-mono font-bold text-foreground bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 px-1.5 py-0.5 rounded truncate">
                              {item.cylinderSerial}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">None (Unassigned)</span>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[11px] px-2 py-0 border-muted-foreground/30 hover:bg-muted shrink-0"
                          onClick={() => openCylinderPickerForItem(item)}
                        >
                          {item.cylinderSerial ? 'Change' : 'Assign'}
                        </Button>
                      </div>
                    )}

                    {/* Inline discount input — only shown when toggled */}
                    {discountOpenFor === item.productId && (
                      <div className="px-2 pb-2 pt-0 flex items-center gap-2 bg-emerald-50/50 border-t border-emerald-100">
                        <Tag className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="text-xs text-emerald-700 font-medium">Disc KES</span>
                        <Input
                          type="number"
                          min={0}
                          max={item.unitPrice * item.quantity}
                          placeholder="0"
                          value={item.discount || ''}
                          onChange={(e) => updateItemDiscount(item.productId, Number(e.target.value))}
                          className="h-7 text-sm w-28 border-emerald-300 focus-visible:ring-emerald-400"
                          autoFocus
                        />
                        <span className="text-xs text-muted-foreground">
                          → {formatCurrency(item.unitPrice * item.quantity - item.discount)}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex-shrink-0 space-y-3">
                {/* Customer name — cash/retail only */}
                {!requiresCustomer && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customer Name (optional)</Label>
                    <Input placeholder="e.g. John Kamau" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="h-9 text-sm" />
                  </div>
                )}

                {/* Customer select — invoice & wholesale */}
                {requiresCustomer && (
                  <div className="space-y-1.5 p-3 bg-amber-50 dark:bg-emerald-950/20 border border-amber-200 dark:border-emerald-500/40 rounded-lg">
                    <Label className="text-xs font-bold text-amber-900 dark:text-emerald-300 uppercase tracking-wider">Select Customer (Required)</Label>
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      className="w-full p-2.5 border border-amber-300 dark:border-emerald-500/40 rounded-md text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-emerald-500/60 appearance-none"
                    >
                      <option value="">-- Choose a customer --</option>
                      {customers.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}

                <Separator />

                {/* Totals */}
                <div className="space-y-1.5 text-sm bg-slate-900 text-white p-4 rounded-xl shadow-inner">
                  <div className="flex justify-between text-slate-300">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {totalDiscount > 0 && (
                    <div className="flex justify-between text-emerald-400 font-medium">
                      <span>Discounts</span>
                      <span>- {formatCurrency(totalDiscount)}</span>
                    </div>
                  )}
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
                disabled={items.length === 0 || createSaleMutation.isPending || (requiresCustomer && !selectedCustomerId)}
                onClick={handleCheckout}
              >
                {createSaleMutation.isPending ? 'Processing...' : `Charge ${formatCurrency(total)}`}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* Split Payment Modal */}
      {splitModalOpen && pendingSaleData && (
        <PaymentSplitModal
          total={total}
          pendingSaleData={pendingSaleData}
          onConfirm={handlePaymentConfirm}
          onClose={() => { setSplitModalOpen(false); setPendingSaleData(null) }}
        />
      )}

      {/* Cylinder Selection Modal */}
      <Dialog open={!!cylinderPickerItem} onOpenChange={(o) => !o && setCylinderPickerItem(null)}>
        <DialogContent className="sm:max-w-md bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-600 dark:text-emerald-400" />
              Assign Cylinder (Optional): {cylinderPickerItem?.product?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              If scanning a barcode or serial number, select the matching unit below. Otherwise, you can skip this step and complete the sale normally.
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search serial number..."
                value={cylinderSearch}
                onChange={(e) => setCylinderSearch(e.target.value)}
                className="pl-9 h-10 text-sm"
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2 border rounded-md p-2">
              {loadingCylinders ? (
                <p className="text-sm text-center py-6 text-muted-foreground">Loading available cylinders...</p>
              ) : availableCylinders.length === 0 ? (
                <div className="text-center py-6 space-y-2">
                  <p className="text-sm text-muted-foreground">No serialized units registered for this branch.</p>
                  <p className="text-xs text-muted-foreground/75">You can still sell this item normally without a serial number.</p>
                </div>
              ) : (
                availableCylinders
                  .filter((c: any) =>
                    !cylinderSearch.trim() ||
                    c.serialNumber?.toLowerCase().includes(cylinderSearch.toLowerCase())
                  )
                  .map((cyl: any) => {
                    const isSelected = cylinderPickerItem?.cylinderId === cyl.id
                    return (
                      <div
                        key={cyl.id}
                        className={`flex items-center justify-between p-2.5 rounded-md border cursor-pointer transition-colors ${
                          isSelected ? 'border-primary bg-primary/10' : 'hover:bg-muted/40'
                        }`}
                        onClick={() => {
                          updateItemCylinder(cylinderPickerItem.productId, cyl.id, cyl.serialNumber)
                          toast.success(`Assigned cylinder: ${cyl.serialNumber}`)
                          setCylinderPickerItem(null)
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <Flame className="w-4 h-4 text-amber-500" />
                          <div>
                            <p className="text-sm font-bold font-mono">{cyl.serialNumber}</p>
                            <p className="text-[11px] text-muted-foreground">Condition: {cyl.condition || 'GOOD'}</p>
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-primary" />}
                      </div>
                    )
                  })
              )}
            </div>
            <div className="flex justify-between items-center gap-2 pt-2">
              {cylinderPickerItem?.cylinderId ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    updateItemCylinder(cylinderPickerItem.productId, undefined, undefined)
                    setCylinderPickerItem(null)
                    toast.info('Cylinder assignment removed')
                  }}
                >
                  Clear Assignment
                </Button>
              ) : <div />}
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setCylinderPickerItem(null)}>
                  Skip / Sell Without Serial
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discount Manager Override Modal */}
      <Dialog open={overrideModalOpen} onOpenChange={setOverrideModalOpen}>
        <DialogContent className="sm:max-w-md bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-emerald-400">
              <ShieldAlert className="w-5 h-5" />
              Manager Authorization Required
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Total discounts of <strong>{formatCurrency(totalDiscount)}</strong> exceed your branch manager limit (Max 10% or KES 500). Enter the administrator override code and reason to proceed.
            </p>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Manager Override Code *</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Enter override code"
                  value={managerOverrideCode}
                  onChange={(e) => setManagerOverrideCode(e.target.value)}
                  className="pl-9 h-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Discount Reason (Optional)</Label>
              <Input
                placeholder="e.g. Loyalty customer, promotional offer..."
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOverrideModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!managerOverrideCode.trim()) {
                    toast.error('Please enter the manager override code')
                    return
                  }
                  setOverrideModalOpen(false)
                  const saleData = buildSaleData()
                  if (saleType === SaleType.INVOICE) {
                    createSaleMutation.mutate(saleData)
                  } else {
                    setPendingSaleData(saleData)
                    setSplitModalOpen(true)
                  }
                }}
              >
                Authorize & Checkout
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* LPG selection modal */}
      <Dialog open={lpgModalOpen} onOpenChange={setLpgModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Select Sale Type: {selectedInvItem?.product?.name}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-4">
            <Button variant="outline" className={`h-16 justify-start text-left px-4 ${selectedInvItem?.fullCylinders === 0 ? 'opacity-50' : 'hover:border-blue-400'}`} onClick={() => handleLpgSelect('REFILL')} disabled={selectedInvItem?.fullCylinders === 0}>
              <Flame className="w-5 h-5 mr-3 text-blue-500" />
              <div className="flex-1"><div className="flex justify-between w-full"><p className="font-bold">Gas Refill Only</p><span className="text-xs font-medium text-blue-600">{selectedInvItem?.fullCylinders} left</span></div><p className="text-xs text-muted-foreground">Customer returns empty shell</p></div>
            </Button>
            <Button variant="outline" className={`h-16 justify-start text-left px-4 ${(selectedInvItem?.emptyCylinders <= 0 || selectedInvItem?.product?.emptyPrice == null) ? 'opacity-50' : 'hover:border-amber-400 dark:hover:border-emerald-400/60'}`} onClick={() => handleLpgSelect('EMPTY_SHELL')} disabled={selectedInvItem?.emptyCylinders <= 0 || selectedInvItem?.product?.emptyPrice == null}>
              <Package className="w-5 h-5 mr-3 text-amber-600 dark:text-emerald-400" />
              <div className="flex-1"><div className="flex justify-between w-full"><p className="font-bold">Empty Cylinder</p><span className="text-xs font-medium text-amber-600">{Math.max(0, selectedInvItem?.emptyCylinders || 0)} left</span></div><p className="text-xs text-muted-foreground">{saleType === SaleType.WHOLESALE ? (selectedInvItem?.product?.wholesaleEmptyPrice ? formatCurrency(selectedInvItem.product.wholesaleEmptyPrice) : 'price not set') : (selectedInvItem?.product?.emptyPrice != null ? formatCurrency(selectedInvItem.product.emptyPrice) : 'price not set')}</p></div>
            </Button>
            <Button className={`h-16 justify-start text-left px-4 ${(selectedInvItem?.fullCylinders === 0 || selectedInvItem?.product?.emptyPrice == null) ? 'opacity-50' : ''}`} onClick={() => handleLpgSelect('COMPLETE_SET')} disabled={selectedInvItem?.fullCylinders === 0 || selectedInvItem?.product?.emptyPrice == null}>
              <Flame className="w-5 h-5 mr-3" />
              <div className="flex-1"><p className="font-bold">Complete Set (Gas + Shell)</p><p className="text-xs opacity-90">{saleType === SaleType.WHOLESALE ? formatCurrency(Number(selectedInvItem?.product?.wholesalePrice || 0) + Number(selectedInvItem?.product?.wholesaleEmptyPrice || 0)) : formatCurrency(Number(selectedInvItem?.product?.price || 0) + Number(selectedInvItem?.product?.emptyPrice || 0))}</p></div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invoice receipt modal */}
      <Dialog open={!!invoiceReceipt} onOpenChange={() => setInvoiceReceipt(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-amber-600 flex items-center gap-2"><Package className="w-5 h-5" /> Invoice Generated Successfully</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">The invoice has been saved. Copy the message below to send to the customer.</p>
            <textarea readOnly className="w-full h-48 p-3 bg-muted rounded-md text-sm border focus:outline-none resize-none"
              value={`Hello ${invoiceReceipt?.name},\n\nAn invoice (${invoiceReceipt?.code}) for KES ${invoiceReceipt?.total.toLocaleString()} has been generated for your recent purchase at Njugush POS.\n\nItems:\n- ${invoiceReceipt?.itemsStr}\n\nPlease arrange payment. Thank you!`}
            />
            <Button className="w-full bg-green-600 hover:bg-green-700 text-white"
              onClick={() => {
                const msg = `Hello ${invoiceReceipt?.name},\n\nAn invoice (${invoiceReceipt?.code}) for KES ${invoiceReceipt?.total.toLocaleString()} has been generated for your recent purchase at Njugush POS.\n\nItems:\n- ${invoiceReceipt?.itemsStr}\n\nPlease arrange payment. Thank you!`
                navigator.clipboard.writeText(msg)
                toast.success('Message copied to clipboard!')
              }}>Copy WhatsApp Message</Button>
            <Button variant="outline" className="w-full" onClick={() => setInvoiceReceipt(null)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Parked Carts Modal */}
      <Dialog open={parkedModalOpen} onOpenChange={setParkedModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-primary" /> Parked Carts ({parkedCarts.length})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-[60vh] overflow-y-auto">
            {parkedCarts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No parked carts.</p>
            ) : (
              parkedCarts.map((pc) => {
                const pcTotal = pc.items.reduce((acc, it) => acc + (it.unitPrice * it.quantity - (it.discount || 0)), 0)
                return (
                  <div key={pc.id} className="p-3 border rounded-lg bg-card flex items-center justify-between gap-3 shadow-sm hover:border-primary/40 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">{pc.label || pc.note || 'Untitled Cart'}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(pc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {pc.items.length} item{pc.items.length !== 1 ? 's' : ''} • <span className="font-semibold text-primary">{formatCurrency(pcTotal)}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="default"
                        className="h-8 gap-1 text-xs"
                        onClick={() => {
                          if (items.length > 0 && !window.confirm('Restoring this parked cart will replace your current active cart items. Continue?')) {
                            return
                          }
                          recallCart(pc.id)
                          setParkedModalOpen(false)
                          toast.success('Parked cart restored')
                        }}
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Recall
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          removeParkedCart(pc.id)
                          toast.info('Parked cart discarded')
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Thermal Receipt Modal */}
      {completedReceipt && (
        <ThermalReceiptModal
          receipt={completedReceipt}
          onClose={() => setCompletedReceipt(null)}
        />
      )}

    </div>
  )
}

export default NewSale
