import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api, { branchesApi } from '@/api';
import { useAuthStore } from '@/store';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowRightLeft, Clock, CheckCircle2, XCircle, AlertCircle,
  Package, ArrowDownLeft, ArrowUpRight, History, Calendar,
  Building2, ChevronLeft, ChevronRight, Filter, RotateCcw,
} from 'lucide-react';
import { TransferDetailModal } from './TransferDetailModal';
import { CreateTransferModal } from './CreateTransferModal';

interface Transfer {
  id: string;
  status: 'PENDING' | 'PARTIAL' | 'COMPLETED' | 'CANCELLED';
  fromBranch: { id: string; name: string };
  toBranch: { id: string; name: string };
  requestedBy: { id: string; firstName: string; lastName: string };
  items: TransferItem[];
  notes?: string;
  createdAt: string;
}

interface TransferItem {
  id: string;
  product: { id: string; name: string; isLpg?: boolean; isCylinderTracked?: boolean };
  quantity: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  lpgComponent?: 'REFILL' | 'CYLINDER' | null; // 🚀 ADDED: Backend LPG tracking
  notes?: string;
}

const statusConfig = {
  PENDING:   { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock,        label: 'Pending' },
  PARTIAL:   { color: 'bg-blue-100 text-blue-800 border-blue-200',       icon: AlertCircle,  label: 'Partial' },
  COMPLETED: { color: 'bg-green-100 text-green-800 border-green-200',    icon: CheckCircle2, label: 'Completed' },
  CANCELLED: { color: 'bg-red-100 text-red-800 border-red-200',          icon: XCircle,      label: 'Cancelled' },
};

const itemStatusConfig = {
  PENDING:  { color: 'text-yellow-700 bg-yellow-50', label: 'Pending' },
  ACCEPTED: { color: 'text-green-700 bg-green-50',   label: 'Accepted' },
  REJECTED: { color: 'text-red-700 bg-red-50',       label: 'Rejected' },
};

export default function TransfersPage() {
  const { user } = useAuthStore();
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing' | 'history'>('incoming');

  // ── History Filters & Pagination State ────────────────────
  const [historyPage, setHistoryPage] = useState(1);
  const [filterDate, setFilterDate] = useState('');
  const [filterBranch, setFilterBranch] = useState('all');
  const [filterDirection, setFilterDirection] = useState<'all' | 'incoming' | 'outgoing'>('all');
  const ITEMS_PER_PAGE = 10;

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await branchesApi.getAll();
      return res.data;
    },
  });

  const { data: allTransfers = [], isLoading, refetch } = useQuery({
    queryKey: ['transfers'],
    queryFn: async () => {
      const { data } = await api.get('/transfers');
      return data as Transfer[];
    },
  });

  const isIncoming = (t: Transfer) => t.toBranch.id === user?.branchId;
  const isOutgoing = (t: Transfer) => t.fromBranch.id === user?.branchId;
  const isActive   = (t: Transfer) => t.status === 'PENDING' || t.status === 'PARTIAL';
  const isHistory  = (t: Transfer) => t.status === 'COMPLETED' || t.status === 'CANCELLED';

  const tabTransfers = {
    incoming: allTransfers.filter((t) => isIncoming(t) && isActive(t)),
    outgoing: allTransfers.filter((t) => isOutgoing(t) && isActive(t)),
    history:  allTransfers.filter((t) => isHistory(t)),
  };

  const isAnyFilterActive = Boolean(filterDate || filterBranch !== 'all' || filterDirection !== 'all');

  const handleResetFilters = () => {
    setFilterDate('');
    setFilterBranch('all');
    setFilterDirection('all');
    setHistoryPage(1);
  };

  // ── History Filter Logic ──────────────────────────────────
  const filteredHistory = useMemo(() => {
    return tabTransfers.history.filter((t) => {
      // Date filter (local timezone comparison)
      if (filterDate) {
        const transferDate = new Date(t.createdAt).toLocaleDateString('en-CA');
        if (transferDate !== filterDate) return false;
      }
      // Branch filter (either sender or receiver)
      if (filterBranch !== 'all') {
        if (t.fromBranch.id !== filterBranch && t.toBranch.id !== filterBranch) {
          return false;
        }
      }
      // Direction filter
      if (filterDirection === 'incoming' && !isIncoming(t)) return false;
      if (filterDirection === 'outgoing' && !isOutgoing(t)) return false;

      return true;
    });
  }, [tabTransfers.history, filterDate, filterBranch, filterDirection, user?.branchId]);

  // ── History Pagination Logic ──────────────────────────────
  const totalHistoryPages = Math.max(1, Math.ceil(filteredHistory.length / ITEMS_PER_PAGE));
  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * ITEMS_PER_PAGE;
    return filteredHistory.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredHistory, historyPage]);

  const canRespond = (t: Transfer) => {
    const isManager = user?.role === 'BRANCH_MANAGER' || user?.role === 'SUPER_ADMIN';
    return isIncoming(t) && isActive(t) && isManager;
  };

  const canCancel = (t: Transfer) =>
    isOutgoing(t) && t.status === 'PENDING' &&
    (t.requestedBy.id === user?.id || user?.role === 'SUPER_ADMIN');

  // 🚀 ADDED: Helper to translate backend LPG data into beautiful labels
  const getVariantLabel = (item: TransferItem) => {
    const isLpg = item.product.isLpg || item.product.isCylinderTracked;
    if (isLpg) {
      if (item.lpgComponent === 'REFILL') return <span className="text-blue-600 font-semibold text-xs ml-1">(Gas Refill)</span>;
      if (item.lpgComponent === 'CYLINDER') return <span className="text-purple-600 font-semibold text-xs ml-1">(Complete Set)</span>;
      if (!item.lpgComponent) return <span className="text-amber-600 font-semibold text-xs ml-1">(Empty Shell)</span>;
    }
    return null;
  };

  const EmptyState = ({ message }: { message: string }) => (
    <Card>
      <CardContent className="py-12 text-center text-muted-foreground">
        <Package className="mx-auto h-12 w-12 mb-4 opacity-30" />
        <p className="text-sm">{message}</p>
      </CardContent>
    </Card>
  );

  const TransferCard = ({ transfer }: { transfer: Transfer }) => {
    const cfg = statusConfig[transfer.status];
    const StatusIcon = cfg.icon;
    const incoming = isIncoming(transfer);

    return (
      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedTransfer(transfer)}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cfg.color}>
                  <StatusIcon className="w-3 h-3 mr-1" />{cfg.label}
                </Badge>
                <Badge variant="outline" className={incoming
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : 'bg-gray-50 text-gray-700 border-gray-200'}>
                  {incoming
                    ? <><ArrowDownLeft className="w-3 h-3 mr-1" />Incoming</>
                    : <><ArrowUpRight className="w-3 h-3 mr-1" />Outgoing</>}
                </Badge>
              </div>
              <p className="text-sm font-medium truncate">
                {transfer.fromBranch.name}
                <ArrowRightLeft className="inline mx-2 h-3 w-3 text-muted-foreground" />
                {transfer.toBranch.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {transfer.requestedBy.firstName} {transfer.requestedBy.lastName}
                {' · '}{new Date(transfer.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex flex-col gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              {canRespond(transfer) && (
                <Button size="sm" onClick={() => setSelectedTransfer(transfer)}>Respond</Button>
              )}
              {canCancel(transfer) && (
                <Button size="sm" variant="outline"
                  className="text-red-600 hover:text-red-700 border-red-200"
                  onClick={() => setSelectedTransfer(transfer)}>
                  Cancel
                </Button>
              )}
            </div>
          </div>

          <div className="pt-2 border-t space-y-1">
            {transfer.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span>{item.product.name} {getVariantLabel(item)} ×{item.quantity}</span>
                <Badge variant="secondary" className={`text-xs ${itemStatusConfig[item.status].color}`}>
                  {itemStatusConfig[item.status].label}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  const handleUpdate = async () => {
    const res = await refetch();
    if (selectedTransfer && res.data) {
      const updated = res.data.find((t: Transfer) => t.id === selectedTransfer.id);
      if (updated) setSelectedTransfer(updated);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transfers</h1>
          <p className="text-muted-foreground mt-1">Manage stock transfers between branches</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <ArrowRightLeft className="mr-2 h-4 w-4" />New Transfer
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="incoming" className="flex items-center gap-1">
            <ArrowDownLeft className="h-4 w-4" />Incoming
            {tabTransfers.incoming.length > 0 && (
              <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-purple-600 text-white">
                {tabTransfers.incoming.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="outgoing" className="flex items-center gap-1">
            <ArrowUpRight className="h-4 w-4" />Outgoing
            {tabTransfers.outgoing.length > 0 && (
              <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-gray-600 text-white">
                {tabTransfers.outgoing.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1">
            <History className="h-4 w-4" />History
          </TabsTrigger>
        </TabsList>

        {isLoading ? (
          <div className="mt-6 text-center py-12 text-muted-foreground text-sm">Loading transfers...</div>
        ) : (
          <>
            <TabsContent value="incoming" className="mt-4 space-y-3">
              {tabTransfers.incoming.length === 0
                ? <EmptyState message="No incoming transfers waiting for your response" />
                : tabTransfers.incoming.map((t) => <TransferCard key={t.id} transfer={t} />)}
            </TabsContent>
            <TabsContent value="outgoing" className="mt-4 space-y-3">
              {tabTransfers.outgoing.length === 0
                ? <EmptyState message="No outgoing transfers pending" />
                : tabTransfers.outgoing.map((t) => <TransferCard key={t.id} transfer={t} />)}
            </TabsContent>
            <TabsContent value="history" className="mt-4 space-y-4">
              {/* ── Filters Bar ── */}
              <div className="bg-card border rounded-xl p-3 sm:p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between gap-2 border-b pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <Filter className="w-3.5 h-3.5 text-primary" /> Filter History
                  </div>
                  {isAnyFilterActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleResetFilters}
                      className="h-7 text-xs text-muted-foreground hover:text-foreground px-2"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" /> Reset Filters
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Date Filter */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> Date
                    </label>
                    <Input
                      type="date"
                      value={filterDate}
                      onChange={(e) => {
                        setFilterDate(e.target.value);
                        setHistoryPage(1);
                      }}
                      className="h-9 text-xs sm:text-sm bg-background"
                    />
                  </div>

                  {/* Branch Filter */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" /> Branch
                    </label>
                    <select
                      value={filterBranch}
                      onChange={(e) => {
                        setFilterBranch(e.target.value);
                        setHistoryPage(1);
                      }}
                      className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="all">All Branches</option>
                      {branches.map((b: any) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Direction Filter */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <ArrowRightLeft className="w-3.5 h-3.5" /> Direction
                    </label>
                    <select
                      value={filterDirection}
                      onChange={(e) => {
                        setFilterDirection(e.target.value as any);
                        setHistoryPage(1);
                      }}
                      className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="all">All Directions</option>
                      <option value="incoming">Incoming</option>
                      <option value="outgoing">Outgoing</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ── Content List ── */}
              {filteredHistory.length === 0 ? (
                <EmptyState
                  message={
                    isAnyFilterActive
                      ? 'No transfers match the selected filters'
                      : 'No completed or cancelled transfers yet'
                  }
                />
              ) : (
                <div className="space-y-3">
                  {paginatedHistory.map((t) => (
                    <TransferCard key={t.id} transfer={t} />
                  ))}

                  {/* ── Pagination Controls ── */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-card border rounded-lg shadow-sm text-xs text-muted-foreground">
                    <div>
                      Showing <span className="font-semibold text-foreground">{(historyPage - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
                      <span className="font-semibold text-foreground">{Math.min(historyPage * ITEMS_PER_PAGE, filteredHistory.length)}</span> of{' '}
                      <span className="font-semibold text-foreground">{filteredHistory.length}</span> transfers
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => setHistoryPage((prev) => Math.max(prev - 1, 1))}
                        disabled={historyPage === 1}
                      >
                        <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Previous
                      </Button>
                      <span className="font-medium px-1 text-foreground">
                        Page {historyPage} of {totalHistoryPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => setHistoryPage((prev) => Math.min(prev + 1, totalHistoryPages))}
                        disabled={historyPage === totalHistoryPages}
                      >
                        Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>

      {selectedTransfer && (
        <TransferDetailModal
          transfer={selectedTransfer}
          onClose={() => setSelectedTransfer(null)}
          onUpdate={handleUpdate}
        />
      )}

      {isCreateOpen && (
        <CreateTransferModal onClose={() => setIsCreateOpen(false)} onSuccess={refetch} />
      )}
    </div>
  );
}
