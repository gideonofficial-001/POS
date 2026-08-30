import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { auditLogsApi } from '@/api'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/utils'
import { ClipboardList, Search, ChevronLeft, ChevronRight } from 'lucide-react'

const ITEMS_PER_PAGE = 15

const AuditLogs = () => {
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const { data: logs, isLoading } = useQuery({
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

  // Filter logs based on search query
  const filtered = useMemo(() => {
    if (!logs) return []
    if (!search.trim()) return logs
    const term = search.toLowerCase()
    return logs.filter((log: any) =>
      log.description?.toLowerCase().includes(term) ||
      log.action?.toLowerCase().includes(term) ||
      log.user?.email?.toLowerCase().includes(term) ||
      log.entityType?.toLowerCase().includes(term)
    )
  }, [logs, search])

  // Reset to first page when search query changes
  useEffect(() => {
    setCurrentPage(1)
  }, [search])

  // Compute pagination slices
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filtered.slice(start, start + ITEMS_PER_PAGE)
  }, [filtered, currentPage])

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
        <p className="text-muted-foreground">Track all system activities and security events</p>
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

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by action, user email, description, or entity..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table Card */}
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
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Loading audit records...
                  </TableCell>
                </TableRow>
              ) : paginatedLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    No audit logs found matching your filter
                  </TableCell>
                </TableRow>
              ) : (
                paginatedLogs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell>{getActionBadge(log.action)}</TableCell>
                    <TableCell className="max-w-xs truncate">{log.description}</TableCell>
                    <TableCell>{log.user?.email || 'System'}</TableCell>
                    <TableCell>{log.entityType}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDateTime(log.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between px-4 py-3 border-t bg-slate-50/50">
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-semibold">{filtered.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
              <span className="font-semibold">{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}</span> of{' '}
              <span className="font-semibold">{filtered.length}</span> entries
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1 || filtered.length === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </Button>
              <span className="text-xs font-medium px-2">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || filtered.length === 0}
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default AuditLogs
