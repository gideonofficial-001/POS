import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { auditLogsApi } from '@/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/utils'
import { ClipboardList, Search } from 'lucide-react'

const AuditLogs = () => {
  const [search, setSearch] = useState('')

  const { data: logs } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const response = await auditLogsApi.getAll()
      return response.data
    },
  })

  const { data: stats } = useQuery({
    queryKey: ['audit-stats'],
    queryFn: async () => {
      const response = await auditLogsApi.getStats()
      return response.data
    },
  })

  const filtered = logs?.filter((log: any) => {
    if (!search) return true
    const term = search.toLowerCase()
    return log.description?.toLowerCase().includes(term) ||
      log.action?.toLowerCase().includes(term) ||
      log.user?.email?.toLowerCase().includes(term) ||
      log.entityType?.toLowerCase().includes(term)
  })

  const getActionBadge = (action: string) => {
    if (action.includes('CREATE')) return <Badge variant="success">Create</Badge>
    if (action.includes('UPDATE')) return <Badge variant="warning">Update</Badge>
    if (action.includes('DELETE')) return <Badge variant="destructive">Delete</Badge>
    if (action.includes('LOGIN') || action.includes('LOGOUT')) return <Badge variant="default">Auth</Badge>
    if (action.includes('APPROVE')) return <Badge variant="success">Approve</Badge>
    return <Badge variant="secondary">{action}</Badge>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <p className="text-muted-foreground">Track all system activities</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Logs</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Today</p>
              <p className="text-2xl font-bold">{stats.today}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search logs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    No audit logs found
                  </TableCell>
                </TableRow>
              ) : (
                filtered?.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell>{getActionBadge(log.action)}</TableCell>
                    <TableCell className="max-w-xs truncate">{log.description}</TableCell>
                    <TableCell>{log.user?.email || 'System'}</TableCell>
                    <TableCell>{log.entityType}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{formatDateTime(log.createdAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export default AuditLogs