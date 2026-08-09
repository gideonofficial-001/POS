import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { devicesApi } from '@/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { formatRelativeTime, formatDateTime } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Smartphone,
  MapPin,
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ShieldOff,
  Copy,
  Mail,
  MailX,
  User,
  Monitor,
} from 'lucide-react'

type TabValue = 'pending' | 'all'

const statusConfig: Record<string, { label: string; variant: 'warning' | 'success' | 'destructive' }> = {
  PENDING:  { label: 'Pending',  variant: 'warning' },
  APPROVED: { label: 'Approved', variant: 'success' },
  REVOKED:  { label: 'Revoked',  variant: 'destructive' },
}

// Parse a raw user-agent string into something human-readable
function parseUserAgent(ua: string | null | undefined): string {
  if (!ua) return 'Unknown device'
  if (ua.includes('iPhone'))  return `iPhone — ${ua.match(/OS [\d_]+/)?.[0]?.replace(/_/g, '.') ?? 'iOS'}`
  if (ua.includes('Android')) return `Android — ${ua.match(/Android [\d.]+/)?.[0] ?? ''}`
  if (ua.includes('iPad'))    return `iPad — ${ua.match(/OS [\d_]+/)?.[0]?.replace(/_/g, '.') ?? 'iPadOS'}`
  if (ua.includes('Windows')) return `Windows — ${ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : 'Browser'}`
  if (ua.includes('Mac'))     return `Mac — ${ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : ua.includes('Safari') ? 'Safari' : 'Browser'}`
  if (ua.includes('Linux'))   return `Linux — ${ua.includes('Chrome') ? 'Chrome' : 'Browser'}`
  return ua.substring(0, 60)
}

export default function AdminDevices() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<TabValue>('pending')

  // Code dialog after approval
  const [approvedDevice, setApprovedDevice] = useState<{
    code: string
    userName: string
    userEmail: string
    emailSent: boolean
    emailError: string | null
  } | null>(null)

  // All devices data
  const { data: allDevices = [], isLoading: loadingAll } = useQuery({
    queryKey: ['devices-all'],
    queryFn: async () => {
      const res = await devicesApi.getAll()
      return res.data
    },
    enabled: tab === 'all',
  })

  // Pending devices
  const { data: pendingDevices = [], isLoading: loadingPending } = useQuery({
    queryKey: ['pending-devices'],
    queryFn: async () => {
      const res = await devicesApi.getPending()
      return res.data
    },
    refetchInterval: 15_000, // poll every 15s so new requests appear quickly
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => devicesApi.approve(id),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['pending-devices'] })
      queryClient.invalidateQueries({ queryKey: ['devices-all'] })
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
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to approve device')
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => devicesApi.revoke(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices-all'] })
      queryClient.invalidateQueries({ queryKey: ['pending-devices'] })
      toast.success('Device revoked')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to revoke device')
    },
  })

  const isLoading = tab === 'pending' ? loadingPending : loadingAll
  const displayed  = tab === 'pending' ? pendingDevices : allDevices

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Smartphone className="w-6 h-6" /> Device Management
          </h1>
          <p className="text-muted-foreground text-sm">
            Approve new device login requests and manage existing devices
          </p>
        </div>
        {pendingDevices.length > 0 && (
          <Badge variant="warning" className="text-sm px-3 py-1 animate-pulse">
            {pendingDevices.length} pending approval{pendingDevices.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            Pending Approvals
            {pendingDevices.length > 0 && (
              <span className="ml-1 bg-amber-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {pendingDevices.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="all">All Devices</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Content */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Loading devices...
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ShieldCheck className="w-14 h-14 mx-auto mb-4 opacity-25" />
            <p className="font-medium">
              {tab === 'pending' ? 'No pending device requests' : 'No devices found'}
            </p>
            <p className="text-sm mt-1">
              {tab === 'pending'
                ? 'New requests will appear here when a branch manager logs in on an unrecognised device.'
                : 'Approved devices will show here after the first successful authorisation.'}
            </p>
          </div>
        ) : (
          displayed.map((device: any) => {
            const cfg           = statusConfig[device.status] ?? { label: device.status, variant: 'secondary' }
            const isPending     = device.status === 'PENDING'
            const isApproved    = device.status === 'APPROVED'
            const locationParts = [device.loginCity, device.loginRegion, device.loginCountry].filter(Boolean)
            const locationStr   = locationParts.length > 0 ? locationParts.join(', ') : null
            const parsedDevice  = parseUserAgent(device.name)

            return (
              <Card
                key={device.id}
                className={
                  isPending
                    ? 'border-amber-300 bg-amber-50/40 shadow-sm'
                    : 'hover:shadow-sm transition-shadow'
                }
              >
                <CardContent className="p-5 space-y-4">
                  {/* Top row: user info + status + action */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-base">
                          {device.user?.firstName} {device.user?.lastName}
                        </p>
                        <Badge variant={cfg.variant} className="text-xs">
                          {cfg.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <User className="w-3.5 h-3.5 shrink-0" />
                        <span>{device.user?.email}</span>
                      </div>
                      {device.user?.branch?.name && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Building2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{device.user.branch.name}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 shrink-0">
                      {isPending && (
                        <Button
                          size="sm"
                          disabled={approveMutation.isPending}
                          onClick={() => approveMutation.mutate(device.id)}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1.5" />
                          {approveMutation.isPending ? 'Approving…' : 'Approve'}
                        </Button>
                      )}
                      {isApproved && (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={revokeMutation.isPending}
                          onClick={() => revokeMutation.mutate(device.id)}
                        >
                          <ShieldOff className="w-4 h-4 mr-1.5" />
                          Revoke
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Location — highlighted for pending requests */}
                  {locationStr && (
                    <div
                      className={`flex items-center gap-2 text-sm font-medium rounded-md px-3 py-2 ${
                        isPending
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <MapPin className="w-4 h-4 shrink-0" />
                      <span>
                        {isPending ? 'Logging in from ' : 'Last login from '}
                        <span className={isPending ? 'text-amber-900 font-semibold' : ''}>
                          {locationStr}
                        </span>
                      </span>
                    </div>
                  )}

                  {/* Device details grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Monitor className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{parsedDevice}</span>
                    </div>
                    {device.loginIpAddress && (
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">IP:</span>
                        <span>{device.loginIpAddress}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span title={formatDateTime(device.createdAt)}>
                        Request: {formatRelativeTime(device.createdAt)}
                      </span>
                    </div>
                    {device.lastUsedAt && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span title={formatDateTime(device.lastUsedAt)}>
                          Last used: {formatRelativeTime(device.lastUsedAt)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Approved by (if applicable) */}
                  {device.approvedBy && (
                    <p className="text-xs text-muted-foreground border-t pt-2">
                      Approved by: {device.approvedBy.firstName} {device.approvedBy.lastName}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* ── Code Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={!!approvedDevice} onOpenChange={(open) => !open && setApprovedDevice(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-green-600" /> Device Approved
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <p className="text-sm text-muted-foreground">
              Share this code with{' '}
              <span className="font-semibold text-foreground">{approvedDevice?.userName}</span>{' '}
              directly (WhatsApp, call, or in-person). They need to enter it on the
              Device Authorization screen.
            </p>

            {/* Email status */}
            {approvedDevice?.emailSent ? (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                <Mail className="w-4 h-4 shrink-0" />
                <span>Also emailed to <strong>{approvedDevice.userEmail}</strong></span>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                <MailX className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{approvedDevice?.emailError ?? 'Email not configured — share the code below directly.'}</span>
              </div>
            )}

            {/* The code */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">6-Digit Authorization Code</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-xl py-4 text-center">
                  <span className="text-4xl font-mono font-bold tracking-[0.45em] text-primary">
                    {approvedDevice?.code}
                  </span>
                </div>
                <Button
                  size="icon"
                  variant="outline"
                  title="Copy code"
                  onClick={() => {
                    navigator.clipboard.writeText(approvedDevice?.code ?? '')
                    toast.success('Code copied!')
                  }}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Expires in 30 minutes · One-time use
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
