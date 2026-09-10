import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api, { customersApi, invoicesApi } from '@/api'
import { useAuthStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { FileText, Phone, Users, Copy, CheckCircle, Store, User } from 'lucide-react' // 🚀 Added User icon

const Invoices = () => {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'OVERALL_MANAGER'
  
  const queryClient = useQueryClient()
  
  const [showCustomersModal, setShowCustomersModal] = useState(false)
  const [selectedPaymentInvoice, setSelectedPaymentInvoice] = useState<any>(null)
  const [paymentAmount, setPaymentAmount] = useState('')

  const { data: invoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const response = await api.get('/invoices')
      return response.data
    },
  })

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      try {
        const response = await customersApi.getAll()
        const data = Array.isArray(response.data) ? response.data : (response.data?.data || [])
        return data.filter((c: any) => c.isActive)
      } catch (error) {
        return []
      }
    }
  })

  const recordPaymentMutation = useMutation({
    mutationFn: (data: { id: string, amount: number }) => api.patch(`/invoices/${data.id}/payment`, { amount: data.amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      setSelectedPaymentInvoice(null)
      setPaymentAmount('')
      toast.success('Payment recorded successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to record payment')
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => invoicesApi.cancel(id),
    onSuccess: () => {
      toast.success('Invoice cancelled successfully');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setSelectedPaymentInvoice(null);
      setPaymentAmount('');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to cancel invoice')
  })

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPaymentInvoice || !paymentAmount) return
    
    const amount = Number(paymentAmount)
    if (amount <= 0 || amount > Number(selectedPaymentInvoice.balance)) {
      toast.error(`Please enter a valid amount up to ${formatCurrency(selectedPaymentInvoice.balance)}`)
      return
    }

    recordPaymentMutation.mutate({ id: selectedPaymentInvoice.id, amount })
  }
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID': return <Badge variant="default" className="bg-emerald-500 hover:bg-emerald-600">Paid</Badge>
      case 'PENDING': return <Badge variant="outline" className="text-amber-600 border-amber-300">Pending</Badge>
      case 'SENT': return <Badge variant="secondary">Sent</Badge>
      case 'OVERDUE': return <Badge variant="destructive">Overdue</Badge>
      case 'CANCELLED': return <Badge variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-100">Cancelled</Badge>
      default: return <Badge>{status}</Badge>
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Phone number copied!')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{isAdmin ? 'All Branch Invoices' : 'Invoices'}</h1>
          <p className="text-muted-foreground">Manage customer invoices and payments</p>
        </div>
        {/* 🚀 Changed bg-white to bg-background */}
        <Button onClick={() => setShowCustomersModal(true)} variant="outline" className="bg-background">
          <Users className="w-4 h-4 mr-2" />
          View Customers
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {invoices?.map((invoice: any) => (
          {/* 🚀 Removed bg-white, added bg-card */}
          <Card key={invoice.id} className={`hover:shadow-md transition-shadow bg-card ${invoice.status === 'CANCELLED' ? 'opacity-60' : ''}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-lg">{invoice.invoiceCode}</h3>
                  <p className="text-xs text-muted-foreground">{formatDate(invoice.createdAt)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {getStatusBadge(invoice.status)}
                  
                  {isAdmin && invoice.branch && (
                    <Badge variant="outline" className="bg-muted text-[10px] py-0">
                      <Store className="w-3 h-3 mr-1" /> {invoice.branch.name}
                    </Badge>
                  )}
                  
                  {/* 🚀 NEW: Shows the staff member who generated the invoice */}
                  {isAdmin && invoice.sale?.user && (
                    <Badge variant="outline" className="bg-muted font-normal text-[10px] py-0 mt-0.5">
                      <User className="w-3 h-3 mr-1" /> {invoice.sale.user.firstName} {invoice.sale.user.lastName}
                    </Badge>
                  )}
                </div>
              </div>

              {/* 🚀 Changed bg-muted/30 to bg-muted/50 for better dark mode contrast */}
              <div className="space-y-2 mt-4 bg-muted/50 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  {invoice.customer?.name || 'Unknown Customer'}
                </div>
                <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground pl-6">
                  <span className="flex items-center gap-2">
                    <Phone className="w-3 h-3" />
                    {invoice.customer?.phone || 'No phone'}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Invoice Total</span>
                  <span className="font-semibold">{formatCurrency(invoice.total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount Paid</span>
                  <span className="font-semibold text-emerald-600">{formatCurrency(invoice.amountPaid)}</span>
                </div>
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-dashed">
                  <span className="text-sm font-bold text-muted-foreground">Balance</span>
                  <span className={`text-lg font-black ${Number(invoice.balance) > 0 && invoice.status !== 'CANCELLED' ? 'text-destructive' : 'text-emerald-600'}`}>
                    {formatCurrency(invoice.balance)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground text-right mt-1">Due: {invoice.dueDate ? formatDate(invoice.dueDate) : 'On Receipt'}</p>
              </div>

              {Number(invoice.balance) > 0 && invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && (
                <Button 
                  className="w-full mt-4" 
                  variant="default"
                  onClick={() => setSelectedPaymentInvoice(invoice)}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Manage Invoice
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {invoices?.length === 0 && (
        {/* 🚀 Changed bg-white to bg-card */}
        <div className="text-center py-12 text-muted-foreground bg-card border rounded-xl shadow-sm">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>No invoices found in the system.</p>
        </div>
      )}

      {/* View Customers Directory Modal */}
      <Dialog open={showCustomersModal} onOpenChange={setShowCustomersModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Users className="w-5 h-5"/> Customer Directory</DialogTitle>
            <DialogDescription>Read-only list of active customers. Click the copy icon to copy their phone number.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-3 mt-2">
            {customers.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">No active customers found.</p>
            ) : (
              customers.map((c: any) => (
                {/* 🚀 Changed bg-slate-50 to bg-muted/50 */}
                <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                  <div>
                    <p className="font-semibold text-sm">{c.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" /> {c.phone}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => copyToClipboard(c.phone)} title="Copy Phone Number">
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="w-full" onClick={() => setShowCustomersModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment & Cancel Modal */}
      <Dialog open={!!selectedPaymentInvoice} onOpenChange={() => { setSelectedPaymentInvoice(null); setPaymentAmount(''); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Invoice</DialogTitle>
            <DialogDescription>
              Recording a payment for {selectedPaymentInvoice?.invoiceCode}. When the balance reaches 0, the invoice will automatically convert to PAID.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePaymentSubmit} className="space-y-4 pt-4">
            <div className="p-3 bg-muted rounded-lg flex justify-between items-center text-sm">
              <span className="font-medium">Current Balance:</span>
              <span className="font-bold text-destructive">{selectedPaymentInvoice ? formatCurrency(selectedPaymentInvoice.balance) : ''}</span>
            </div>
            
            <div className="space-y-2">
              <Label>Payment Amount (KES) *</Label>
              <Input 
                type="number" 
                autoFocus
                placeholder="Enter amount paid..." 
                value={paymentAmount} 
                onChange={e => setPaymentAmount(e.target.value)} 
                required 
              />
            </div>
            
            <DialogFooter className="pt-4 sm:justify-between flex-row">
              <Button
                type="button"
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                onClick={() => {
                  if (window.confirm('Are you sure you want to cancel this invoice? This action cannot be undone.')) {
                    cancelMutation.mutate(selectedPaymentInvoice.id)
                  }
                }}
                disabled={cancelMutation.isPending || recordPaymentMutation.isPending}
              >
                {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Invoice'}
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => { setSelectedPaymentInvoice(null); setPaymentAmount(''); }}>
                  Back
                </Button>
                <Button type="submit" disabled={recordPaymentMutation.isPending || cancelMutation.isPending}>
                  Confirm Payment
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Invoices
