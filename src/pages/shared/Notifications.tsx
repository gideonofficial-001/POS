import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi, devicesApi, returnsApi, expensesApi } from '@/api'
import { useAuthStore } from '@/store'
import { UserRole } from '@/types'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatRelativeTime, formatCurrency, formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Bell, CheckCircle, Smartphone, RotateCcw, Receipt, Check,
  Package, Building2, Clock, MapPin, Copy, Mail, MailX,
  ShieldCheck, Trash2, ArrowRightLeft,
} from 'lucide-react'
import { useState } from 'react'

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractAuthCode(message: string): string | null {
  const match = message.match(/Authorization code:\s*(\d{6})/i)
  return match ? match[1] : null
}

// Maps notification entityType + type to the correct route
function getNotificationRoute(notif: any, userRole: string): string | null {
  const type: string = notif.type ?? ''
  const entity: string = notif.entityType ?? ''

  if (type.startsWith('TRANSFER_') || entity === 'Transfer') {
    if (userRole === UserRole.SUPER_ADMIN) return '/admin/transfers'
    return '/branch/transfers'
  }
  if (type.startsWith('RETURN_') || entity === 'Return') {
    return '/branch/returns'
  }
  if (type.startsWith('EXPENSE_') || entity === 'Expense') {
    return '/branch/expenses'
  }
  if (type === 'DEVICE_AUTH' || entity === 'Device') {
    return '/notifications' // stays on this page — admin handles it here
  }
  if (type === 'INVOICE_CREATED' || entity === 'Invoice') {
    return '/branch/invoices'
  }
  return null
}

// ── Component ─────────────────────────────────────────────────────────────────

const Notifications = () => {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('notifications')
  const isAdmin = user?.role === UserRole.SUPER_ADMIN
  const isManager = user?.role === UserRole.OVERALL_MANAGER

  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const [approvedDevice, setApprovedDevice] = useState<{
    code: string
    userName: string
    userEmail: string
    emailSent: boolean
    emailError: string | null
  } | null>(null)

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await notificationsApi.getAll()
      return response.data
    },
    refetchInterval: 20_000,
  })

  const { data: pendingApprovals } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: async () => {
      const response = await notificationsApi.getPendingApprovals()
      return response.data
    },
    enabled: isAdmin || isManager,
    refetchInterval: 20_000,
  })

  const { data: pendingDevices } = useQuery({
    queryKey: ['pending-devices'],
    queryFn: async () => {
      const response = await devicesApi.getPending()
      return response.data
    },
    enabled: isAdmin,
    refetchInterval: 20_000,
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

  // ── Mutations ──────────────────────────────────────────────────────────────

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast.success('Notification deleted')
    },
    onError: () => toast.error('Failed to delete notification'),
  })

  const approveDeviceMutation = useMutation({
    mutationFn: (id: string) => devicesApi.approve(id),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['pending-devices'] })
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
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
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      returnsApi.reject(id, reason),
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

  // ── Helpers ────────────────────────────────────────────────────────────────

  const getIcon = (type: string) => {
    if (type.startsWith('TRANSFER_')) return <ArrowRightLeft className="w-5 h-5" />
    switch (type) {
      case 'DEVICE_AUTH':       return <Smartphone className="w-5 h-5" />
      case 'RETURN_REQUEST':    return <RotateCcw className="w-5 h-5" />
      case 'EXPENSE_SUBMITTED': return <Receipt className="w-5 h-5" />
      default:                  return <Bell className="w-5 h-5" />
    }
  }

  const handleNotifClick = (notif: any) => {
    // Mark as read
    if (notif.status === 'UNREAD') {
      markReadMutation.mutate(notif.id)
    }
    // Navigate if there's a target page
    const route = getNotificationRoute(notif, user?.role ?? '')
    if (route && route !== '/notifications') {
      navigate(route)
    }
  }

  const hasPending =
    (pendingReturns?.length ?? 0) > 0 ||
    (pendingDevices?.length ?? 0) > 0 ||
    (pendingExpenses?.length ?? 0) > 0

  // ── Render ─────────────────────────────────────────────────────────────────

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
            notifications?.map((notif: any) => {
              const authCode =
                notif.type === 'DEVICE_AUTH' ? extractAuthCode(notif.message) : null
              const route = getNotificationRoute(notif, user?.role ?? '')
              const isNavigable = route && route !== '/notifications'

              return (
                <Card
                  key={notif.id}
                  className={`transition-all ${
                    notif.type === 'DEVICE_AUTH'
                      ? 'border-amber-300 bg-amber-50/40'
                      : notif.status === 'UNREAD'
                      ? 'border-primary/50'
                      : ''
                  } ${isNavigable ? 'cursor-pointer hover:shadow-sm' : ''}`}
                  onClick={() => handleNotifClick(notif)}
                >
                  <CardContent className="p-4 flex items-start gap-3">
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        notif.type === 'DEVICE_AUTH'
                          ? 'bg-amber-100 text-amber-700'
                          : notif.type.startsWith('TRANSFER_')
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-muted'
                      }`}
                    >
                      {getIcon(notif.type)}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium leading-tight">{notif.title}</p>
                        {isNavigable && (
                          <span className="text-xs text-primary shrink-0">View →</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{notif.message}</p>

                      {/* Inline auth code chip */}
                      {authCode && (
                        <div className="flex items-center gap-2 pt-1"
                          onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2 bg-white border border-amber-300 rounded-lg px-3 py-1.5">
                            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                            <span className="font-mono text-xl font-bold tracking-[0.3em] text-amber-800">
                              {authCode}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 border-amber-300 text-amber-800 hover:bg-amber-50"
                            onClick={() => {
                              navigator.clipboard.writeText(authCode)
                              toast.success('Code copied to clipboard')
                            }}
                          >
                            <Copy className="w-3.5 h-3.5" />
                            Copy
                          </Button>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(notif.createdAt)}
                      </p>
                    </div>

                    {/* Action buttons — stop propagation so they don't trigger navigation */}
                    <div className="flex items-center gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}>
                      {notif.status === 'UNREAD' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Mark as read"
                          onClick={() => markReadMutation.mutate(notif.id)}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-50"
                        title="Delete notification"
                        onClick={() => deleteMutation.mutate(notif.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })
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
                              size="sm" variant="outline"
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

                      {(ret.sale?.saleItems?.length ?? 0) > 0 && (
                        <div className="flex items-start gap-1.5">
                          <Package className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                          <div className="flex flex-wrap gap-1">
                            {ret.sale.saleItems.map((item: any) => (
                              <span key={item.id} className="text-xs bg-muted px-2 py-0.5 rounded-full">
                                {item.product?.name} ×{item.quantity}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="text-sm space-y-0.5">
                        <p><span className="text-muted-foreground">Reason:</span> {ret.reason}</p>
                        <p>
                          <span className="text-muted-foreground">Refund:</span>{' '}
                          <span className="font-semibold">{formatCurrency(ret.refundAmount)}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>By: {ret.user?.firstName} {ret.user?.lastName}</span>
                        <span>·</span>
                        <Clock className="w-3 h-3" />
                        <span title={formatDateTime(ret.createdAt)}>
                          {formatRelativeTime(ret.createdAt)}
                        </span>
                      </div>

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
                              size="sm" variant="destructive" className="shrink-0"
                              disabled={!rejectReason.trim() || rejectReturnMutation.isPending}
                              onClick={() =>
                                rejectReturnMutation.mutate({ id: ret.id, reason: rejectReason.trim() })
                              }
                            >
                              {rejectReturnMutation.isPending ? 'Rejecting...' : 'Confirm'}
                            </Button>
                            <Button
                              size="sm" variant="ghost" className="shrink-0"
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
                            {approveDeviceMutation.isPending ? 'Approving…' : 'Re-generate Code'}
                          </Button>
                        </div>

                        {locationStr && (
                          <div className="flex items-center gap-1.5 text-sm font-medium">
                            <MapPin className="w-4 h-4 shrink-0 text-amber-600" />
                            <span>Logging in from <span className="text-amber-700">{locationStr}</span></span>
                          </div>
                        )}

                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <p className="truncate">
                            <span className="font-medium">Device: </span>
                            {device.name || 'Unknown'}
                          </p>
                          {device.loginIpAddress && (
                            <p><span className="font-medium">IP: </span>{device.loginIpAddress}</p>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground italic">
                          A code was sent in the notification. Click "Re-generate Code" only if you need a fresh one.
                        </p>
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
                          <p className="font-medium">{expense.expenseCode} — {expense.category}</p>
                          <p className="text-sm text-muted-foreground">{expense.description}</p>
                          <p className="text-xs text-muted-foreground">
                            KES {Number(expense.amount).toLocaleString()} · {expense.branch?.name}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm" variant="outline"
                            onClick={() => rejectExpenseMutation.mutate({ id: expense.id, reason: 'Rejected by admin' })}
                          >
                            Reject
                          </Button>
                          <Button size="sm" onClick={() => approveExpenseMutation.mutate(expense.id)}>
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

      {/* ── Device Code Dialog ─────────────────────────────────────── */}
      <Dialog open={!!approvedDevice} onOpenChange={(open) => !open && setApprovedDevice(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5" /> New Code Generated
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <p className="text-sm text-muted-foreground">
              A fresh code has been generated for {approvedDevice?.userName}. Share it directly with the user.
            </p>

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

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">6-Digit Authorization Code</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-lg py-3 text-center">
                  <span className="text-3xl font-mono font-bold tracking-[0.4em] text-primary">
                    {approvedDevice?.code}
                  </span>
                </div>
                <Button
                  size="icon" variant="outline" className="shrink-0" title="Copy code"
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
            <Button className="w-full" onClick={() => setApprovedDevice(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Notifications
