import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/api';
import { useAuthStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Flame
} from 'lucide-react';
import { TransferDetailModal } from './TransferDetailModal';
import { CreateTransferModal } from './CreateTransferModal';

interface Transfer {
  id: string;
  transferCode: string;
  status: 'PENDING' | 'PARTIAL' | 'COMPLETED' | 'CANCELLED';
  fromBranch: { id: string; name: string };
  toBranch: { id: string; name: string };
  requestedBy: { id: string; name: string };
  items: TransferItem[];
  notes?: string;
  createdAt: string;
  respondedAt?: string;
}

interface TransferItem {
  id: string;
  product: { id: string; name: string; isLpg: boolean };
  quantity: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  lpgComponent: 'REFILL' | 'CYLINDER' | null;
  cylinder?: { id: string; serialNumber: string } | null;
  notes?: string;
}

const statusConfig = {
  PENDING: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
  PARTIAL: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: AlertCircle },
  COMPLETED: { color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle2 },
  CANCELLED: { color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
};

const itemStatusConfig = {
  PENDING: { color: 'bg-yellow-100 text-yellow-700', label: 'Pending' },
  ACCEPTED: { color: 'bg-green-100 text-green-700', label: 'Accepted' },
  REJECTED: { color: 'bg-red-100 text-red-700', label: 'Rejected' },
};

export default function TransfersPage() {
  const { user } = useAuthStore();
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const { data: transfers, isLoading, refetch } = useQuery({
    queryKey: ['transfers', activeTab],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeTab !== 'all') params.append('status', activeTab);
      const { data } = await api.get(`/inventory/transfers?${params}`);
      return data as Transfer[];
    },
  });

  const isIncoming = (transfer: Transfer) => transfer.toBranch.id === user?.branchId;
  const isOutgoing = (transfer: Transfer) => transfer.fromBranch.id === user?.branchId;

  const canRespond = (transfer: Transfer) => {
    return isIncoming(transfer) && 
           (transfer.status === 'PENDING' || transfer.status === 'PARTIAL') &&
           user?.role === 'BRANCH_MANAGER';
  };

  const canCancel = (transfer: Transfer) => {
    return isOutgoing(transfer) && 
           transfer.status === 'PENDING' &&
           (transfer.requestedBy.id === user?.id || user?.role === 'SUPER_ADMIN');
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transfers</h1>
          <p className="text-muted-foreground mt-1">
            Manage stock transfers between branches
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <ArrowRightLeft className="mr-2 h-4 w-4" />
          New Transfer
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="PENDING">Pending</TabsTrigger>
          <TabsTrigger value="PARTIAL">Partial</TabsTrigger>
          <TabsTrigger value="COMPLETED">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading transfers...</div>
          ) : !transfers?.length ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No transfers found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {transfers.map((transfer) => {
                const config = statusConfig[transfer.status];
                const StatusIcon = config.icon;
                const incoming = isIncoming(transfer);
                const outgoing = isOutgoing(transfer);

                return (
                  <Card 
                    key={transfer.id} 
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedTransfer(transfer)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-medium text-muted-foreground">
                              {transfer.transferCode}
                            </span>
                            <Badge variant="outline" className={config.color}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {transfer.status}
                            </Badge>
                            {incoming && (
                              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                Incoming
                              </Badge>
                            )}
                            {outgoing && (
                              <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                                Outgoing
                              </Badge>
                            )}
                          </div>

                          <p className="text-sm text-muted-foreground">
                            {transfer.fromBranch.name} 
                            <ArrowRightLeft className="inline mx-2 h-3 w-3" /> 
                            {transfer.toBranch.name}
                          </p>

                          <p className="text-xs text-muted-foreground">
                            Requested by {transfer.requestedBy.name} • {' '}
                            {new Date(transfer.createdAt).toLocaleDateString()}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {canRespond(transfer) && (
                            <Button size="sm" variant="default">
                              Respond
                            </Button>
                          )}
                          {canCancel(transfer) && (
                            <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700">
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Item summary */}
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex flex-wrap gap-2">
                          {transfer.items.map((item) => (
                            <Badge 
                              key={item.id} 
                              variant="secondary"
                              className={`text-xs ${itemStatusConfig[item.status].color}`}
                            >
                              {item.product.isLpg && item.lpgComponent && (
                                <Flame className="w-3 h-3 mr-1" />
                              )}
                              {item.product.name}
                              {item.lpgComponent && ` (${item.lpgComponent})`}
                              {item.cylinder && ` #${item.cylinder.serialNumber}`}
                              ×{item.quantity}
                              <span className="ml-1 opacity-75">
                                ({itemStatusConfig[item.status].label})
                              </span>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
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
