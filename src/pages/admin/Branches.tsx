import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { branchesApi, usersApi } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Edit, MapPin, Store } from 'lucide-react'
import { toast } from 'sonner'

const Branches = () => {
  const queryClient = useQueryClient()
  
  // Modals state
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState<any>(null)
  
  // Form states
  const [newBranch, setNewBranch] = useState({ name: '', code: '', address: '', phone: '', email: '', managerId: 'none' })
  const [editForm, setEditForm] = useState({ name: '', code: '', address: '', phone: '', email: '', managerId: 'none' })

  // Fetch branches
  const { data: branches, isLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const response = await branchesApi.getAll()
      return response.data
    },
  })

  // Fetch users (to populate the manager dropdown)
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await usersApi.getAll()
      return response.data
    },
  })

  // Filter for potential managers (Branch Managers or Overall Managers)
  const availableManagers = users?.filter((u: any) => 
    u.role === 'BRANCH_MANAGER' || u.role === 'OVERALL_MANAGER'
  ) || []

  const createMutation = useMutation({
    mutationFn: (data: any) => {
      const payload = { ...data }
      if (payload.managerId === 'none') delete payload.managerId
      return branchesApi.create(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] })
      setShowCreate(false)
      setNewBranch({ name: '', code: '', address: '', phone: '', email: '', managerId: 'none' })
      toast.success('Branch created successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create branch')
    },
  })

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => {
      const payload = { ...data };

      // The branch code is immutable. Remove it before sending to backend.
      delete payload.code;

      // Convert "none" back to null for the backend.
      if (payload.managerId === 'none') {
        payload.managerId = null;
      }

      return branchesApi.update(id, payload);
    },
    onSuccess: () => {
      toast.success('Branch updated successfully');
      setShowEdit(null); // Fixed the undefined function error here!
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
    onError: (error: any) => {
      toast.error(
        'Failed to update branch',
        {
          description:
            error?.response?.data?.message ||
            'Something went wrong while updating the branch.',
        }
      );
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBranch.name || !newBranch.code) {
      toast.error('Branch Name and Code are required')
      return
    }
    createMutation.mutate(newBranch)
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editForm.name) {
      toast.error('Branch Name is required')
      return
    }
    editMutation.mutate({ id: showEdit.id, data: editForm })
  }

  const openEditModal = (branch: any) => {
    setShowEdit(branch)
    setEditForm({
      name: branch.name,
      code: branch.code,
      address: branch.address || '',
      phone: branch.phone || '',
      email: branch.email || '',
      managerId: branch.managerId || 'none'
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Branches</h1>
          <p className="text-muted-foreground">Manage your physical store locations</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Branch
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading branches...</div>
          ) : branches?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No branches found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Branch Name</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches?.map((branch: any) => (
                  <TableRow key={branch.id}>
                    <TableCell className="font-mono text-sm font-bold text-primary">{branch.code}</TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Store className="w-4 h-4 text-muted-foreground" />
                        {branch.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      {branch.manager ? (
                        <span className="text-sm">{branch.manager.firstName} {branch.manager.lastName}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        {branch.address || 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={branch.isActive ? "success" : "secondary"}>
                        {branch.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Edit Branch" onClick={() => openEditModal(branch)}>
                          <Edit className="w-4 h-4 text-blue-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Branch Dialog */}
      <Dialog open={!!showEdit} onOpenChange={() => setShowEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Branch Details</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Branch Name *</Label>
                <Input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>Branch Code</Label>
                <Input value={editForm.code} disabled className="bg-muted cursor-not-allowed" />
                <p className="text-[10px] text-muted-foreground">Branch codes cannot be changed.</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Physical Address</Label>
              <Input value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contact Phone</Label>
                <Input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Branch Manager</Label>
                <Select value={editForm.managerId} onValueChange={v => setEditForm({...editForm, managerId: v})}>
                  <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Unassigned --</SelectItem>
                    {availableManagers.map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>{m.firstName} {m.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setShowEdit(null)}>Cancel</Button>
              <Button type="submit" disabled={editMutation.isPending}>
                {editMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Branch</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Branch Name *</Label>
                <Input value={newBranch.name} onChange={e => setNewBranch({...newBranch, name: e.target.value})} required />
              </div>
              <div className="space-y-2">
                <Label>Branch Code *</Label>
                <Input value={newBranch.code} onChange={e => setNewBranch({...newBranch, code: e.target.value})} required />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Physical Address</Label>
              <Input value={newBranch.address} onChange={e => setNewBranch({...newBranch, address: e.target.value})} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contact Phone</Label>
                <Input value={newBranch.phone} onChange={e => setNewBranch({...newBranch, phone: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Assign Manager (Optional)</Label>
                <Select value={newBranch.managerId} onValueChange={v => setNewBranch({...newBranch, managerId: v})}>
                  <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- Unassigned --</SelectItem>
                    {availableManagers.map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>{m.firstName} {m.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>Create Branch</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Branches
