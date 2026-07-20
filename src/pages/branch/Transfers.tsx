import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { transfersApi, branchesApi, inventoryApi } from '@/api'
import { useAuthStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDate, formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import {
  ArrowLeftRight,
  Plus,
  Package,
  AlertTriangle,
  RefreshCw,
  Check,
  X,
  Search,
  Inbox,
} from 'lucide-react'

// Pulls a human-readable message out of an API error, whether it's a single
// string (most errors) or an array of strings (class-validator messages).
function getErrorMessage(error: any, fallback: string): string {
  const message = error?.response?.data?.message
  if (Array.isArray(message)) return message.join(' ')
  if (typeof message === 'string' && message.trim()) return message
  if (typeof error?.message === 'string' && error.message.trim()) return error.message
  return fallback
}

const ErrorBanner = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
    <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
    <div className="flex-1">{message}</div>
    {onRetry && (
      <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0 border-destructive/30">
        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
        Retry
      </Button>
    )}
  </div>
)

const STATUS_OPTIONS = ['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED']

const Transfers = () => {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const [direction, setDirection] = useState<'outgoing' | 'incoming'>('outgoing')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [toBranchId, setToBranchId] = useState('')
  const [notes, setNotes] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [transferItems, setTransferItems] = useState<{ productId: string; quantity: number }[]>([])

  const [viewTransfer, setViewTransfer] = useState<any>(null)
  const [rejectTarget, setRejectTarget] = useState<any>(null)
  const [rejectReason, setRejectReason] = useState('')

  const statusParam = statusFilter === 'ALL' ? undefined : statusFilter

  const {
    data: outgoing,
    isLoading: outgoingLoading,
    isError: outgoingError,
    error: outgoingErrorObj,
    refetch: refetchOutgoing,
  } = useQuery({
    queryKey: ['transfers', 'outgoing', user?.branchId, statusParam],
    queryFn: async () => {
      const response = await transfersApi.getAll({ fromBranchId: user?.branchId, status: statusParam })
      return response.data
    },
    enabled: !!user?.branchId,
  })

  const {
    data: incoming,
    isLoading: incomingLoading,
    isError: incomingError,
    error: incomingErrorObj,
    refetch: refetchIncoming,
  } = useQuery({
    queryKey: ['transfers', 'incoming', user?.branchId, statusParam],
    queryFn: async () => {
      const response = await transfersApi.getAll({ toBranchId: user?.branchId, status: statusParam })
      return response.data
    },
    enabled: !!user?.branchId,
  })

  const incomingPendingCount = useMemo(
    () => (incoming ?? []).filter((t: any) => t.status === 'PENDING').length,
    [incoming],
  )

  const {
    data: branches,
    isLoading: branchesLoading,
    isError: branchesIsError,
    error: branchesErrorObj,
    refetch: refetchBranches,
  } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const response = await branchesApi.getAll()
      return response.data?.filter((b: any) => b.id !== user?.branchId)
    },
    enabled: showCreate,
  })

  const {
    data: inventory,
    isLoading: inventoryLoading,
    isError: inventoryIsError,
    error: inventoryErrorObj,
    refetch: refetchInventory,
  } = useQuery({
    queryKey: ['inventory', user?.branchId],
    queryFn: async () => {
      if (!user?.branchId) return []
      const response = await inventoryApi.getAll({ branchId: user.branchId })
      return response.data
    },
    enabled: showCreate && !!user?.branchId,
  })

  const invalidateTransfers = () => {
    queryClient.invalidateQueries({ queryKey: ['transfers'] })
    queryClient.invalidateQueries({ queryKey: ['inventory'] })
  }

  const resetCreateForm = () => {
    setShowCreate(false)
    setToBranchId('')
    setNotes('')
    setProductSearch('')
    setTransferItems([])
  }

  const createMutation = useMutation({
    mutationFn: (data: any) => transfersApi.create(data),
    onSuccess: () => {
      invalidateTransfers()
      resetCreateForm()
      toast.success('Transfer request submitted')
    },
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => transfersApi.approve(id),
    onSuccess: () => {
      invalidateTransfers()
      setActionError(null)
      toast.success('Transfer approved')
    },
    onError: (error: any) => {
      const message = getErrorMessage(error, 'Failed to approve transfer')
      setActionError(message)
      toast.error(message)
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, rejectionReason }: { id: string; rejectionReason: string }) =>
      transfersApi.reject(id, rejectionReason),
    onSuccess: () => {
      invalidateTransfers()
      setActionError(null)
      setRejectTarget(null)
      setRejectReason('')
      toast.success('Transfer rejected')
    },
    onError: (error: any) => {
      const message = getErrorMessage(error, 'Failed to reject transfer')
      setActionError(message)
      toast.error(message)
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => transfersApi.cancel(id),
    onSuccess: () => {
      invalidateTransfers()
      setActionError(null)
      toast.success('Transfer cancelled')
    },
    onError: (error: any) => {
      const message = getErrorMessage(error, 'Failed to cancel transfer')
      setActionError(message)
      toast.error(message)
    },
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
      case 'COMPLETED':
        return <Badge variant="success">{status}</Badge>
      case 'PENDING':
        return <Badge variant="warning">Pending</Badge>
      case 'REJECTED':
        return <Badge variant="destructive">Rejected</Badge>
      case 'CANCELLED':
        return <Badge variant="secondary">Cancelled</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const filteredProducts = useMemo(() => {
    if (!inventory) return []
    if (!productSearch.trim()) return inventory
    const q = productSearch.trim().toLowerCase()
    return inventory.filter((inv: any) => inv.product?.name?.toLowerCase().includes(q))
  }, [inventory, productSearch])

  const invalidItems = useMemo(
    () =>
      transferItems.filter((i) => {
        const inv = inventory?.find((x: any) => x.productId === i.productId)
        return inv && i.quantity > inv.quantity
      }),
    [transferItems, inventory],
  )

  const activeItems = transferItems.filter((i) => i.quantity > 0)

  const activeList = direction === 'outgoing' ? outgoing : incoming
  const activeListLoading = direction === 'outgoing' ? outgoingLoading : incomingLoading
  const activeListError = direction === 'outgoing' ? outgoingError : incomingError
  const activeListErrorObj = direction === 'outgoing' ? outgoingErrorObj : incomingErrorObj
  const refetchActive = direction === 'outgoing' ? refetchOutgoing : refetchIncoming

  const displayedTransfers = useMemo(() => {
    if (!activeList) return []
    if (!search.trim()) return activeList
    const q = search.trim().toLowerCase()
    return activeList.filter((t: any) => t.transferCode?.toLowerCase().includes(q))
  }, [activeList, search])

  const canActOn = (transfer: any) =>
    transfer.status === 'PENDING' && direction === 'incoming' && transfer.toBranchId === user?.branchId

  const canCancel = (transfer: any) =>
    transfer.status === 'PENDING' && direction === 'outgoing' && transfer.initiatedBy === user?.id

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Transfers</h1>
          <p className="text-muted-foreground">Transfer products between branches</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Transfer
        </Button>
      </div>

      {actionError && (
        <ErrorBanner message={actionError} />
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <Tabs value={direction} onValueChange={(v) => setDirection(v as 'outgoing' | 'incoming')}>
          <TabsList>
            <TabsTrigger value="outgoing">Outgoing</TabsTrigger>
            <TabsTrigger value="incoming" className="gap-2">
              Incoming
              {incomingPendingCount > 0 && (
                <Badge variant="warning" className="ml-1">{incomingPendingCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 w-44"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{s === 'ALL' ? 'All statuses' : s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        {activeListError ? (
          <ErrorBanner
            message={getErrorMessage(activeListErrorObj, 'Failed to load transfers')}
            onRetry={() => refetchActive()}
          />
        ) : activeListLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading transfers...</div>
        ) : displayedTransfers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {direction === 'incoming' ? (
              <Inbox className="w-12 h-12 mx-auto mb-4 opacity-30" />
            ) : (
              <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
            )}
            <p>
              {search.trim() || statusFilter !== 'ALL'
                ? 'No transfers match your filters'
                : direction === 'incoming'
                ? 'No incoming transfers'
                : 'No transfers yet'}
            </p>
          </div>
        ) : (
          displayedTransfers.map((transfer: any) => (
            <Card key={transfer.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 cursor-pointer" onClick={() => setViewTransfer(transfer)}>
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="font-bold">{transfer.transferCode}</h3>
                      {getStatusBadge(transfer.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      From: {transfer.fromBranch?.name} To: {transfer.toBranch?.name}
                    </p>
                    <p className="text-sm mt-1 text-foreground">
                      {transfer.items?.length
                        ? transfer.items
                            .map((item: any) => `${item.product?.name} x${item.quantity}`)
                            .join(', ')
                        : 'No items'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(transfer.createdAt)}</p>
                    {transfer.status === 'REJECTED' && transfer.rejectionReason && (
                      <p className="text-xs text-destructive mt-1">Reason: {transfer.rejectionReason}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <ArrowLeftRight className="w-6 h-6 text-muted-foreground" />
                    {canActOn(transfer) && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => approveMutation.mutate(transfer.id)}
                          disabled={approveMutation.isPending}
                        >
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setRejectTarget(transfer); setRejectReason('') }}
                          disabled={rejectMutation.isPending}
                        >
                          <X className="w-3.5 h-3.5 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}
                    {canCancel(transfer) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => cancelMutation.mutate(transfer.id)}
                        disabled={cancelMutation.isPending}
                      >
                        <X className="w-3.5 h-3.5 mr-1" />
                        {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Request'}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => (open ? setShowCreate(true) : resetCreateForm())}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Transfer</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {createMutation.isError && (
              <ErrorBanner message={getErrorMessage(createMutation.error, 'Failed to create transfer')} />
            )}

            <div className="space-y-2">
              <Label>To Branch *</Label>
              {branchesIsError ? (
                <ErrorBanner
                  message={getErrorMessage(branchesErrorObj, 'Failed to load branches')}
                  onRetry={() => refetchBranches()}
                />
              ) : (
                <Select value={toBranchId} onValueChange={setToBranchId} disabled={branchesLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder={branchesLoading ? 'Loading branches...' : 'Select destination branch'} />
                  </SelectTrigger>
                  <SelectContent>
                    {branches?.map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {!branchesLoading && !branchesIsError && branches?.length === 0 && (
                <p className="text-xs text-muted-foreground">No other branches are available to transfer to.</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Select Products</Label>
                {inventory && inventory.length > 0 && (
                  <Input
                    placeholder="Filter products..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="h-7 w-40 text-xs"
                  />
                )}
              </div>

              {inventoryIsError ? (
                <ErrorBanner
                  message={getErrorMessage(inventoryErrorObj, 'Failed to load inventory')}
                  onRetry={() => refetchInventory()}
                />
              ) : inventoryLoading ? (
                <div className="text-sm text-muted-foreground py-4 text-center">Loading inventory...</div>
              ) : inventory?.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
                  No stock available at your branch to transfer.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-2">
                  {filteredProducts.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">No products match "{productSearch}"</p>
                  ) : (
                    filteredProducts.map((inv: any) => {
                      const current = transferItems.find((i) => i.productId === inv.productId)
                      const isInvalid = current && current.quantity > inv.quantity
                      return (
                        <div key={inv.id} className="p-2 hover:bg-muted rounded">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">{inv.product?.name}</p>
                              <p className="text-xs text-muted-foreground">Stock: {inv.quantity}</p>
                            </div>
                            <Input
                              type="number"
                              className="w-20 h-8"
                              min={0}
                              max={inv.quantity}
                              value={current?.quantity ?? ''}
                              placeholder="Qty"
                              onChange={(e) => {
                                const qty = Number(e.target.value)
                                setTransferItems((prev) => {
                                  const existing = prev.find((i) => i.productId === inv.productId)
                                  if (!qty || qty <= 0) return prev.filter((i) => i.productId !== inv.productId)
                                  if (existing) return prev.map((i) => (i.productId === inv.productId ? { ...i, quantity: qty } : i))
                                  return [...prev, { productId: inv.productId, quantity: qty }]
                                })
                              }}
                            />
                          </div>
                          {isInvalid && (
                            <p className="text-xs text-destructive mt-1">Only {inv.quantity} in stock</p>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any context for the receiving branch..."
                rows={2}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={resetCreateForm}>Cancel</Button>
              <Button
                onClick={() =>
                  createMutation.mutate({
                    fromBranchId: user?.branchId,
                    toBranchId,
                    items: activeItems,
                    notes: notes.trim() || undefined,
                  })
                }
                disabled={
                  !toBranchId ||
                  activeItems.length === 0 ||
                  invalidItems.length > 0 ||
                  createMutation.isPending
                }
              >
                {createMutation.isPending ? 'Submitting...' : 'Submit Transfer'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Reject Transfer {rejectTarget?.transferCode}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {rejectMutation.isError && (
              <ErrorBanner message={getErrorMessage(rejectMutation.error, 'Failed to reject transfer')} />
            )}
            <div className="space-y-2">
              <Label>Reason for rejection *</Label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="Explain why this transfer is being rejected..."
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={!rejectReason.trim() || rejectMutation.isPending}
                onClick={() => rejectMutation.mutate({ id: rejectTarget.id, rejectionReason: rejectReason.trim() })}
              >
                {rejectMutation.isPending ? 'Rejecting...' : 'Reject Transfer'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Details Dialog */}
      <Dialog open={!!viewTransfer} onOpenChange={(open) => !open && setViewTransfer(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Transfer {viewTransfer?.transferCode}</DialogTitle></DialogHeader>
          {viewTransfer && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {getStatusBadge(viewTransfer.status)}
                <span className="text-xs text-muted-foreground">{formatDateTime(viewTransfer.createdAt)}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">From</p>
                  <p className="font-medium">{viewTransfer.fromBranch?.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">To</p>
                  <p className="font-medium">{viewTransfer.toBranch?.name}</p>
                </div>
                {viewTransfer.initiator && (
                  <div>
                    <p className="text-muted-foreground text-xs">Requested by</p>
                    <p className="font-medium">{viewTransfer.initiator.firstName} {viewTransfer.initiator.lastName}</p>
                  </div>
                )}
                {viewTransfer.approvedBy && (
                  <div>
                    <p className="text-muted-foreground text-xs">
                      {viewTransfer.status === 'REJECTED' ? 'Rejected by' : 'Approved by'}
                    </p>
                    <p className="font-medium">{viewTransfer.approvedBy.firstName} {viewTransfer.approvedBy.lastName}</p>
                  </div>
                )}
              </div>

              {viewTransfer.notes && (
                <div>
                  <p className="text-muted-foreground text-xs">Notes</p>
                  <p className="text-sm">{viewTransfer.notes}</p>
                </div>
              )}

              {viewTransfer.rejectionReason && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {viewTransfer.rejectionReason}
                </div>
              )}

              <div>
                <p className="text-muted-foreground text-xs mb-2">Items</p>
                <div className="space-y-2 border rounded-lg divide-y">
                  {viewTransfer.items?.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between p-2 text-sm">
                      <span>{item.product?.name}</span>
                      <span className="font-medium">{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Transfers
