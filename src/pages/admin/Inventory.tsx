import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryApi, branchesApi, productsApi } from '@/api'
import { useAuthStore } from '@/store'
import { UserRole } from '@/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PackageSearch, AlertTriangle, Store, ArrowLeft, Plus, Trash2, Settings2, DollarSign } from 'lucide-react'
import { toast } from 'sonner'

const Inventory = () => {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [activeBranchId, setActiveBranchId] = useState<string>(
    user?.role === UserRole.BRANCH_MANAGER ? user.branchId || '' : ''
  )
  const [showLowStock, setShowLowStock] = useState(false)
  const [pageMap, setPageMap] = useState<Record<string, number>>({})

  const [pricingMode, setPricingMode] = useState<'RETAIL' | 'WHOLESALE'>('RETAIL')

  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [isAdjustStockOpen, setIsAdjustStockOpen] = useState(false)
  const [adjustQuantity, setAdjustQuantity] = useState<number>(0)
  const [adjustFull, setAdjustFull] = useState<number>(0)
  const [adjustReason, setAdjustReason] = useState('')

  const [isEditPriceOpen, setIsEditPriceOpen] = useState(false)
  const [editPrice, setEditPrice] = useState<number>(0)
  const [editEmptyPrice, setEditEmptyPrice] = useState<number>(0)
  const [editWholesalePrice, setEditWholesalePrice] = useState<number>(0)
  const [editWholesaleEmptyPrice, setEditWholesaleEmptyPrice] = useState<number>(0)

  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [isLpgCategory, setIsLpgCategory] = useState(false)

  const [isAddProductOpen, setIsAddProductOpen] = useState(false)
  const [newProduct, setNewProduct] = useState({
    name: '', code: '', type: 'ACCESSORIES', categoryId: '',
    price: 0, emptyPrice: 0, wholesalePrice: 0, wholesaleEmptyPrice: 0, minStockLevel: 10
  })

  // ── Confirm-delete dialog state ─────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const { data: branches, isLoading: isLoadingBranches } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => (await branchesApi.getAll()).data,
    enabled: user?.role !== UserRole.BRANCH_MANAGER && !activeBranchId,
  })

  const { data: inventory, isLoading: isLoadingInventory } = useQuery({
    queryKey: ['inventory', activeBranchId, showLowStock],
    queryFn: async () => {
      const params: any = { branchId: activeBranchId }
      if (showLowStock) params.lowStock = true
      return (await inventoryApi.getAll(params)).data
    },
    enabled: !!activeBranchId,
  })

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await productsApi.getCategories()).data,
  })

  const activeBranch = branches?.find((b: any) => b.id === activeBranchId) || inventory?.[0]?.branch

  const adjustStockMutation = useMutation({
    mutationFn: async (data: { id: string; quantity?: number; fullCylinders?: number; reason: string }) =>
      await inventoryApi.adjustStock(data.id, {
        quantity: data.quantity,
        fullCylinders: data.fullCylinders,
        reason: data.reason
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', activeBranchId] })
      setIsAdjustStockOpen(false)
      toast.success('Stock adjusted successfully')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to adjust stock')
    }
  })

  const updatePriceMutation = useMutation({
    mutationFn: async (data: any) =>
      await productsApi.update(data.id, {
        price: data.price,
        emptyPrice: data.emptyPrice,
        wholesalePrice: data.wholesalePrice,
        wholesaleEmptyPrice: data.wholesaleEmptyPrice
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', activeBranchId] })
      setIsEditPriceOpen(false)
      toast.success('Prices updated successfully')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to update prices')
    }
  })

  // ── FIX: deleteProductMutation now has onSuccess and onError handlers ────────
  // The backend uses a "smart delete":
  //   • If the product has sales/transfer history → soft-delete (isActive = false)
  //   • If it has no history → hard-delete permanently from all branches
  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => await productsApi.delete(productId),
    onSuccess: (response: any) => {
      const result = response?.data
      queryClient.invalidateQueries({ queryKey: ['inventory', activeBranchId] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      setDeleteTarget(null)

      if (result?.softDeleted) {
        // Product had sales/transfer history — was deactivated, not hard-deleted
        toast.warning('Product deactivated', {
          description: result.message,
          duration: 6000,
        })
      } else {
        toast.success('Product permanently deleted from all branches.')
      }
    },
    onError: (error: any) => {
      setDeleteTarget(null)
      const msg = error?.response?.data?.message || 'Failed to delete product. Please try again.'
      toast.error('Delete failed', { description: msg })
    }
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => await productsApi.deleteCategory(categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Category deleted')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to delete category')
    }
  })

  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => await productsApi.createCategory(name, ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      setIsAddCategoryOpen(false)
      setNewCategoryName('')
      setIsLpgCategory(false)
      toast.success('Category created')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to create category')
    }
  })

  const createProductMutation = useMutation({
    mutationFn: async (data: any) => await productsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', activeBranchId] })
      setIsAddProductOpen(false)
      setNewProduct({ name: '', code: '', type: 'ACCESSORIES', categoryId: '', price: 0, emptyPrice: 0, wholesalePrice: 0, wholesaleEmptyPrice: 0, minStockLevel: 10 })
      toast.success('Product created and added to all branches')
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Failed to create product')
    }
  })

  const categoriesWithItems = useMemo(() => {
    if (!categories) return []
    return categories.map((cat: any) => {
      let items = inventory?.filter((inv: any) => inv.product?.categoryId === cat.id) || []
      if (search) {
        const term = search.toLowerCase()
        items = items.filter((item: any) =>
          item.product?.name?.toLowerCase().includes(term) ||
          item.product?.code?.toLowerCase().includes(term)
        )
      }
      return { ...cat, items }
    })
  }, [categories, inventory, search])

  const isSelectedLpg = selectedItem?.product?.category?.name.toUpperCase().includes('LPG')

  if (!activeBranchId && user?.role !== UserRole.BRANCH_MANAGER) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Select Branch</h1>
          <p className="text-muted-foreground">Choose a branch to manage its inventory</p>
        </div>
        {isLoadingBranches ? (
          <div className="p-8 text-center text-muted-foreground">Loading branches...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches?.map((branch: any) => (
              <Card key={branch.id} className="cursor-pointer hover:border-primary transition-colors duration-200" onClick={() => setActiveBranchId(branch.id)}>
                <CardHeader className="flex flex-row items-center space-y-0 pb-2">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{branch.name}</CardTitle>
                    <CardDescription>{branch.code}</CardDescription>
                  </div>
                  <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <Store className="h-5 w-5 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground truncate">{branch.address}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {user?.role !== UserRole.BRANCH_MANAGER && (
              <button onClick={() => setActiveBranchId('')} className="p-1 hover:bg-muted rounded-full transition-colors mr-1">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">
              {activeBranch ? `${activeBranch.name} Inventory` : 'Inventory'}
            </h1>
          </div>
        </div>

        {user?.role === UserRole.SUPER_ADMIN && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsAddCategoryOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Category
            </Button>
            <Button onClick={() => setIsAddProductOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Product
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-white p-3 rounded-lg border shadow-sm">
        <div className="flex w-full lg:w-auto gap-4">
          <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="w-full lg:w-80" />
          <Button variant={showLowStock ? "destructive" : "secondary"} onClick={() => setShowLowStock(!showLowStock)} className="whitespace-nowrap">
            <AlertTriangle className="w-4 h-4 mr-2" /> Low Stock
          </Button>
        </div>

        <div className="flex p-1 bg-muted/50 rounded-lg border w-full lg:w-auto">
          <button
            onClick={() => setPricingMode('RETAIL')}
            className={`flex-1 lg:px-6 py-1.5 text-sm font-bold rounded-md transition-all ${pricingMode === 'RETAIL' ? 'bg-white shadow text-primary' : 'text-muted-foreground hover:text-gray-900'}`}
          >
            Retail Prices
          </button>
          <button
            onClick={() => setPricingMode('WHOLESALE')}
            className={`flex-1 lg:px-6 py-1.5 text-sm font-bold rounded-md transition-all ${pricingMode === 'WHOLESALE' ? 'bg-purple-600 shadow text-white' : 'text-muted-foreground hover:text-gray-900'}`}
          >
            Wholesale Prices
          </button>
        </div>
      </div>

      {isLoadingInventory ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">Loading inventory...</CardContent></Card>
      ) : (
        <div className="space-y-10">
          {categoriesWithItems.map((category: any) => {
            const isLpgConfig = category.name.toUpperCase().includes('LPG')
            const currentPage = pageMap[category.id] || 1
            const itemsPerPage = 10
            const totalPages = Math.ceil(category.items.length / itemsPerPage)
            const paginatedItems = category.items.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

            return (
              <div key={category.id} className="flex flex-col rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
                <div className="bg-slate-50/80 p-4 border-b flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold tracking-tight text-primary">
                      {category.name}
                    </h2>
                    <Badge variant="outline" className="bg-background">
                      {category.items.length} Items
                    </Badge>
                  </div>

                  {user?.role === UserRole.SUPER_ADMIN && (
                    <Button
                      variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 h-8"
                      onClick={() => {
                        if (confirm(`Delete the "${category.name}" category?\n\nProducts inside will be unlinked but not deleted.`))
                          deleteCategoryMutation.mutate(category.id)
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                    </Button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/10 hover:bg-muted/10">
                        <TableHead className="w-[35%]">Product Name</TableHead>
                        <TableHead>
                          <span className={pricingMode === 'WHOLESALE' ? 'text-purple-600 font-bold' : ''}>
                            {pricingMode === 'WHOLESALE' ? 'Wholesale Price' : 'Retail Price'}
                          </span>
                        </TableHead>

                        {isLpgConfig ? (
                          <>
                            <TableHead className="text-blue-600 font-bold">REFILLS (Full)</TableHead>
                            <TableHead className="text-amber-600 font-bold">CYLINDERS (Empty)</TableHead>
                          </>
                        ) : (
                          <TableHead>Quantity</TableHead>
                        )}

                        <TableHead className="hidden sm:table-cell">Status</TableHead>
                        {user?.role === UserRole.SUPER_ADMIN && <TableHead className="text-right pr-6">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={isLpgConfig ? 6 : 5} className="text-center h-24 text-muted-foreground">
                            No products available.
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedItems.map((item: any) => {
                          const isLowStock = item.quantity <= item.minimumQuantity

                          const displayPrice = pricingMode === 'WHOLESALE'
                            ? (item.product?.wholesalePrice || item.product?.price)
                            : item.product?.price
                          const displayEmptyPrice = pricingMode === 'WHOLESALE'
                            ? (item.product?.wholesaleEmptyPrice || item.product?.emptyPrice)
                            : item.product?.emptyPrice

                          return (
                            <TableRow key={item.id} className="group">
                              <TableCell className="font-medium">
                                {item.product?.name}
                                {item.product?.code && <span className="block text-xs text-muted-foreground font-normal mt-0.5">{item.product.code}</span>}
                              </TableCell>

                              <TableCell className={`font-medium ${pricingMode === 'WHOLESALE' ? 'text-purple-700' : 'text-muted-foreground'}`}>
                                {Number(displayPrice).toLocaleString()}
                                {isLpgConfig && displayEmptyPrice != null && (
                                  <span className="block text-xs text-amber-600 mt-0.5">
                                    Empty: {Number(displayEmptyPrice).toLocaleString()}
                                  </span>
                                )}
                              </TableCell>

                              {isLpgConfig ? (
                                <>
                                  <TableCell className="text-lg font-bold text-blue-600">{item.fullCylinders || 0}</TableCell>
                                  <TableCell className={`text-lg font-bold ${item.emptyCylinders < 0 ? 'text-destructive bg-destructive/10 px-2 py-1 rounded' : 'text-amber-600'}`}>
                                    {Math.max(0, item.emptyCylinders || 0)}
                                  </TableCell>
                                </>
                              ) : (
                                <TableCell className={`text-lg font-bold ${isLowStock ? 'text-destructive' : ''}`}>{item.quantity}</TableCell>
                              )}

                              <TableCell className="hidden sm:table-cell">
                                {isLowStock
                                  ? <Badge variant="destructive" className="shadow-sm">Low ({item.minimumQuantity} min)</Badge>
                                  : <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-none">OK</Badge>}
                              </TableCell>

                              {user?.role === UserRole.SUPER_ADMIN && (
                                <TableCell className="text-right pr-4">
                                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      variant="ghost" size="icon" className="h-8 w-8 hover:bg-green-50"
                                      onClick={() => {
                                        setSelectedItem(item)
                                        setEditPrice(Number(item.product.price))
                                        setEditEmptyPrice(Number(item.product.emptyPrice || 0))
                                        setEditWholesalePrice(Number(item.product.wholesalePrice || item.product.price))
                                        setEditWholesaleEmptyPrice(Number(item.product.wholesaleEmptyPrice || item.product.emptyPrice || 0))
                                        setIsEditPriceOpen(true)
                                      }}
                                    >
                                      <DollarSign className="w-4 h-4 text-green-600" />
                                    </Button>
                                    <Button
                                      variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-50"
                                      onClick={() => {
                                        setSelectedItem(item)
                                        setAdjustQuantity(item.quantity)
                                        setAdjustFull(item.fullCylinders || 0)
                                        setAdjustReason('')
                                        setIsAdjustStockOpen(true)
                                      }}
                                    >
                                      <Settings2 className="w-4 h-4 text-blue-600" />
                                    </Button>

                                    {/* FIX: opens confirm dialog instead of using browser confirm() */}
                                    <Button
                                      variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50"
                                      onClick={() => setDeleteTarget({ id: item.product.id, name: item.product.name })}
                                    >
                                      <Trash2 className="w-4 h-4 text-destructive" />
                                    </Button>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── FIX: Delete Product Confirm Dialog ─────────────────────────────── */}
      {/* Replaces the old browser confirm() which gave no feedback on failure  */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" /> Delete Product
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="font-semibold text-base">
              "{deleteTarget?.name}"
            </p>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 space-y-1.5">
              <p className="font-bold">⚠️ This is a global action</p>
              <p>The product will be removed from <span className="font-semibold">all branches</span>, not just this one.</p>
              <p className="mt-1 text-amber-700">
                If this product has any sales or transfer history, it will be
                <span className="font-semibold"> deactivated</span> instead of permanently
                deleted — preserving your records while hiding it from active workflows.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteProductMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteProductMutation.mutate(deleteTarget.id)}
              disabled={deleteProductMutation.isPending}
            >
              {deleteProductMutation.isPending ? 'Deleting...' : 'Yes, Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Stock Dialog */}
      <Dialog open={isAdjustStockOpen} onOpenChange={setIsAdjustStockOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust Stock: {selectedItem?.product?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            {isSelectedLpg ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-blue-600">Full Cylinders (Refills)</label>
                  <Input type="number" value={adjustFull} onChange={(e) => setAdjustFull(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Total Shells (Full + Empty)</label>
                  <Input type="number" value={adjustQuantity} onChange={(e) => setAdjustQuantity(Number(e.target.value))} />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium">New Quantity</label>
                <Input type="number" value={adjustQuantity} onChange={(e) => setAdjustQuantity(Number(e.target.value))} />
              </div>
            )}
            <div className="space-y-2 pt-2">
              <label className="text-sm font-medium">Reason for Adjustment</label>
              <Input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="e.g. Physical recount..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdjustStockOpen(false)}>Cancel</Button>
            <Button onClick={() => adjustStockMutation.mutate({
              id: selectedItem.id,
              quantity: adjustQuantity,
              fullCylinders: isSelectedLpg ? adjustFull : undefined,
              reason: adjustReason
            })}>
              {adjustStockMutation.isPending ? 'Saving...' : 'Save Adjustment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Price Dialog */}
      <Dialog open={isEditPriceOpen} onOpenChange={setIsEditPriceOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit Pricing: {selectedItem?.product?.name}</DialogTitle></DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4 bg-muted/20 p-3 rounded-lg border">
              <div className="space-y-2 col-span-2"><h4 className="text-sm font-bold text-muted-foreground uppercase">Retail Pricing</h4></div>
              <div className="space-y-2">
                <label className="text-xs font-medium">{isSelectedLpg ? 'Refill Price' : 'Price'}</label>
                <Input type="number" value={editPrice} onChange={(e) => setEditPrice(Number(e.target.value))} />
              </div>
              {isSelectedLpg && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-amber-600">Empty Shell Price</label>
                  <Input type="number" value={editEmptyPrice} onChange={(e) => setEditEmptyPrice(Number(e.target.value))} />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 bg-purple-50/50 p-3 rounded-lg border border-purple-100">
              <div className="space-y-2 col-span-2"><h4 className="text-sm font-bold text-purple-700 uppercase">Wholesale Pricing</h4></div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-purple-900">{isSelectedLpg ? 'Refill Price' : 'Price'}</label>
                <Input type="number" className="border-purple-200" value={editWholesalePrice} onChange={(e) => setEditWholesalePrice(Number(e.target.value))} />
              </div>
              {isSelectedLpg && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-amber-700">Empty Shell Price</label>
                  <Input type="number" className="border-purple-200" value={editWholesaleEmptyPrice} onChange={(e) => setEditWholesaleEmptyPrice(Number(e.target.value))} />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditPriceOpen(false)}>Cancel</Button>
            <Button onClick={() => updatePriceMutation.mutate({
              id: selectedItem.product.id,
              price: editPrice,
              emptyPrice: isSelectedLpg ? editEmptyPrice : undefined,
              wholesalePrice: editWholesalePrice,
              wholesaleEmptyPrice: isSelectedLpg ? editWholesaleEmptyPrice : undefined
            })}>
              {updatePriceMutation.isPending ? 'Updating...' : 'Save Prices'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Product Dialog */}
      <Dialog open={isAddProductOpen} onOpenChange={setIsAddProductOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add New Product</DialogTitle></DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-medium">Product Name *</label>
                <Input placeholder="e.g. K-Gas 6kg Refill" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Product Code *</label>
                <Input placeholder="e.g. REF-6KG" value={newProduct.code} onChange={(e) => setNewProduct({ ...newProduct, code: e.target.value })} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Select onValueChange={(val) => setNewProduct({ ...newProduct, categoryId: val })}>
                  <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat: any) => (<SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-sm font-medium">Product Type</label>
                <Select value={newProduct.type} onValueChange={(val) => setNewProduct({ ...newProduct, type: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LPG_REFILL">LPG Refill / Cylinder</SelectItem>
                    <SelectItem value="ACCESSORIES">Accessories</SelectItem>
                    <SelectItem value="ELECTRONICS">Electronics</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-muted/20 p-3 rounded-lg border">
              <div className="col-span-2"><h4 className="text-sm font-bold text-muted-foreground uppercase">Retail Pricing</h4></div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Standard Price *</label>
                <Input type="number" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: Number(e.target.value) })} />
              </div>
              {newProduct.type === 'LPG_REFILL' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-amber-600">Empty Shell Price *</label>
                  <Input type="number" value={newProduct.emptyPrice} onChange={(e) => setNewProduct({ ...newProduct, emptyPrice: Number(e.target.value) })} />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 bg-purple-50/50 p-3 rounded-lg border border-purple-100">
              <div className="col-span-2"><h4 className="text-sm font-bold text-purple-700 uppercase">Wholesale Pricing</h4></div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-purple-900">Wholesale Price *</label>
                <Input type="number" className="border-purple-200" value={newProduct.wholesalePrice} onChange={(e) => setNewProduct({ ...newProduct, wholesalePrice: Number(e.target.value) })} />
              </div>
              {newProduct.type === 'LPG_REFILL' && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-amber-700">Wholesale Empty Shell *</label>
                  <Input type="number" className="border-purple-200" value={newProduct.wholesaleEmptyPrice} onChange={(e) => setNewProduct({ ...newProduct, wholesaleEmptyPrice: Number(e.target.value) })} />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddProductOpen(false)}>Cancel</Button>
            <Button
              disabled={!newProduct.name || !newProduct.code || createProductMutation.isPending}
              onClick={() => createProductMutation.mutate({
                ...newProduct,
                emptyPrice: newProduct.type === 'LPG_REFILL' ? newProduct.emptyPrice : undefined,
                wholesaleEmptyPrice: newProduct.type === 'LPG_REFILL' ? newProduct.wholesaleEmptyPrice : undefined
              })}
            >
              {createProductMutation.isPending ? 'Saving...' : 'Save Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Category</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Category Name</label>
              <Input placeholder="e.g. 50Kg" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <input type="checkbox" id="lpg-check" className="w-4 h-4" checked={isLpgCategory} onChange={(e) => setIsLpgCategory(e.target.checked)} />
              <label htmlFor="lpg-check" className="text-sm font-medium cursor-pointer">
                This is an LPG Category (enables Refill & Empty columns)
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddCategoryOpen(false)}>Cancel</Button>
            <Button onClick={() => createCategoryMutation.mutate(
              (isLpgCategory && !newCategoryName.toUpperCase().includes('LPG'))
                ? `${newCategoryName} LPG`
                : newCategoryName
            )}>
              Create Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Inventory
