import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { returnsApi, salesApi } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { RotateCcw, Search, Package } from 'lucide-react'

const ReturnsPage = () => {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [saleCode, setSaleCode] = useState('')
  const [foundSale, setFoundSale] = useState<any>(null)
  const [reason, setReason] = useState('')

  const { data: returns } = useQuery({
    queryKey: ['returns'],
    queryFn: async () => {
      const response = await returnsApi.getAll()
      return response.data
    },
  })

  const searchMutation = useMutation({
    mutationFn: (code: string) => salesApi.getByCode(code),
    onSuccess: (response) => {
      setFoundSale(response.data)
    },
    onError: () => {
      toast.error('Sale not found')
      setFoundSale(null)
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => returnsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns'] })
      setShowCreate(false)
      setSaleCode('')
      setFoundSale(null)
      setReason('')
      toast.success('Return request submitted for approval')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create return')
    },
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED': return <Badge variant="success">Approved</Badge>
      case 'PENDING': return <Badge variant="warning">Pending</Badge>
      case 'REJECTED': return <Badge variant="destructive">Rejected</Badge>
      default: return <Badge>{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Returns</h1>
          <p className="text-muted-foreground">Request product returns</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <RotateCcw className="w-4 h-4 mr-2" />
          New Return
        </Button>
      </div>

      <div className="space-y-3">
        {returns?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No returns found</p>
          </div>
        ) : (
          returns?.map((ret: any) => (
            <Card key={ret.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold">{ret.returnCode}</h3>
                      {getStatusBadge(ret.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">Sale: {ret.sale?.saleCode}</p>
                    <p className="text-sm mt-1">Reason: {ret.reason}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(ret.createdAt)}</p>
                  </div>
                  <p className="text-xl font-bold">{formatCurrency(ret.amount)}</p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Return Request</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input placeholder="Enter 6-character sale code" value={saleCode} onChange={e => setSaleCode(e.target.value.toUpperCase())} maxLength={6} className="flex-1" />
              <Button type="button" variant="outline" onClick={() => saleCode.length === 6 && searchMutation.mutate(saleCode)} disabled={searchMutation.isPending}>
                <Search className="w-4 h-4" />
              </Button>
            </div>

            {foundSale && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">Sale Found: {foundSale.saleCode}</p>
                <p className="text-sm text-muted-foreground">Total: {formatCurrency(foundSale.total)}</p>
                <p className="text-sm text-muted-foreground">Date: {formatDate(foundSale.createdAt)}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Return Reason *</Label>
              <Input placeholder="Explain why this sale is being returned" value={reason} onChange={e => setReason(e.target.value)} />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button
                onClick={() => foundSale && createMutation.mutate({ saleId: foundSale.id, reason, amount: foundSale.total })}
                disabled={!foundSale || !reason || createMutation.isPending}
              >
                Submit Return
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ReturnsPage