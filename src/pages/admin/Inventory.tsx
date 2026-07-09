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

  // ==========================================
  // MODAL STATES
  // ==========================================
  const [selectedItem, setSelectedItem] = useState<any>(null)
  
  // Adjust Stock
  const [isAdjustStockOpen, setIsAdjustStockOpen] = useState(false)
  const [adjustQuantity, setAdjustQuantity] = useState<number>(0)
  const [adjustReason, setAdjustReason] = useState('')

  // Edit Price
  const [isEditPriceOpen, setIsEditPriceOpen] = useState(false)
  const [editPrice, setEditPrice] = useState<number>(0)

  // Add Category
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  // Add Product
  const [isAddProductOpen, setIsAddProductOpen] = useState(false)
  const [newProduct, setNewProduct] = useState({
    name: '',
    code: '',
    type: 'ACCESSORIES',
    categoryId: '',
    price: 0,
    minStockLevel: 10
  })

  // ==========================================
  // DATA FETCHING
  // ==========================================
  const { data: branches, isLoading: isLoadingBranches } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const response = await branchesApi.getAll()
      return response.data
    },
    enabled: user?.role !== UserRole.BRANCH_MANAGER && !activeBranchId,
  })

  const { data: inventory, isLoading: isLoadingInventory } = useQuery({
    queryKey: ['inventory', activeBranchId, showLowStock],
    queryFn: async () => {
      const params: any = { branchId: activeBranchId }
      if (showLowStock) params.lowStock = true
      const response = await inventoryApi.getAll(params)
      return response.data
    },
    enabled: !!activeBranchId,
  })

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await productsApi.getCategories()
      return response.data
    },
    enabled: user?.role === UserRole.SUPER_ADMIN,
  })

  const activeBranch = branches?.find((b: any) => b.id === activeBranchId) || inventory?.[0]?.branch

  // ==========================================
  // MUTATIONS (API Updates)
  // ==========================================
  const adjustStockMutation = useMutation({
    mutationFn: async (data: { id: string, quantity: number, reason: string }) => {
      return await inventoryApi.adjustStock(data.id, data.quantity, data.reason)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', activeBranchId] })
      setIsAdjustStockOpen(false)
    }
  })

  const updatePriceMutation = useMutation({
    mutationFn: async (data: { id: string, price: number }) => {
      return await productsApi.update(data.id, { price: data.price })
    },
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory', activeBranchId] })
  })

  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => await productsApi.createCategory(name, ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['inventory', activeBranchId] })
      setIsAddCategoryOpen(false)
      setNewCategoryName('')
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
  // DATA TRANSFORMATION
  // ==========================================
  const groupedInventory = useMemo(() => {
    if (!inventory) return {}
    const filtered = inventory.filter((item: any) => {
      if (!search) return true
      const term = search.toLowerCase()
      return (
        item.product?.name?.toLowerCase().includes(term) ||
        item.product?.code?.toLowerCase().includes(term)
      )
    })

    return filtered.reduce((acc: any, item: any) => {
      const catName = item.product?.category?.name || 'Uncategorized'
      const catId = item.product?.categoryId || 'uncategorized'
      
      if (!acc[catName]) acc[catName] = { id: catId, items: [] }
      acc[catName].items.push(item)
      return acc
    }, {})
  }, [inventory, search])


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
    <div className="space-y-6">
      {/* Header section with Global Add Buttons */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {user?.role !== UserRole.BRANCH_MANAGER && (
              <button 
                onClick={() => setActiveBranchId('')}
                className="p-1 hover:bg-muted rounded-full transition-colors mr-1"
                title="Back to Branches"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h1 className="text-2xl font-bold">
              {activeBranch ? `${activeBranch.name} Inventory` : 'Inventory'}
            </h1>
          </div>
          <p className="text-muted-foreground sm:ml-9">Manage stock levels and catalog</p>
        </div>
        
        {/* Admin Global Actions */}
        {user?.role === UserRole.SUPER_ADMIN && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsAddCategoryOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Category
            </Button>
            <Button size="sm" onClick={() => setIsAddProductOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Product
            </Button>
          </div>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full"
          />
        </div>
        <button
          onClick={() => setShowLowStock(!showLowStock)}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
            showLowStock ? 'bg-destructive/10 text-destructive' : 'bg-muted hover:bg-muted/80'
          }`}
        >
          <AlertTriangle className="w-4 h-4 inline mr-2" />
          Low Stock Only
        </button>
      </div>

      {/* Inventory Grouped by Category */}
      {isLoadingInventory ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Loading inventory...</CardContent></Card>
      ) : Object.keys(groupedInventory).length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <PackageSearch className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No inventory items found for this branch.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedInventory).map(([categoryName, categoryData]: [string, any]) => (
            <div key={categoryName} className="space-y-3">
              
              {/* Category Header with Admin Delete Button */}
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-primary">
                  {categoryName}
                  <Badge variant="secondary" className="ml-2 rounded-full px-2 py-0.5 text-xs">
                    {categoryData.items.length} items
                  </Badge>
                </h3>
                {user?.role === UserRole.SUPER_ADMIN && categoryData.id !== 'uncategorized' && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if(confirm(`Are you sure you want to delete the ${categoryName} category?`)) {
                        deleteCategoryMutation.mutate(categoryData.id)
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Delete Category
                  </Button>
                )}
              </div>
              
              {/* Category Table */}
              <Card className="overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="w-[35%]">Product Name</TableHead>
                      <TableHead>Price (KES)</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead className="hidden sm:table-cell">Status</TableHead>
                      {/* Action Column for Admins */}
                      {user?.role === UserRole.SUPER_ADMIN && (
                        <TableHead className="text-right">Actions</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryData.items.map((item: any) => {
                      const isLowStock = item.quantity <= item.minimumQuantity;
                      return (
                        <TableRow key={item.id} className="group">
                          <TableCell className="font-medium">
                            {item.product?.name}
                            {item.product?.code && (
                              <span className="block text-xs text-muted-foreground font-normal">
                                {item.product.code}
                              </span>
                            )}
                          </TableCell>

                          <TableCell className="font-medium text-muted-foreground">
                            {Number(item.product?.price).toLocaleString()}
                          </TableCell>
                          
                          <TableCell className={`text-lg font-bold ${isLowStock ? 'text-destructive' : ''}`}>
                            {item.quantity}
                          </TableCell>
                          
                          <TableCell className="hidden sm:table-cell">
                            {isLowStock ? (
                              <Badge variant="destructive" className="gap-1 shadow-sm">
                                <AlertTriangle className="w-3 h-3 hidden sm:inline" /> Low
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20">
                                OK
                              </Badge>
                            )}
                          </TableCell>

                          {/* Admin Action Buttons */}
                          {user?.role === UserRole.SUPER_ADMIN && (
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  className="h-8 w-8"
                                  onClick={() => {
                                    setSelectedItem(item)
                                    setEditPrice(Number(item.product.price))
                                    setIsEditPriceOpen(true)
                                  }}
                                  title="Edit Price"
                                >
                                  <DollarSign className="w-4 h-4 text-green-600" />
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  className="h-8 w-8"
                                  onClick={() => {
                                    setSelectedItem(item)
                                    setAdjustQuantity(item.quantity)
                                    setAdjustReason('Physical stock recount')
                                    setIsAdjustStockOpen(true)
                                  }}
                                  title="Adjust Stock"
                                >
                                  <Settings2 className="w-4 h-4 text-blue-600" />
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  className="h-8 w-8 hover:bg-destructive hover:text-white"
                                  onClick={() => {
                                    if(confirm(`Are you sure you want to permanently delete ${item.product.name}?`)) {
                                      deleteProductMutation.mutate(item.product.id)
                                    }
                                  }}
                                  title="Delete Product globally"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* ==============================================
          ALL ADMIN DIALOGS / MODALS
          ============================================== */}

      {/* 1. Adjust Stock Dialog */}
      <Dialog open={isAdjustStockOpen} onOpenChange={setIsAdjustStockOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock: {selectedItem?.product?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">New Quantity</label>
              <Input 
                type="number" 
                value={adjustQuantity} 
                onChange={(e) => setAdjustQuantity(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Current quantity: {selectedItem?.quantity}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for Adjustment</label>
              <Input 
                value={adjustReason} 
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="e.g. Physical recount, Damaged goods..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdjustStockOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => adjustStockMutation.mutate({ 
                id: selectedItem.id, 
                quantity: adjustQuantity, 
                reason: adjustReason 
              })}
              disabled={adjustStockMutation.isPending}
            >
              {adjustStockMutation.isPending ? 'Saving...' : 'Save Adjustment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. Edit Price Dialog */}
      <Dialog open={isEditPriceOpen} onOpenChange={setIsEditPriceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Price: {selectedItem?.product?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Selling Price (KES)</label>
              <Input 
                type="number" 
                value={editPrice} 
                onChange={(e) => setEditPrice(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground text-amber-600">
                Warning: Changing this updates the price globally across all branches.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditPriceOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => updatePriceMutation.mutate({ 
                id: selectedItem.product.id, 
                price: editPrice
              })}
              disabled={updatePriceMutation.isPending}
            >
              {updatePriceMutation.isPending ? 'Updating...' : 'Update Price'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. Add Category Dialog */}
      <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Category Name</label>
              <Input 
                placeholder="e.g. 6kg Cylinders, Regulators"
                value={newCategoryName} 
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddCategoryOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => createCategoryMutation.mutate(newCategoryName)}
              disabled={createCategoryMutation.isPending || !newCategoryName}
            >
              {createCategoryMutation.isPending ? 'Creating...' : 'Create Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. Add Product Dialog */}
      <Dialog open={isAddProductOpen} onOpenChange={setIsAddProductOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <label className="text-sm font-medium">Product Name</label>
              <Input 
                placeholder="e.g. K-Gas 6kg Refill"
                value={newProduct.name} 
                onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Product Code</label>
              <Input 
                placeholder="e.g. REF-6KG-KGAS"
                value={newProduct.code} 
                onChange={(e) => setNewProduct({...newProduct, code: e.target.value})}
              />
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
              <Input 
                type="number"
                value={newProduct.price} 
                onChange={(e) => setNewProduct({...newProduct, price: Number(e.target.value)})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddProductOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => createProductMutation.mutate(newProduct)}
              disabled={createProductMutation.isPending || !newProduct.name || !newProduct.code}
            >
              {createProductMutation.isPending ? 'Saving...' : 'Save Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}

export default Inventory
