import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi, devicesApi, returnsApi, transfersApi, expensesApi } from '@/api'
import { useAuthStore } from '@/store'
import { UserRole } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatRelativeTime } from '@/lib/utils'
import { toast } from 'sonner'
import { Bell, CheckCircle, Smartphone, RotateCcw, ArrowLeftRight, Receipt, Check } from 'lucide-react'
import { useState } from 'react'

const Notifications = () => {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('notifications')
  const isAdmin = user?.role === UserRole.SUPER_ADMIN
  const isManager = user?.role === UserRole.OVERALL_MANAGER

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

  const { data: pendingTransfers } = useQuery({
    queryKey: ['pending-transfers'],
    queryFn: async () => {
      const response = await transfersApi.getAll({ status: 'PENDING' })
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-devices'] })
      toast.success('Device approved and code sent')
    },
  })

  const approveReturnMutation = useMutation({
    mutationFn: (id: string) => returnsApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-returns'] })
      toast.success('Return approved')
    },
  })

  const rejectReturnMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => returnsApi.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-returns'] })
      toast.success('Return rejected')
    },
  })

  const approveTransferMutation = useMutation({
    mutationFn: (id: string) => transfersApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-transfers'] })
      toast.success('Transfer approved')
    },
  })

  const approveExpenseMutation = useMutation({
    mutationFn: (id: string) => expensesApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-expenses'] })
      toast.success('Expense approved')
    },
  })

  const getIcon = (type: string) => {
    switch (type) {
      case 'DEVICE_AUTH': return <Smartphone className="w-5 h-5" />
      case 'RETURN_REQUEST': return <RotateCcw className="w-5 h-5" />
      case 'TRANSFER_REQUEST': return <ArrowLeftRight className="w-5 h-5" />
      case 'EXPENSE_SUBMITTED': return <Receipt className="w-5 h-5" />
      default: return <Bell className="w-5 h-5" />
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="text-muted-foreground">Stay updated with system activities</p>
      </div>

      {(isAdmin || isManager) && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="notifications">All Notifications</TabsTrigger>
            <TabsTrigger value="approvals">Pending Approvals ({pendingApprovals?.total || 0})</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {activeTab === 'notifications' && (
        <div className="space-y-2">
          {notifications?.length === 0 ? (
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
                    <p className="text-xs text-muted-foreground mt-1">{formatRelativeTime(notif.createdAt)}</p>
                  </div>
                  {notif.status === 'UNREAD' && (
                    <Button variant="ghost" size="icon" className="shrink-0" onClick={() => markReadMutation.mutate(notif.id)}>
                      <Check className="w-4 h-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {activeTab === 'approvals' && (isAdmin || isManager) && (
        <div className="space-y-6">
          {/* Pending Returns */}
          {pendingReturns && pendingReturns.length > 0 && (
            <div>
              <h3 className="font-bold mb-3 flex items-center gap-2"><RotateCcw className="w-5 h-5" /> Pending Returns ({pendingReturns.length})</h3>
              <div className="space-y-2">
                {pendingReturns.map((ret: any) => (
                  <Card key={ret.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{ret.returnCode} - Sale: {ret.sale?.saleCode}</p>
                          <p className="text-sm text-muted-foreground">Reason: {ret.reason}</p>
                          <p className="text-xs text-muted-foreground">By: {ret.user?.firstName} {ret.user?.lastName}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => rejectReturnMutation.mutate({ id: ret.id, reason: 'Rejected by admin' })}>Reject</Button>
                          <Button size="sm" onClick={() => approveReturnMutation.mutate(ret.id)}>Approve</Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Pending Devices */}
          {isAdmin && pendingDevices && pendingDevices.length > 0 && (
            <div>
              <h3 className="font-bold mb-3 flex items-center gap-2"><Smartphone className="w-5 h-5" /> Pending Devices ({pendingDevices.length})</h3>
              <div className="space-y-2">
                {pendingDevices.map((device: any) => (
                  <Card key={device.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{device.user?.firstName} {device.user?.lastName}</p>
                          <p className="text-sm text-muted-foreground">{device.deviceInfo}</p>
                          <p className="text-xs text-muted-foreground">{device.ipAddress}</p>
                        </div>
                        <Button size="sm" onClick={() => approveDeviceMutation.mutate(device.id)}>
                          <CheckCircle className="w-4 h-4 mr-1" /> Approve
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Pending Transfers */}
          {pendingTransfers && pendingTransfers.length > 0 && (
            <div>
              <h3 className="font-bold mb-3 flex items-center gap-2"><ArrowLeftRight className="w-5 h-5" /> Pending Transfers ({pendingTransfers.length})</h3>
              <div className="space-y-2">
                {pendingTransfers.map((transfer: any) => (
                  <Card key={transfer.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{transfer.transferCode}</p>
                          <p className="text-sm text-muted-foreground">{transfer.fromBranch?.name} to {transfer.toBranch?.name}</p>
                        </div>
                        <Button size="sm" onClick={() => approveTransferMutation.mutate(transfer.id)}>Approve</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Pending Expenses */}
          {pendingExpenses && pendingExpenses.length > 0 && (
            <div>
              <h3 className="font-bold mb-3 flex items-center gap-2"><Receipt className="w-5 h-5" /> Pending Expenses ({pendingExpenses.length})</h3>
              <div className="space-y-2">
                {pendingExpenses.map((expense: any) => (
                  <Card key={expense.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{expense.expenseCode} - {expense.category}</p>
                          <p className="text-sm text-muted-foreground">{expense.description}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => {}}>Reject</Button>
                          <Button size="sm" onClick={() => approveExpenseMutation.mutate(expense.id)}>Approve</Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {(!pendingReturns?.length && !pendingDevices?.length && !pendingTransfers?.length && !pendingExpenses?.length) && (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>All caught up! No pending approvals.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Notifications