import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/api';
import { useAuthStore } from '@/store';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowRightLeft,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Package,
  ArrowDownLeft,
  ArrowUpRight,
  History,
} from 'lucide-react';
import { TransferDetailModal } from './TransferDetailModal';
import { CreateTransferModal } from './CreateTransferModal';

interface Transfer {
  id: string;
  transferCode: string;
  status: 'PENDING' | 'PARTIAL' | 'COMPLETED' | 'CANCELLED';
  fromBranch: { id: string; name: string };
  toBranch: { id: string; name: string };
  requestedBy: { id: string; firstName: string; lastName: string };
  items: TransferItem[];
  notes?: string;
  createdAt: string;
  respondedAt?: string;
}

interface TransferItem {
  id: string;
  product: { id: string; name: string };
  quantity: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  notes?: string;
}

const statusConfig = {
  PENDING:   { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock,         label: 'Pending' },
  PARTIAL:   { color: 'bg-blue-100 text-blue-800 border-blue-200',       icon: AlertCircle,   label: 'Partial' },
  COMPLETED: { color: 'bg-green-100 text-green-800 border-green-200',    icon: CheckCircle2,  label: 'Completed' },
  CANCELLED: { color: 'bg-red-100 text-red-800 border-red-200',          icon: XCircle,       label: 'Cancelled' },
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

  // Fetch all transfers for the user's branch — backend scopes by branchId
  const { data: allTransfers = [], isLoading, refetch } = useQuery({
    queryKey: ['transfers'],
    queryFn: async () => {
      const { data } = await api.get('/inventory/transfers');
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

  const canRespond = (t: Transfer) => {
    const isManager = user?.role === 'BRANCH_MANAGER' || user?.role === 'SUPER_ADMIN';
    return isIncoming(t) && isActive(t) && isManager;
  };

  const canCancel = (t: Transfer) =>
    isOutgoing(t) &&
    t.status === 'PENDING' &&
    (t.requestedBy.id === user?.id || user?.role === 'SUPER_ADMIN');

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
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setSelectedTransfer(transfer)}
      >
        <CardContent className="p-4 space-y-3">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0">
              {/* Direction + status */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cfg.color}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {cfg.label}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    incoming
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : 'bg-gray-50 text-gray-700 border-gray-200'
                  }
                >
                  {incoming ? (
                    <><ArrowDownLeft className="w-3 h-3 mr-1" />Incoming</>
                  ) : (
                    <><ArrowUpRight className="w-3 h-3 mr-1" />Outgoing</>
                  )}
                </Badge>
              </div>

              {/* Branch route */}
              <p className="text-sm font-medium truncate">
                {transfer.fromBranch.name}
                <ArrowRightLeft className="inline mx-2 h-3 w-3 text-muted-foreground" />
                {transfer.toBranch.name}
              </p>

              {/* Meta */}
              <p className="text-xs text-muted-foreground">
                {transfer.requestedBy.firstName} {transfer.requestedBy.lastName}
                {' · '}
                {new Date(transfer.createdAt).toLocaleDateString()}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              {canRespond(transfer) && (
                <Button size="sm" onClick={() => setSelectedTransfer(transfer)}>
                  Respond
                </Button>
              )}
              {canCancel(transfer) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:text-red-700 border-red-200"
                  onClick={() => setSelectedTransfer(transfer)}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>

          {/* Items — one line each, no TRF code */}
          <div className="pt-2 border-t space-y-1">
            {transfer.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground">
                  {item.product.name} ×{item.quantity}
                </span>
                <Badge
                  variant="secondary"
                  className={`text-xs ${itemStatusConfig[item.status].color}`}
                >
                  {itemStatusConfig[item.status].label}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 p-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transfers</h1>
          <p className="text-muted-foreground mt-1">Manage stock transfers between branches</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <ArrowRightLeft className="mr-2 h-4 w-4" />
          New Transfer
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="incoming" className="flex items-center gap-1">
            <ArrowDownLeft className="h-4 w-4" />
            Incoming
            {tabTransfers.incoming.length > 0 && (
              <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-purple-600">
                {tabTransfers.incoming.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="outgoing" className="flex items-center gap-1">
            <ArrowUpRight className="h-4 w-4" />
            Outgoing
            {tabTransfers.outgoing.length > 0 && (
              <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-gray-600">
                {tabTransfers.outgoing.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        {isLoading ? (
          <div className="mt-6 text-center py-12 text-muted-foreground text-sm">
            Loading transfers...
          </div>
        ) : (
          <>
            <TabsContent value="incoming" className="mt-4 space-y-3">
              {tabTransfers.incoming.length === 0 ? (
                <EmptyState message="No incoming transfers waiting for your response" />
              ) : (
                tabTransfers.incoming.map((t) => <TransferCard key={t.id} transfer={t} />)
              )}
            </TabsContent>

            <TabsContent value="outgoing" className="mt-4 space-y-3">
              {tabTransfers.outgoing.length === 0 ? (
                <EmptyState message="No outgoing transfers pending" />
              ) : (
                tabTransfers.outgoing.map((t) => <TransferCard key={t.id} transfer={t} />)
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-4 space-y-3">
              {tabTransfers.history.length === 0 ? (
                <EmptyState message="No completed or cancelled transfers yet" />
              ) : (
                tabTransfers.history.map((t) => <TransferCard key={t.id} transfer={t} />)
              )}
            </TabsContent>
          </>
        )}
      </Tabs>

      {selectedTransfer && (
        <TransferDetailModal
          transfer={selectedTransfer}
          onClose={() => setSelectedTransfer(null)}
          onUpdate={refetch}
        />
      )}

      {isCreateOpen && (
        <CreateTransferModal
          onClose={() => setIsCreateOpen(false)}
          onSuccess={refetch}
        />
      )}
    </div>
  );
}
