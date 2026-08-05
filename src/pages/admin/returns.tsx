import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { returnsApi } from '@/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency, formatDateTime, formatRelativeTime } from '@/lib/utils'
import { toast } from 'sonner'
import {
  RotateCcw,
  Building2,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  User,
  Search,
} from 'lucide-react'

type StatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL',      label: 'All Returns' },
  { value: 'PENDING',  label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
]

const statusConfig: Record<string, { label: string; variant: 'warning' | 'success' | 'destructive' | 'secondary' }> = {
  PENDING:  { label: 'Pending',  variant: 'warning' },
  APPROVED: { label: 'Approved', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'destructive' },
}

export default function AdminReturns() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [search, setSearch] = useState('')

  // Reject dialog state
  const [rejectTarget, setRejectTarget] = useState<{ id: string; code: string } | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const { data: returns = [], isLoading } = useQuery({
    queryKey: ['admin-returns', statusFilter],
    queryFn: async () => {
      const params = statusFilter !== 'ALL' ? { status: statusFilter } : {}
      const response = await returnsApi.getAll(params)
      return response.data
    },
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => returnsApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-returns'] })
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] })
      queryClient.invalidateQueries({ queryKey: ['pending-returns'] })
      toast.success('Return approved — stock has been restored')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to approve return')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      returnsApi.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-returns'] })
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] })
      queryClient.invalidateQueries({ queryKey: ['pending-returns'] })
      setRejectTarget(null)
      setRejectReason('')
      toast.success('Return rejected')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to reject return')
    },
  })

  const handleOpenReject = (ret: any) => {
    setRejectTarget({ id: ret.id, code: ret.returnCode })
    setRejectReason('')
  }

  const handleConfirmReject = () => {
    if (!rejectTarget || !rejectReason.trim()) return
    rejectMutation.mutate({ id: rejectTarget.id, reason: rejectReason.trim() })
  }

  // Client-side search by return code or sale code
  const displayed = returns.filter((ret: any) => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return (
      ret.returnCode?.toLowerCase().includes(q) ||
      ret.sale?.saleCode?.toLowerCase().includes(q) ||
      ret.sale?.branch?.name?.toLowerCase().includes(q)
    )
  })

  const pendingCount = returns.filter((r: any) => r.status === 'PENDING').length

  return (
    <div className="space-y-6 p-6">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <RotateCcw className="w-6 h-6" /> Returns
          </h1>
          <p className="text-muted-foreground">Review and action product return requests</p>
        </div>
        {pendingCount > 0 && (
          <Badge variant="warning" className="text-sm px-3 py-1">
            {pendingCount} pending approval{pendingCount !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <TabsList>
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="relative ml-auto">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search code, sale, branch..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 w-56"
          />
        </div>
      </div>

      {/* Returns list */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Loading returns...
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <RotateCcw className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-sm">
              {search.trim() ? 'No returns match your search' : 'No returns found'}
            </p>
          </div>
        ) : (
          displayed.map((ret: any) => {
            const cfg = statusConfig[ret.status] ?? { label: ret.status, variant: 'secondary' }
            const isPending = ret.status === 'PENDING'

            return (
              <Card key={ret.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5 space-y-4">
                  {/* Top row: code + status + actions */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-bold text-base">{ret.returnCode}</h3>
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      <span className="text-sm text-muted-foreground">
                        Sale: <span className="font-medium text-foreground">{ret.sale?.saleCode}</span>
                      </span>
                    </div>

                    {/* Action buttons — only for pending */}
                    {isPending && (
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenReject(ret)}
                          disabled={approveMutation.isPending}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => approveMutation.mutate(ret.id)}
                          disabled={approveMutation.isPending}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          {approveMutation.isPending ? 'Approving...' : 'Approve'}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Detail grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {/* Branch */}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building2 className="w-4 h-4 shrink-0" />
                      <span>
                        <span className="font-medium text-foreground">
                          {ret.sale?.branch?.name ?? '—'}
                        </span>
                      </span>
                    </div>

                    {/* Requested by + time */}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="w-4 h-4 shrink-0" />
                      <span>
                        {ret.user?.firstName} {ret.user?.lastName}
                      </span>
                      <span>·</span>
                      <Clock className="w-3.5 h-3.5" />
                      <span title={formatDateTime(ret.createdAt)}>
                        {formatRelativeTime(ret.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Products */}
                  {(ret.sale?.saleItems?.length ?? 0) > 0 && (
                    <div className="flex items-start gap-2">
                      <Package className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                      <div className="flex flex-wrap gap-1.5">
                        {ret.sale.saleItems.map((item: any) => (
                          <span
                            key={item.id}
                            className="text-xs bg-muted px-2.5 py-1 rounded-full font-medium"
                          >
                            {item.product?.name} ×{item.quantity}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reason + refund */}
                  <div className="flex items-center justify-between gap-4 pt-1 border-t">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Reason: </span>
                      {ret.reason}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">Refund amount</p>
                      <p className="font-bold text-base">{formatCurrency(ret.refundAmount)}</p>
                    </div>
                  </div>

                  {/* Rejection note (if rejected) */}
                  {ret.status === 'REJECTED' && ret.rejectionReason && (
                    <div className="text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2">
                      <span className="font-medium">Rejection reason: </span>
                      {ret.rejectionReason}
                    </div>
                  )}

                  {/* Approved by (if approved) */}
                  {ret.status === 'APPROVED' && ret.approvedBy && (
                    <p className="text-xs text-muted-foreground">
                      Approved by: {ret.approvedBy.firstName} {ret.approvedBy.lastName}
                      {ret.approvedAt && ` · ${formatDateTime(ret.approvedAt)}`}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Return {rejectTarget?.code}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Provide a reason so the branch manager knows why this return was declined.
            </p>
            <div className="space-y-1.5">
              <Label>Reason *</Label>
              <textarea
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px] resize-none"
                placeholder="e.g. Product shows signs of use, outside return window, receipt mismatch..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || rejectMutation.isPending}
              onClick={handleConfirmReject}
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Reject Return'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
