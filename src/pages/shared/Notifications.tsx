import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi, devicesApi, returnsApi, expensesApi } from '@/api'
import { useAuthStore } from '@/store'
import { UserRole } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatRelativeTime, formatCurrency, formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Bell, CheckCircle, Smartphone, RotateCcw, Receipt, Check, Package, Building2, Clock, MapPin, Copy, Mail, MailX } from 'lucide-react'
import { useState } from 'react'

const Notifications = () => {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('notifications')
  const isAdmin = user?.role === UserRole.SUPER_ADMIN
  const isManager = user?.role === UserRole.OVERALL_MANAGER

  // Per-return inline rejection state
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // Device approval code dialog
  const [approvedDevice, setApprovedDevice] = useState<{
    code: string
    userName: string
    userEmail: string
    emailSent: boolean
    emailError: string | null
  } | null>(null)

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await notificationsApi.getAll()
      return response.data
    },
  })

  const { data: pendingApprovals } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: async () => {
      const response = await notificationsApi.getPendingApprovals()
      return response.data
    },
    enabled: isAdmin || isManager,
  })

  const { data: pendingDevices } = useQuery({
    queryKey: ['pending-devices'],
    queryFn: async () => {
      const response = await devicesApi.getPending()
      return response.data
    },
    enabled: isAdmin,
  })

  const { data: pendingReturns } = useQuery({
    queryKey: ['pending-returns'],
    queryFn: async () => {
      const response = await returnsApi.getAll({ status: 'PENDING' })
      return response.data
    },
    enabled: isAdmin || isManager,
  })

  const { data: pendingExpenses } = useQuery({
    queryKey: ['pending-expenses'],
    queryFn: async () => {
      const response = await expensesApi.getAll({ status: 'PENDING' })
      return response.data
    },
    enabled: isAdmin || isManager,
  })

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const approveDeviceMutation = useMutation({
    mutationFn: (id: string) => devicesApi.approve(id),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['pending-devices'] })
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] })
      const d = response.data
      setApprovedDevice({
        code:       d.code,
        userName:   d.userName,
        userEmail:  d.userEmail,
        emailSent:  d.emailSent,
        emailError: d.emailError ?? null,
      })
    },
  })

  const approveReturnMutation = useMutation({
    mutationFn: (id: string) => returnsApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-returns'] })
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] })
      toast.success('Return approved')
    },
  })

  const rejectReturnMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => returnsApi.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-returns'] })
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] })
      setRejectingId(null)
      setRejectReason('')
      toast.success('Return rejected')
    },
  })

  const approveExpenseMutation = useMutation({
    mutationFn: (id: string) => expensesApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-expenses'] })
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] })
      toast.success('Expense approved')
    },
  })

  const rejectExpenseMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      expensesApi.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-expenses'] })
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] })
      toast.success('Expense rejected')
    },
  })

  const getIcon = (type: string) => {
    switch (type) {
      case 'DEVICE_AUTH':      return <Smartphone className="w-5 h-5" />
      case 'RETURN_REQUEST':   return <RotateCcw className="w-5 h-5" />
      case 'EXPENSE_SUBMITTED': return <Receipt className="w-5 h-5" />
      default:                 return <Bell className="w-5 h-5" />
    }
  }

  const hasPending =
    (pendingReturns?.length ?? 0) > 0 ||
    (pendingDevices?.length ?? 0) > 0 ||
    (pendingExpenses?.length ?? 0) > 0

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="text-muted-foreground">Stay updated with system activities</p>
      </div>

      {(isAdmin || isManager) && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="notifications">All Notifications</TabsTrigger>
            <TabsTrigger value="approvals">
              Pending Approvals ({pendingApprovals?.total || 0})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* ── Notifications Tab ──────────────────────────────────────── */}
      {activeTab === 'notifications' && (
        <div className="space-y-2">
          {!notifications?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No notifications</p>
            </div>
          ) : (
            notifications?.map((notif: any) => (
              <Card key={notif.id} className={notif.status === 'UNREAD' ? 'border-primary/50' : ''}>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="p-2 bg-muted rounded-lg shrink-0">
                    {getIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{notif.title}</p>
                    <p className="text-sm text-muted-foreground">{notif.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatRelativeTime(notif.createdAt)}
                    </p>
                  </div>
                  {notif.status === 'UNREAD' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => markReadMutation.mutate(notif.id)}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* ── Approvals Tab ──────────────────────────────────────────── */}
      {activeTab === 'approvals' && (isAdmin || isManager) && (
        <div className="space-y-6">

          {/* Pending Returns */}
          {(pendingReturns?.length ?? 0) > 0 && (
            <div>
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <RotateCcw className="w-5 h-5" /> Pending Returns ({pendingReturns!.length})
              </h3>
              <div className="space-y-3">
                {pendingReturns!.map((ret: any) => (
                  <Card key={ret.id}>
                    <CardContent className="p-4 space-y-3">
                      {/* Header: code + branch + action buttons */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold">{ret.returnCode}</p>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-sm">Sale: {ret.sale?.saleCode}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                            <Building2 className="w-3.5 h-3.5 shrink-0" />
                            <span>{ret.sale?.branch?.name ?? 'Unknown branch'}</span>
                          </div>
                        </div>
                        {rejectingId !== ret.id && (
                          <div className="flex gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={rejectReturnMutation.isPending || approveReturnMutation.isPending}
                              onClick={() => { setRejectingId(ret.id); setRejectReason('') }}
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              disabled={approveReturnMutation.isPending || rejectReturnMutation.isPending}
                              onClick={() => approveReturnMutation.mutate(ret.id)}
                            >
                              Approve
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Products */}
                      {(ret.sale?.saleItems?.length ?? 0) > 0 && (
                        <div className="flex items-start gap-1.5">
                          <Package className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                          <div className="flex flex-wrap gap-1">
                            {ret.sale.saleItems.map((item: any) => (
                              <span
                                key={item.id}
                                className="text-xs bg-muted px-2 py-0.5 rounded-full"
                              >
                                {item.product?.name} ×{item.quantity}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Reason + refund amount */}
                      <div className="text-sm space-y-0.5">
                        <p><span className="text-muted-foreground">Reason:</span> {ret.reason}</p>
                        <p>
                          <span className="text-muted-foreground">Refund:</span>{' '}
                          <span className="font-semibold">{formatCurrency(ret.refundAmount)}</span>
                        </p>
                      </div>

                      {/* Footer: who + when */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>By: {ret.user?.firstName} {ret.user?.lastName}</span>
                        <span>·</span>
                        <Clock className="w-3 h-3" />
                        <span title={formatDateTime(ret.createdAt)}>
                          {formatRelativeTime(ret.createdAt)}
                        </span>
                      </div>

                      {/* Inline rejection input */}
                      {rejectingId === ret.id && (
                        <div className="pt-2 border-t space-y-2">
                          <p className="text-xs font-medium text-destructive">Rejection reason *</p>
                          <div className="flex gap-2">
                            <Input
                              className="h-8 text-sm flex-1"
                              placeholder="Explain why this return is being rejected..."
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              autoFocus
                            />
                            <Button
                              size="sm"
                              variant="destructive"
                              className="shrink-0"
                              disabled={!rejectReason.trim() || rejectReturnMutation.isPending}
                              onClick={() =>
                                rejectReturnMutation.mutate({ id: ret.id, reason: rejectReason.trim() })
                              }
                            >
                              {rejectReturnMutation.isPending ? 'Rejecting...' : 'Confirm'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="shrink-0"
                              onClick={() => { setRejectingId(null); setRejectReason('') }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Pending Devices — admin only */}
          {isAdmin && (pendingDevices?.length ?? 0) > 0 && (
            <div>
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <Smartphone className="w-5 h-5" /> Pending Device Approvals ({pendingDevices!.length})
              </h3>
              <div className="space-y-3">
                {pendingDevices!.map((device: any) => {
                  const locationParts = [device.loginCity, device.loginRegion, device.loginCountry].filter(Boolean)
                  const locationStr = locationParts.length > 0 ? locationParts.join(', ') : null

                  return (
                    <Card key={device.id} className="border-amber-200 bg-amber-50/30">
                      <CardContent className="p-4 space-y-3">
                        {/* Header: name + branch + approve button */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold">
                              {device.user?.firstName} {device.user?.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground">{device.user?.email}</p>
                            {device.user?.branch?.name && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                <Building2 className="w-3 h-3" />
                                <span>{device.user.branch.name}</span>
                              </div>
                            )}
                          </div>
                          <Button
                            size="sm"
                            disabled={approveDeviceMutation.isPending}
                            onClick={() => approveDeviceMutation.mutate(device.id)}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            {approveDeviceMutation.isPending ? 'Approving…' : 'Approve'}
                          </Button>
                        </div>

                        {/* Location — the key new info */}
                        {locationStr && (
                          <div className="flex items-center gap-1.5 text-sm font-medium">
                            <MapPin className="w-4 h-4 shrink-0 text-amber-600" />
                            <span>Logging in from <span className="text-amber-700">{locationStr}</span></span>
                          </div>
                        )}

                        {/* Device + IP */}
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <p className="truncate">
                            <span className="font-medium">Device: </span>
                            {device.name || 'Unknown'}
                          </p>
                          {device.loginIpAddress && (
                            <p>
                              <span className="font-medium">IP: </span>
                              {device.loginIpAddress}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {/* Pending Expenses */}
          {(pendingExpenses?.length ?? 0) > 0 && (
            <div>
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <Receipt className="w-5 h-5" /> Pending Expenses ({pendingExpenses!.length})
              </h3>
              <div className="space-y-2">
                {pendingExpenses!.map((expense: any) => (
                  <Card key={expense.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            {expense.expenseCode} — {expense.category}
                          </p>
                          <p className="text-sm text-muted-foreground">{expense.description}</p>
                          <p className="text-xs text-muted-foreground">
                            KES {Number(expense.amount).toLocaleString()} ·{' '}
                            {expense.branch?.name}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              rejectExpenseMutation.mutate({
                                id: expense.id,
                                reason: 'Rejected by admin',
                              })
                            }
                          >
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => approveExpenseMutation.mutate(expense.id)}
                          >
                            Approve
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {!hasPending && (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>All caught up! No pending approvals.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Device Approval Code Dialog ─────────────────────────────── */}
      <Dialog open={!!approvedDevice} onOpenChange={(open) => !open && setApprovedDevice(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5" /> Device Approved
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <p className="text-sm text-muted-foreground">
              {approvedDevice?.userName} can now complete login using this code.
            </p>

            {/* Email status banner */}
            {approvedDevice?.emailSent ? (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                <Mail className="w-4 h-4 shrink-0" />
                <span>Code emailed to <strong>{approvedDevice.userEmail}</strong></span>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                <MailX className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{approvedDevice?.emailError ?? 'Email not sent — share the code below directly.'}</span>
              </div>
            )}

            {/* The code */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">6-Digit Authorization Code</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-lg py-3 text-center">
                  <span className="text-3xl font-mono font-bold tracking-[0.4em] text-primary">
                    {approvedDevice?.code}
                  </span>
                </div>
                <Button
                  size="icon"
                  variant="outline"
                  className="shrink-0"
                  title="Copy code"
                  onClick={() => {
                    navigator.clipboard.writeText(approvedDevice?.code ?? '')
                    toast.success('Code copied to clipboard')
                  }}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Expires in 30 minutes · Single use
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button className="w-full" onClick={() => setApprovedDevice(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Notifications
