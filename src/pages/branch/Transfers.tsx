import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { transfersApi, branchesApi, inventoryApi } from '@/api'
import { useAuthStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { ArrowLeftRight, Plus, Package } from 'lucide-react'

const Transfers = () => {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [toBranchId, setToBranchId] = useState('')
  const [transferItems, setTransferItems] = useState<{productId: string; quantity: number}[]>([])

  const { data: transfers } = useQuery({
    queryKey: ['transfers'],
    queryFn: async () => {
      const response = await transfersApi.getAll({ fromBranchId: user?.branchId })
      return response.data
    },
  })

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const response = await branchesApi.getAll()
      return response.data?.filter((b: any) => b.id !== user?.branchId)
    },
  })

  const { data: inventory } = useQuery({
    queryKey: ['inventory', user?.branchId],
    queryFn: async () => {
      if (!user?.branchId) return []
      const response = await inventoryApi.getAll({ branchId: user.branchId })
      return response.data
    },
    enabled: !!user?.branchId,
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => transfersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] })
      setShowCreate(false)
      setToBranchId('')
      setTransferItems([])
      toast.success('Transfer request submitted')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create transfer')
    },
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED': case 'COMPLETED': return <Badge variant="success">{status}</Badge>
      case 'PENDING': return <Badge variant="warning">Pending</Badge>
      case 'REJECTED': return <Badge variant="destructive">Rejected</Badge>
      default: return <Badge>{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transfers</h1>
          <p className="text-muted-foreground">Transfer products between branches</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Transfer
        </Button>
      </div>

      <div className="space-y-3">
        {transfers?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No transfers yet</p>
          </div>
        ) : (
          transfers?.map((transfer: any) => (
            <Card key={transfer.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold">{transfer.transferCode}</h3>
                      {getStatusBadge(transfer.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      From: {transfer.fromBranch?.name} To: {transfer.toBranch?.name}
                    </p>
                    <p className="text-sm mt-1">{transfer.items?.length} product(s)</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(transfer.createdAt)}</p>
                  </div>
                  <ArrowLeftRight className="w-6 h-6 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Transfer</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>To Branch *</Label>
              <Select value={toBranchId} onValueChange={setToBranchId}>
                <SelectTrigger><SelectValue placeholder="Select destination branch" /></SelectTrigger>
                <SelectContent>
                  {branches?.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Select Products</Label>
              <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-2">
                {inventory?.map((inv: any) => (
                  <div key={inv.id} className="flex items-center justify-between p-2 hover:bg-muted rounded">
                    <div>
                      <p className="text-sm font-medium">{inv.product?.name}</p>
                      <p className="text-xs text-muted-foreground">Stock: {inv.quantity}</p>
                    </div>
                    <Input
                      type="number"
                      className="w-20 h-8"
                      min={0}
                      max={inv.quantity}
                      placeholder="Qty"
                      onChange={e => {
                        const qty = Number(e.target.value)
                        setTransferItems(prev => {
                          const existing = prev.find(i => i.productId === inv.productId)
                          if (qty <= 0) return prev.filter(i => i.productId !== inv.productId)
                          if (existing) return prev.map(i => i.productId === inv.productId ? {...i, quantity: qty} : i)
                          return [...prev, { productId: inv.productId, quantity: qty }]
                        })
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button
                onClick={() => createMutation.mutate({
                  fromBranchId: user?.branchId,
                  toBranchId,
                  items: transferItems.filter(i => i.quantity > 0),
                })}
                disabled={!toBranchId || transferItems.filter(i => i.quantity > 0).length === 0 || createMutation.isPending}
              >
                Submit Transfer
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Transfers