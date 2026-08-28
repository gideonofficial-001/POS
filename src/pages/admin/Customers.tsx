import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { customersApi } from '@/api'
import { useAuthStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Plus, Phone, Mail, Store, Edit2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

const Customers = () => {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'OVERALL_MANAGER'
  
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  
  // Modals state
  const [editCustomer, setEditCustomer] = useState<any>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', address: '', notes: '', creditLimit: '' })

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const response = await customersApi.getAll()
      return response.data
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => customersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      setShowCreate(false)
      setFormData({ name: '', phone: '', email: '', address: '', notes: '', creditLimit: '' })
      toast.success('Customer added successfully')
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to add customer')
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => customersApi.update(data.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      setEditCustomer(null)
      toast.success('Customer updated successfully')
    },
    onError: (error: any) => toast.error(error.response?.data?.message || 'Failed to update customer')
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      setDeleteId(null)
      toast.success('Customer deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Cannot delete customer')
      setDeleteId(null)
    }
  })

  const handleEditOpen = (customer: any) => {
    setFormData({
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      notes: customer.notes || '',
      creditLimit: customer.creditLimit || '0'
    })
    setEditCustomer(customer)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload = { ...formData, creditLimit: Number(formData.creditLimit) || 0 }
    if (editCustomer) {
      updateMutation.mutate({ id: editCustomer.id, ...payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const filtered = customers?.filter((c: any) => {
    if (!search) return true
    const term = search.toLowerCase()
    return c.name?.toLowerCase().includes(term) || c.phone?.includes(term)
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground">Manage your customer database</p>
        </div>
        <Button onClick={() => { setEditCustomer(null); setFormData({ name: '', phone: '', email: '', address: '', notes: '', creditLimit: '' }); setShowCreate(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Add Customer
        </Button>
      </div>

      <Input placeholder="Search customers..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm bg-white" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered?.map((customer: any) => (
          <Card key={customer.id} className="hover:shadow-md transition-shadow bg-white">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-lg">{customer.name}</h3>
                  <Badge variant={customer.isActive ? 'default' : 'secondary'} className="mt-1">
                    {customer.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
              
              <div className="space-y-2 text-sm mt-4">
                <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-4 h-4" /> {customer.phone}</div>
                {customer.email && <div className="flex items-center gap-2 text-muted-foreground"><Mail className="w-4 h-4" /> {customer.email}</div>}
                {customer.address && <div className="flex items-center gap-2 text-muted-foreground"><Store className="w-4 h-4" /> {customer.address}</div>}
              </div>
              
              <div className="mt-4 pt-4 border-t flex justify-between text-sm">
                <span className="text-muted-foreground">Credit Limit</span>
                <span className="font-bold">KES {Number(customer.creditLimit).toLocaleString()}</span>
              </div>
              
              {customer.creditUsed > 0 && (
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Credit Used</span>
                  <span className="font-bold text-amber-600">KES {Number(customer.creditUsed).toLocaleString()}</span>
                </div>
              )}

              {isAdmin && (
                <div className="flex gap-2 mt-4 pt-4 border-t">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEditOpen(customer)}>
                    <Edit2 className="w-3 h-3 mr-2" /> Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setDeleteId(customer.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered?.length === 0 && !isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No customers found.</p>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={showCreate || !!editCustomer} onOpenChange={(open) => { if (!open) { setShowCreate(false); setEditCustomer(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><Label>Full Name *</Label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required /></div>
            <div className="space-y-2"><Label>Phone *</Label><Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} required /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
            <div className="space-y-2"><Label>Address</Label><Input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
            <div className="space-y-2"><Label>Credit Limit</Label><Input type="number" value={formData.creditLimit} onChange={e => setFormData({...formData, creditLimit: e.target.value})} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowCreate(false); setEditCustomer(null); }}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editCustomer ? 'Update Customer' : 'Add Customer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Customer</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this customer? This action cannot be undone. If they have a transaction history, deletion will fail.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              {deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Customers
