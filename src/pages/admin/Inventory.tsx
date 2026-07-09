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

  // Track pagination page for each category independently
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
  // MUTATIONS
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

  return (
    <div className="space-y-6 pb-10">
      {/* Header section */}
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
      ) : Object.keys(groupedInventory).length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <PackageSearch className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg">No inventory items found for this branch.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-10">
          {Object.entries(groupedInventory).map(([categoryName, categoryData]: [string, any]) => {
            // Pagination Logic
            const currentPage = pageMap[categoryName] || 1;
            const itemsPerPage = 10;
            const totalPages = Math.ceil(categoryData.items.length / itemsPerPage);
            const paginatedItems = categoryData.items.slice(
              (currentPage - 1) * itemsPerPage,
              currentPage * itemsPerPage
            );

            return (
              <div key={categoryName} className="flex flex-col rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
                
                {/* PROMINENT CATEGORY HEADER */}
                <div className="bg-slate-100/50 dark:bg-slate-800/50 p-4 border-b flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold tracking-tight text-primary">
                      {categoryName}
                    </h2>
                    <Badge variant="outline" className="bg-background">
                      {categoryData.items.length} Items
                    </Badge>
                  </div>
                  
                  {user?.role === UserRole.SUPER_ADMIN && categoryData.id !== 'uncategorized' && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-destructive hover:bg-destructive/10 h-8"
                      onClick={() => {
                        if(confirm(`Are you sure you want to delete the ${categoryName} category?`)) {
                          deleteCategoryMutation.mutate(categoryData.id)
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
                        <TableHead>Quantity</TableHead>
                        <TableHead className="hidden sm:table-cell">Status</TableHead>
                        {user?.role === UserRole.SUPER_ADMIN && (
                          <TableHead className="text-right pr-6">Actions</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedItems.map((item: any) => {
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
                            
                            <TableCell className={`text-lg font-bold ${isLowStock ? 'text-destructive' : ''}`}>
                              {item.quantity}
                            </TableCell>
                            
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
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* PAGINATION FOOTER */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/20 border-t">
                    <span className="text-sm text-muted-foreground">
                      Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, categoryData.items.length)} of {categoryData.items.length} items
                    </span>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={currentPage === 1}
                        onClick={() => setPageMap(prev => ({ ...prev, [categoryName]: currentPage - 1 }))}
                      >
                        Previous
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={currentPage === totalPages}
                        onClick={() => setPageMap(prev => ({ ...prev, [categoryName]: currentPage + 1 }))}
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
      {/* 1. Adjust Stock Dialog */}
      <Dialog open={isAdjustStockOpen} onOpenChange={setIsAdjustStockOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust Stock: {selectedItem?.product?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">New Quantity</label>
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

      {/* 2. Edit Price Dialog */}
      <Dialog open={isEditPriceOpen} onOpenChange={setIsEditPriceOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Price: {selectedItem?.product?.name}</Dialog