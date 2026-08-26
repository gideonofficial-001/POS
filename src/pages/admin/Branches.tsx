import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { branchesApi } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Eye, Power } from 'lucide-react'
import { toast } from 'sonner'

const Branches = () => {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [showDetail, setShowDetail] = useState<string | null>(null)
  const [newBranch, setNewBranch] = useState({ name: '', code: '', address: '', phone: '', email: '' })

  const { data: branches, isLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const response = await branchesApi.getAll()
      return response.data
    },
  })

  const { data: branchDetail } = useQuery({
    queryKey: ['branch', showDetail],
    queryFn: async () => {
      if (!showDetail) return null
      const response = await branchesApi.getById(showDetail)
      return response.data
    },
    enabled: !!showDetail,
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => branchesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] })
      setShowCreate(false)
      setNewBranch({ name: '', code: '', address: '', phone: '', email: '' })
      toast.success('Branch created successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create branch')
    },
  })

  const toggleMutation = useMutation({
    mutationFn: (id: string) => branchesApi.toggleStatus(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] })
      toast.success('Branch status updated')
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Branches</h1>
          <p className="text-muted-foreground">Manage your business branches</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Branch
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {branches?.map((branch: any) => (
          <Card key={branch.id} className={`hover:shadow-md transition-shadow ${!branch.isActive ? 'opacity-60' : ''}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold">{branch.name}</h3>
                  <p className="text-sm text-muted-foreground">{branch.code}</p>
                </div>
                <Badge variant={branch.isActive ? 'success' : 'secondary'}>
                  {branch.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{branch.address}</p>
              <div className="flex items-center justify-between text-sm">
                <span>{branch._count?.users || 0} staff</span>
                <span>{branch._count?.inventory || 0} products</span>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowDetail(branch.id)}>
                  <Eye className="w-4 h-4 mr-1" /> View
                </Button>
                <Button variant="outline" size="sm" onClick={() => toggleMutation.mutate(branch.id)}>
                  <Power className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {branches?.length === 0 && !isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No branches found. Create your first branch to get started.</p>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create New Branch</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(newBranch) }} className="space-y-4">
            <div className="space-y-2"><Label>Name *</Label><Input value={newBranch.name} onChange={e => setNewBranch({...newBranch, name: e.target.value})} /></div>
            <div className="space-y-2"><Label>Code *</Label><Input value={newBranch.code} onChange={e => setNewBranch({...newBranch, code: e.target.value})} placeholder="BR01" /></div>
            <div className="space-y-2"><Label>Address *</Label><Input value={newBranch.address} onChange={e => setNewBranch({...newBranch, address: e.target.value})} /></div>
            <div className="space-y-2"><Label>Phone *</Label><Input value={newBranch.phone} onChange={e => setNewBranch({...newBranch, phone: e.target.value})} /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={newBranch.email} onChange={e => setNewBranch({...newBranch, email: e.target.value})} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>Create Branch</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!showDetail} onOpenChange={() => setShowDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{branchDetail?.name}</DialogTitle></DialogHeader>
          {branchDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Code:</span> {branchDetail.code}</div>
                <div><span className="text-muted-foreground">Status:</span> <Badge variant={branchDetail.isActive ? 'success' : 'secondary'}>{branchDetail.isActive ? 'Active' : 'Inactive'}</Badge></div>
                <div><span className="text-muted-foreground">Address:</span> {branchDetail.address}</div>
                <div><span className="text-muted-foreground">Phone:</span> {branchDetail.phone}</div>
                <div><span className="text-muted-foreground">Manager:</span> {branchDetail.manager?.firstName ? `${branchDetail.manager.firstName} ${branchDetail.manager.lastName}` : 'Unassigned'}</div>
              </div>
              <div>
                <h4 className="font-medium mb-2">Inventory</h4>
                {branchDetail.inventory?.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No inventory items</p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {branchDetail.inventory?.map((inv: any) => (
                      <div key={inv.id} className="flex justify-between text-sm p-2 bg-muted rounded">
                        <span>{inv.product?.name}</span>
                        <span className="font-medium">Qty: {inv.quantity}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Branches