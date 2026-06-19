import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { inventoryApi, branchesApi } from '@/api'
import { useAuthStore } from '@/store'
import { UserRole } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PackageSearch, AlertTriangle } from 'lucide-react'

const Inventory = () => {
  const { user } = useAuthStore()
  const [search, setSearch] = useState('')
  const [branchId, setBranchId] = useState(user?.branchId || '')
  const [showLowStock, setShowLowStock] = useState(false)

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const response = await branchesApi.getAll()
      return response.data
    },
    enabled: user?.role !== UserRole.BRANCH_MANAGER,
  })

  const { data: inventory, isLoading } = useQuery({
    queryKey: ['inventory', branchId, showLowStock],
    queryFn: async () => {
      const params: any = {}
      if (branchId) params.branchId = branchId
      if (showLowStock) params.lowStock = true
      const response = await inventoryApi.getAll(params)
      return response.data
    },
  })

  const filteredInventory = inventory?.filter((item: any) => {
    if (!search) return true
    const term = search.toLowerCase()
    return (
      item.product?.name?.toLowerCase().includes(term) ||
      item.product?.code?.toLowerCase().includes(term) ||
      item.branch?.name?.toLowerCase().includes(term)
    )
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inventory</h1>
        <p className="text-muted-foreground">View and manage stock levels</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full"
          />
        </div>
        {user?.role !== UserRole.BRANCH_MANAGER && (
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Branches</SelectItem>
              {branches?.map((b: any) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <button
          onClick={() => setShowLowStock(!showLowStock)}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${showLowStock ? 'bg-destructive/10 text-destructive' : 'bg-muted hover:bg-muted/80'}`}
        >
          <AlertTriangle className="w-4 h-4 inline mr-2" />
          Low Stock
        </button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading inventory...</div>
          ) : filteredInventory?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <PackageSearch className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No inventory items found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Min Level</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInventory?.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.product?.name}</TableCell>
                    <TableCell>{item.branch?.name}</TableCell>
                    <TableCell>{item.product?.category?.name || '-'}</TableCell>
                    <TableCell className="font-bold">{item.quantity}</TableCell>
                    <TableCell>{item.minimumQuantity}</TableCell>
                    <TableCell>
                      {item.quantity <= item.minimumQuantity ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="w-3 h-3" /> Low
                        </Badge>
                      ) : (
                        <Badge variant="success">OK</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default Inventory