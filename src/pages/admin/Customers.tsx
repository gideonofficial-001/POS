import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { customersApi } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Phone, Mail, Store } from 'lucide-react'
import { toast } from 'sonner'

const Customers = () => {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  const [newCustomer, setNewCustomer] = useState({ fullName: '', phone: '', email: '', businessName: '', address: '', creditLimit: '' })

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
      setNewCustomer({ fullName: '', phone: '', email: '', businessName: '', address: '', creditLimit: '' })
      toast.success('Customer added successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to add customer')
    },
  })

  const filtered = customers?.filter((c: any) => {
    if (!search) return true
    const term = search.toLowerCase()
    return c.fullName?.toLowerCase().includes(term) || c.phone?.includes(term) || c.customerCode?.toLowerCase().includes(term)
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground">Manage invoice-eligible customers</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Customer
        </Button>
      </div>

      <Input placeholder="Search customers..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered?.map((customer: any) => (
          <Card key={customer.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold">{customer.fullName}</h3>
                  <p className="text-xs text-muted-foreground">{customer.customerCode}</p>
                </div>
                <Badge variant={customer.isInvoiceEligible ? 'success' : 'secondary'}>
                  {customer.isInvoiceEligible ? 'Invoice OK' : 'Not Eligible'}
                </Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-4 h-4" /> {customer.phone}
                </div>
                {customer.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-4 h-4" /> {customer.email}
                  </div>
                )}
                {customer.businessName && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Store className="w-4 h-4" /> {customer.businessName}
                  </div>
                )}
              </div>
              <div className="mt-3 pt-3 border-t flex justify-between text-sm">
                <span className="text-muted-foreground">Credit Limit</span>
                <span className="font-bold">KES {Number(customer.creditLimit).toLocaleString()}</span>
              </div>
              {customer.outstandingBalance > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Outstanding</span>
                  <span className="font-bold text-destructive">KES {Number(customer.outstandingBalance).toLocaleString()}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered?.length === 0 && !isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <p>No customers found. Add your first customer to get started.</p>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Customer</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate({...newCustomer, creditLimit: Number(newCustomer.creditLimit) || 0}) }} className="space-y-4">
            <div className="space-y-2"><Label>Full Name *</Label><Input value={newCustomer.fullName} onChange={e => setNewCustomer({...newCustomer, fullName: e.target.value})} required /></div>
            <div className="space-y-2"><Label>Phone *</Label><Input value={newCustomer.phone} onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} required /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={newCustomer.email} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} /></div>
            <div className="space-y-2"><Label>Business Name</Label><Input value={newCustomer.businessName} onChange={e => setNewCustomer({...newCustomer, businessName: e.target.value})} /></div>
            <div className="space-y-2"><Label>Address</Label><Input value={newCustomer.address} onChange={e => setNewCustomer({...newCustomer, address: e.target.value})} /></div>
            <div className="space-y-2"><Label>Credit Limit</Label><Input type="number" value={newCustomer.creditLimit} onChange={e => setNewCustomer({...newCustomer, creditLimit: e.target.value})} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>Add Customer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Customers