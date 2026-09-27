import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '@/api';
import { useAuthStore } from '@/store';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  ArrowRightLeft, CheckCircle2, XCircle, Clock, Package,
  Flame, MapPin, User, Calendar, AlertTriangle,
} from 'lucide-react';

interface Transfer {
  id: string;
  transferCode?: string;
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
  product: { id: string; name: string; isCylinderTracked?: boolean; isLpg?: boolean };
  quantity: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  lpgComponent?: 'REFILL' | 'CYLINDER' | null;
  notes?: string;
}

interface Props {
  transfer: Transfer;
  onClose: () => void;
  onUpdate: () => void;
}

const statusConfig = {
  PENDING:   { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  PARTIAL:   { color: 'bg-blue-100 text-blue-800',     icon: AlertTriangle },
  COMPLETED: { color: 'bg-green-100 text-green-800',  icon: CheckCircle2 },
  CANCELLED: { color: 'bg-red-100 text-red-800',      icon: XCircle },
};

const itemStatusConfig = {
  PENDING:  { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Pending' },
  ACCEPTED: { color: 'bg-green-100 text-green-700 border-green-200',   label: 'Accepted' },
  REJECTED: { color: 'bg-red-100 text-red-700 border-red-200',         label: 'Rejected' },
};

export function TransferDetailModal({ transfer, onClose, onUpdate }: Props) {
  const { user } = useAuthStore();
  const [currentTransfer, setCurrentTransfer] = useState<Transfer>(transfer);
  const [itemResponses, setItemResponses] = useState<
    Record<string, { status: 'ACCEPTED' | 'REJECTED' | null; notes: string }>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setCurrentTransfer(transfer);
  }, [transfer]);

  const isIncoming = currentTransfer.toBranch.id === user?.branchId;
  const isOutgoing = currentTransfer.fromBranch.id === user?.branchId;
  const canRespond =
    isIncoming &&
    (currentTransfer.status === 'PENDING' || currentTransfer.status === 'PARTIAL') &&
    (user?.role === 'BRANCH_MANAGER' || user?.role === 'SUPER_ADMIN');

  const approveItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await api.patch(`/transfers/${currentTransfer.id}/items/${itemId}/approve`);
      return res.data as Transfer;
    },
    onSuccess: (updatedTransfer: Transfer) => {
      toast.success('Item accepted');
      setCurrentTransfer(updatedTransfer);
      onUpdate();
    },
    onError: (err: any) =>
      toast.error('Failed to accept', { description: err.response?.data?.message }),
  });

  const rejectItemMutation = useMutation({
    mutationFn: async ({ itemId, notes }: { itemId: string; notes?: string }) => {
      const res = await api.patch(`/transfers/${currentTransfer.id}/items/${itemId}/reject`, {
        rejectionReason: notes || 'Rejected',
      });
      return res.data as Transfer;
    },
    onSuccess: (updatedTransfer: Transfer) => {
      toast.success('Item rejected');
      setCurrentTransfer(updatedTransfer);
      onUpdate();
    },
    onError: (err: any) =>
      toast.error('Failed to reject', { description: err.response?.data?.message }),
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.patch(`/transfers/${currentTransfer.id}/cancel`),
    onSuccess: () => { toast.success('Transfer cancelled'); onUpdate(); onClose(); },
    onError: (err: any) =>
      toast.error('Failed to cancel', { description: err.response?.data?.message }),
  });

  const handleItemResponse = (itemId: string, status: 'ACCEPTED' | 'REJECTED') => {
    setItemResponses((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], status },
    }));
  };

  const handleItemNotes = (itemId: string, notes: string) => {
    setItemResponses((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], notes },
    }));
  };

  const handleSubmitItem = async (itemId: string) => {
    const response = itemResponses[itemId];
    if (!response?.status) {
      toast.error('Please select Accept or Reject first');
      return;
    }
    if (response.status === 'REJECTED' && !response.notes?.trim()) {
      toast.error('A rejection reason is required');
      return;
    }
    setIsSubmitting(true);
    try {
      if (response.status === 'ACCEPTED') {
        await approveItemMutation.mutateAsync(itemId);
      } else {
        await rejectItemMutation.mutateAsync({ itemId, notes: response.notes });
      }
      setItemResponses((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    } catch {
      // Handled by mutation onError
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this transfer?')) return;
    await cancelMutation.mutateAsync();
  };

  // 🚀 The Variant Label Helper
  const getVariantLabel = (item: TransferItem) => {
    const isLpg = item.product.isLpg || item.product.isCylinderTracked;
    if (isLpg) {
      if (item.lpgComponent === 'REFILL') return <span className="text-blue-600 font-semibold text-xs ml-1">(Gas Refill)</span>;
      if (item.lpgComponent === 'CYLINDER') return <span className="text-purple-600 font-semibold text-xs ml-1">(Complete Set)</span>;
      if (!item.lpgComponent) return <span className="text-amber-600 font-semibold text-xs ml-1">(Empty Shell)</span>;
    }
    return null;
  };

  const cfg = statusConfig[currentTransfer.status];
  const StatusIcon = cfg.icon;

  const pendingItems  = currentTransfer.items.filter((i) => i.status === 'PENDING');
  const acceptedItems = currentTransfer.items.filter((i) => i.status === 'ACCEPTED');
  const rejectedItems = currentTransfer.items.filter((i) => i.status === 'REJECTED');
  const respondedItems = currentTransfer.items.filter((i) => i.status !== 'PENDING');

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Transfer Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> From
              </span>
              <p className="font-medium">{currentTransfer.fromBranch.name}</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <ArrowRightLeft className="h-3 w-3" /> To
              </span>
              <p className="font-medium">{currentTransfer.toBranch.name}</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" /> Requested By
              </span>
              <p className="font-medium">
                {currentTransfer.requestedBy.firstName} {currentTransfer.requestedBy.lastName}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Date
              </span>
              <p className="font-medium">{new Date(currentTransfer.createdAt).toLocaleString()}</p>
            </div>
          </div>

          {/* Status + direction badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cfg.color}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {currentTransfer.status}
            </Badge>
            {isIncoming && (
              <Badge variant="outline" className="bg-purple-50 text-purple-700">
                Incoming to your branch
              </Badge>
            )}
            {isOutgoing && (
              <Badge variant="outline" className="bg-gray-50 text-gray-700">
                Outgoing from your branch
              </Badge>
            )}
          </div>

          {/* Summary counts */}
          <div className="flex gap-4 text-sm">
            <span className="text-yellow-700 flex items-center gap-1">
              <Clock className="h-4 w-4" /> {pendingItems.length} pending
            </span>
            <span className="text-green-700 flex items-center gap-1">
              <CheckCircle2 className="h-4 w-4" /> {acceptedItems.length} accepted
            </span>
            <span className="text-red-700 flex items-center gap-1">
              <XCircle className="h-4 w-4" /> {rejectedItems.length} rejected
            </span>
          </div>

          {/* Notes */}
          {currentTransfer.notes && (
            <div className="bg-gray-50 p-3 rounded-md text-sm">
              <span className="text-muted-foreground">Notes: </span>
              {currentTransfer.notes}
            </div>
          )}

          {/* Items */}
          <div className="space-y-4">
            {canRespond ? (
              <>
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">
                    Items Requiring Response ({pendingItems.length})
                  </h3>

                  {pendingItems.length === 0 ? (
                    <div className="p-4 bg-green-50 border border-green-200 text-green-800 rounded-lg text-center font-medium text-sm flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      All items in this transfer have been responded to!
                    </div>
                  ) : (
                    pendingItems.map((item) => {
                      const itemCfg = itemStatusConfig[item.status];
                      const response = itemResponses[item.id];

                      return (
                        <div
                          key={item.id}
                          className="border rounded-lg p-4 space-y-3 border-dashed border-gray-300 bg-card shadow-sm"
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {(item.product.isCylinderTracked || item.product.isLpg) && (
                                  <Flame className="h-4 w-4 text-orange-500 shrink-0" />
                                )}
                                <span className="font-medium">
                                  {item.product.name} {getVariantLabel(item)}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Quantity: {item.quantity}
                              </p>
                            </div>
                            <Badge className={itemCfg.color}>{itemCfg.label}</Badge>
                          </div>

                          {/* Response controls */}
                          <div className="space-y-2 pt-2 border-t border-dashed">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant={response?.status === 'ACCEPTED' ? 'default' : 'outline'}
                                className={response?.status === 'ACCEPTED' ? 'bg-green-600 hover:bg-green-700' : ''}
                                onClick={() => handleItemResponse(item.id, 'ACCEPTED')}
                                disabled={isSubmitting}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1" /> Accept
                              </Button>
                              <Button
                                size="sm"
                                variant={response?.status === 'REJECTED' ? 'default' : 'outline'}
                                className={response?.status === 'REJECTED' ? 'bg-red-600 hover:bg-red-700' : ''}
                                onClick={() => handleItemResponse(item.id, 'REJECTED')}
                                disabled={isSubmitting}
                              >
                                <XCircle className="w-4 h-4 mr-1" /> Reject
                              </Button>
                            </div>

                            {response?.status && (
                              <div className="space-y-1">
                                <Label className="text-xs">
                                  {response.status === 'REJECTED' ? 'Rejection reason (required)' : 'Notes (optional)'}
                                </Label>
                                <Textarea
                                  placeholder={response.status === 'REJECTED' ? 'Reason for rejection...' : 'Optional notes...'}
                                  className="text-sm min-h-[50px]"
                                  value={response.notes || ''}
                                  onChange={(e) => handleItemNotes(item.id, e.target.value)}
                                />
                                <Button
                                  size="sm"
                                  className="w-full"
                                  onClick={() => handleSubmitItem(item.id)}
                                  disabled={isSubmitting}
                                >
                                  {isSubmitting ? 'Submitting...' : `Confirm ${response.status === 'ACCEPTED' ? 'Acceptance' : 'Rejection'}`}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Responded items history in this transfer */}
                {respondedItems.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Responded Items ({respondedItems.length})
                    </h4>
                    <div className="space-y-2">
                      {respondedItems.map((item) => {
                        const itemCfg = itemStatusConfig[item.status];
                        return (
                          <div
                            key={item.id}
                            className={`border rounded-lg p-3 flex items-center justify-between text-sm ${itemCfg.color}`}
                          >
                            <div>
                              <div className="font-medium">
                                {item.product.name} {getVariantLabel(item)} ×{item.quantity}
                              </div>
                              {item.notes && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  <span className="font-medium">Note:</span> {item.notes}
                                </p>
                              )}
                            </div>
                            <Badge className={itemCfg.color}>{itemCfg.label}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <h3 className="font-semibold text-sm">Transfer Items</h3>
                <div className="space-y-3">
                  {currentTransfer.items.map((item) => {
                    const itemCfg = itemStatusConfig[item.status];
                    return (
                      <div
                        key={item.id}
                        className={`border rounded-lg p-4 space-y-2 ${
                          item.status !== 'PENDING' ? itemCfg.color : 'border-dashed border-gray-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {(item.product.isCylinderTracked || item.product.isLpg) && (
                                <Flame className="h-4 w-4 text-orange-500 shrink-0" />
                              )}
                              <span className="font-medium">
                                {item.product.name} {getVariantLabel(item)}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Quantity: {item.quantity}
                            </p>
                            {item.notes && (
                              <p className="text-xs text-muted-foreground">
                                <span className="font-medium">Note:</span> {item.notes}
                              </p>
                            )}
                          </div>
                          <Badge className={itemCfg.color}>{itemCfg.label}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          {isOutgoing && currentTransfer.status === 'PENDING' && (
            <Button
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Transfer'}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TransferDetailModal;
