import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invoicesApi } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { FileText, Plus, Phone, Mail } from 'lucide-react'

const Invoices = () => {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [newInvoice, setNewInvoice] = useState({ customerName: '', customerPhone: '', customerEmail: '', amount: '', dueDate: '', notes: '' })

  const { data: invoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const response = await invoicesApi.getAll()
      return response.data
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => invoicesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      setShowCreate(false)
      setNewInvoice({ customerName: '', customerPhone: '', customerEmail: '', amount: '', dueDate: '', notes: '' })
      toast.success('Invoice created and SMS sent to customer')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create invoice')
    },
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID': return <Badge variant="success">Paid</Badge>
      case 'PENDING': return <Badge variant="warning">Pending</Badge>
      case 'SENT': return <Badge variant="default">Sent</Badge>
      case 'OVERDUE': return <Badge variant="destructive">Overdue</Badge>
      default: return <Badge>{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-muted-foreground">Manage customer invoices</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Invoice
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {invoices?.map((invoice: any) => (
          <Card key={invoice.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold">{invoice.invoiceCode}</h3>
                  <p className="text-xs text-muted-foreground">{formatDate(invoice.createdAt)}</p>
                </div>
                {getStatusBadge(invoice.status)}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  {invoice.customerName}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="w-4 h-4" />
                  {invoice.customerPhone}
                </div>
                {invoice.customerEmail && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    {invoice.customerEmail}
                  </div>
                )}
              </div>
              <div className="mt-4 pt-3 border-t flex justify-between items-center">
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(invoice.amount)}</p>
                  <p className="text-xs text-muted-foreground">Due: {formatDate(invoice.dueDate)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {invoices?.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>No invoices yet. Create your first invoice!</p>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create New Invoice</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate({...newInvoice, amount: Number(newInvoice.amount), branchId: 'your-branch-id'}) }} className="space-y-4">
            <div className="space-y-2"><Label>Customer Name *</Label><Input value={newInvoice.customerName} onChange={e => setNewInvoice({...newInvoice, customerName: e.target.value})} required /></div>
            <div className="space-y-2"><Label>Phone *</Label><Input value={newInvoice.customerPhone} onChange={e => setNewInvoice({...newInvoice, customerPhone: e.target.value})} required /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={newInvoice.customerEmail} onChange={e => setNewInvoice({...newInvoice, customerEmail: e.target.value})} /></div>
            <div className="space-y-2"><Label>Amount *</Label><Input type="number" value={newInvoice.amount} onChange={e => setNewInvoice({...newInvoice, amount: e.target.value})} required /></div>
            <div className="space-y-2"><Label>Due Date *</Label><Input type="date" value={newInvoice.dueDate} onChange={e => setNewInvoice({...newInvoice, dueDate: e.target.value})} required /></div>
            <div className="space-y-2"><Label>Notes</Label><Input value={newInvoice.notes} onChange={e => setNewInvoice({...newInvoice, notes: e.target.value})} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>Create Invoice</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Invoices