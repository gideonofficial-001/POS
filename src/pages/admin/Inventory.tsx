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

const Inventory = () => {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [activeBranchId, setActiveBranchId] = useState<string>(
    user?.role === UserRole.BRANCH_MANAGER ? user.branchId || '' : ''
  )
  const [showLowStock, setShowLowStock] = useState(false)
  const [pageMap, setPageMap] = useState<Record<string, number>>({})

  // ==========================================
  // MODAL STATES
  // ==========================================
  const [selectedItem, setSelectedItem] = useState<any>(null)
  
  const [isAdjustStockOpen, setIsAdjustStockOpen] = useState(false)
  const [adjustQuantity, setAdjustQuantity] = useState<number>(0)
  const [adjustReason, setAdjustReason] = useState('')

  const [isEditPriceOpen, setIsEditPriceOpen] = useState(false)
  const [editPrice, setEditPrice] = useState<number>(0)

  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [isLpgCategory, setIsLpgCategory] = useState(false) // The new checkbox state

  const [isAddProductOpen, setIsAddProductOpen] = useState(false)
  const [newProduct, setNewProduct] = useState({
    name: '', code: '', type: 'ACCESSORIES', categoryId: '', price: 0, minStockLevel: 10
  })

  // ==========================================
  // DATA FETCHING
  // ==========================================
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

  // Notice we removed the role restriction so managers can see empty categories too
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await productsApi.getCategories()).data,
  })

  const activeBranch = branches?.find((b: any) => b.id === activeBranchId) || inventory?.[0]?.branch

  // ==========================================
  // MUTATIONS
  // ==========================================
  const adjustStockMutation = useMutation({
    mutationFn: async (data: { id: string, quantity: number, reason: string }) => 
      await inventoryApi.adjustStock(data.id, data.quantity, data.reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', activeBranchId] })
      setIsAdjustStockOpen(false)
    }
  })

  const updatePriceMutation = useMutation({
    mutationFn: async (data: { id: string, price: number }) => await productsApi.update(data.id, { price: data.price }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', activeBranchId] })
      setIsEditPriceOpen(false)
    }
  })

  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => await productsApi.delete(productId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory', activeBranchId] })
  })

  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => await productsApi.deleteCategory(categoryId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] })
  })

  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => await productsApi.createCategory(name, ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      setIsAddCategoryOpen(false)
      setNewCategoryName('')
      setIsLpgCategory(false)
    }
  })

  const createProductMutation = useMutation({
    mutationFn: async (data: any) => await productsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', activeBranchId] })
      setIsAddProductOpen(false)
      setNewProduct({ name: '', code: '', type: 'ACCESSORIES', categoryId: '', price: 0, minStockLevel: 10 })
    }
  })

  // ==========================================
  // DATA TRANSFORMATION (Empty Categories included)
  // ==========================================
  const categoriesWithItems = useMemo(() => {
    if (!categories) return []
    
    return categories.map((cat: any) => {
      // Find all inventory items that belong to this category
      let items = inventory?.filter((inv: any) => inv.product?.categoryId === cat.id) || []
      
      // Apply search filter
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


  // ==========================================
  // VIEW 1: Branch Selection (Admin/GM Only)
  // ==========================================
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
              <Card 
                key={branch.id} 
                className="cursor-pointer hover:border-primary transition-colors duration-200"
                onClick={() => setActiveBranchId(branch.id)}
              >
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

  // ==========================================
  // VIEW 2: Specific Branch Inventory
  // ==========================================
  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {user?.role !== UserRole.BRANCH_MANAGER && (
              <button 
                onClick={() => setActiveBranchId('')}
                className="p-1 hover:bg-muted rounded-full transition-colors mr-1"
              >
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

      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          placeholder="Search products..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full sm:flex-1"
        />
        <Button
          variant={showLowStock ? "destructive" : "secondary"}
          onClick={() => setShowLowStock(!showLowStock)}
          className="whitespace-nowrap"
        >
          <AlertTriangle className="w-4 h-4 mr-2" />
          Low Stock Only
        </Button>
      </div>

      {isLoadingInventory ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">Loading inventory...</CardContent></Card>
      ) : (
        <div className="space-y-10">
          {categoriesWithItems.map((category: any) => {
            const isLpgConfig = category.name.toUpperCase().includes('LPG');
            
            // Pagination Logic
            const currentPage = pageMap[category.id] || 1;
            const itemsPerPage = 10;
            const totalPages = Math.ceil(category.items.length / itemsPerPage);
            const paginatedItems = category.items.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

            return (
              <div key={category.id} className="flex flex-col rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
                
                {/* PROMINENT CATEGORY HEADER */}
                <div className="bg-slate-100/50 p-4 border-b flex items-center justify-between">
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
                      variant="ghost" 
                      size="sm" 
                      className="text-destructive hover:bg-destructive/10 h-8"
                      onClick={() => {
                        if(confirm(`Are you sure you want to delete the ${category.name} category?`)) {
                          deleteCategoryMutation.mutate(category.id)
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                    </Button>
                  )}
                </div>
                
                {/* CATEGORY TABLE */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="w-[35%]">Product Name</TableHead>
                        <TableHead>Price (KES)</TableHead>
                        
                        {/* DYNAMIC COLUMNS */}
                        {isLpgConfig ? (
                          <>
                            <TableHead className="text-blue-600 font-bold">REFILLS (Full)</TableHead>
                            <TableHead className="text-amber-600 font-bold">CYLINDERS (Empty)</TableHead>
                            <TableHead>Total Shells</TableHead>
                          </>
                        ) : (
                          <TableHead>Quantity</TableHead>
                        )}
                        
                        <TableHead className="hidden sm:table-cell">Status</TableHead>
                        {user?.role === UserRole.SUPER_ADMIN && (
                          <TableHead className="text-right pr-6">Actions</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={isLpgConfig ? 7 : 5} className="text-center h-24 text-muted-foreground">
                            No products available in this category.
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedItems.map((item: any) => {
                          const isLowStock = item.quantity <= item.minimumQuantity;
                          return (
                            <TableRow key={item.id} className="group">
                              <TableCell className="font-medium">
                                {item.product?.name}
                                {item.product?.code && (
                                  <span className="block text-xs text-muted-foreground font-normal mt-0.5">
                                    {item.product.code}
                                  </span>
                                )}
                              </TableCell>

                              <TableCell className="text-muted-foreground font-medium">
                                {Number(item.product?.price).toLocaleString()}
                              </TableCell>
                              
                              {/* DYNAMIC DATA CELLS */}
                              {isLpgConfig ? (
                                <>
                                  <TableCell className="text-lg font-bold text-blue-600">
                                    {item.fullCylinders || 0}
                                  </TableCell>
                                  <TableCell className="text-lg font-bold text-amber-600">
                                    {item.emptyCylinders || 0}
                                  </TableCell>
                                  <TableCell className="text-lg font-bold">
                                    {item.quantity}
                                  </TableCell>
                                </>
                              ) : (
                                <TableCell className={`text-lg font-bold ${isLowStock ? 'text-destructive' : ''}`}>
                                  {item.quantity}
                                </TableCell>
                              )}
                              
                              <TableCell className="hidden sm:table-cell">
                                {isLowStock ? (
                                  <Badge variant="destructive" className="shadow-sm">
                                    Low ({item.minimumQuantity} min)
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">
                                    OK
                                  </Badge>
                                )}
                              </TableCell>

                              {user?.role === UserRole.SUPER_ADMIN && (
                                <TableCell className="text-right pr-4">
                                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8 hover:bg-green-50"
                                      onClick={() => {
                                        setSelectedItem(item); setEditPrice(Number(item.product.price)); setIsEditPriceOpen(true);
                                      }}
                                    >
                                      <DollarSign className="w-4 h-4 text-green-600" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8 hover:bg-blue-50"
                                      onClick={() => {
                                        setSelectedItem(item); setAdjustQuantity(item.quantity); setAdjustReason('Physical stock recount'); setIsAdjustStockOpen(true);
                                      }}
                                    >
                                      <Settings2 className="w-4 h-4 text-blue-600" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8 hover:bg-red-50"
                                      onClick={() => {
                                        if(confirm(`Permanently delete ${item.product.name}?`)) deleteProductMutation.mutate(item.product.id)
                                      }}
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

                {/* PAGINATION FOOTER */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/20 border-t">
                    <span className="text-sm text-muted-foreground">
                      Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, category.items.length)} of {category.items.length} items
                    </span>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={currentPage === 1}
                        onClick={() => setPageMap(prev => ({ ...prev, [category.id]: currentPage - 1 }))}
                      >
                        Previous
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={currentPage === totalPages}
                        onClick={() => setPageMap(prev => ({ ...prev, [category.id]: currentPage + 1 }))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ==============================================
          MODALS
          ============================================== */}
      
      {/* 1. Add Category Dialog with the Checkbox */}
      <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Category</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Category Name</label>
              <Input placeholder="e.g. 50Kg" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
            </div>
            
            <div className="flex items-center space-x-2 pt-2">
              <input 
                type="checkbox" 
                id="lpg-check" 
                className="w-4 h-4 text-primary rounded border-gray-300"
                checked={isLpgCategory}
                onChange={(e) => setIsLpgCategory(e.target.checked)}
              />
              <label htmlFor="lpg-check" className="text-sm font-medium cursor-pointer">
                This is an LPG Category (Enable Refill & Empty Columns)
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddCategoryOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              // Smart append: if they checked the box but didn't write LPG, we append it for them.
              const finalName = (isLpgCategory && !newCategoryName.toUpperCase().includes('LPG')) 
                ? `${newCategoryName} LPG` 
                : newCategoryName;
              createCategoryMutation.mutate(finalName);
            }}>
              {createCategoryMutation.isPending ? 'Creating...' : 'Create Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. Adjust Stock Dialog */}
      <Dialog open={isAdjustStockOpen} onOpenChange={setIsAdjustStockOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust Stock: {selectedItem?.product?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">New Total Quantity</label>
              <Input type="number" value={adjustQuantity} onChange={(e) => setAdjustQuantity(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for Adjustment</label>
              <Input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="e.g. Physical recount..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdjustStockOpen(false)}>Cancel</Button>
            <Button onClick={() => adjustStockMutation.mutate({ id: selectedItem.id, quantity: adjustQuantity, reason: adjustReason })}>
              {adjustStockMutation.isPending ? 'Saving...' : 'Save Adjustment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. Edit Price Dialog */}
      <Dialog open={isEditPriceOpen} onOpenChange={setIsEditPriceOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Price: {selectedItem?.product?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Selling Price (KES)</label>
              <Input type="number" value={editPrice} onChange={(e) => setEditPrice(Number(e.target.value))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditPriceOpen(false)}>Cancel</Button>
            <Button onClick={() => updatePriceMutation.mutate({ id: selectedItem.product.id, price: editPrice })}>
              {updatePriceMutation.isPending ? 'Updating...' : 'Update Price'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. Add Product Dialog */}
      <Dialog open={isAddProductOpen} onOpenChange={setIsAddProductOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Product</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4 grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <label className="text-sm font-medium">Product Name</label>
              <Input placeholder="e.g. K-Gas 6kg Refill" value={newProduct.name} onChange={(e) => setNewProduct({...newProduct, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Product Code</label>
              <Input placeholder="e.g. REF-6KG-KGAS" value={newProduct.code} onChange={(e) => setNewProduct({...newProduct, code: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select onValueChange={(val) => setNewProduct({...newProduct, categoryId: val})}>
                <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
                <SelectContent>
                  {categories?.map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select value={newProduct.type} onValueChange={(val) => setNewProduct({...newProduct, type: val})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="LPG_REFILL">LPG Refill</SelectItem>
                  <SelectItem value="LPG_CYLINDER">New Cylinder</SelectItem>
                  <SelectItem value="ACCESSORIES">Accessories</SelectItem>
                  <SelectItem value="ELECTRONICS">Electronics</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Price (KES)</label>
              <Input type="number" value={newProduct.price} onChange={(e) => setNewProduct({...newProduct, price: Number(e.target.value)})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddProductOpen(false)}>Cancel</Button>
            <Button onClick={() => createProductMutation.mutate(newProduct)}>
              {createProductMutation.isPending ? 'Saving...' : 'Save Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Inventory
