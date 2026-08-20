import { useState } from 'react';
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
  product: { id: string; name: string; isCylinderTracked?: boolean };
  quantity: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  variant?: 'STANDARD' | 'REFILL' | 'EMPTY_SHELL';
  notes?: string;
}

interface Props {
  transfer: Transfer;
  onClose: () => void;
  onUpdate: () => void;
}

const statusConfig = {
  PENDING:   { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  PARTIAL:   { color: 'bg-blue-100 text-blue-800',    icon: AlertTriangle },
  COMPLETED: { color: 'bg-green-100 text-green-800',  icon: CheckCircle2 },
  CANCELLED: { color: 'bg-red-100 text-red-800',      icon: XCircle },
};

const itemStatusConfig = {
  PENDING:  { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Pending' },
  ACCEPTED: { color: 'bg-green-100 text-green-700 border-green-200',   label: 'Accepted' },
  REJECTED: { color: 'bg-red-100 text-red-700 border-red-200',         label: 'Rejected' },
};

const variantLabel = {
  STANDARD:    null,
  REFILL:      { label: 'Refill', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  EMPTY_SHELL: { label: 'Empty Shell', color: 'bg-gray-100 text-gray-700 border-gray-200' },
};

export function TransferDetailModal({ transfer, onClose, onUpdate }: Props) {
  const { user } = useAuthStore();
  const [itemResponses, setItemResponses] = useState<
    Record<string, { status: 'ACCEPTED' | 'REJECTED' | null; notes: string }>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isIncoming = transfer.toBranch.id === user?.branchId;
  const isOutgoing = transfer.fromBranch.id === user?.branchId;
  const canRespond =
    isIncoming &&
    (transfer.status === 'PENDING' || transfer.status === 'PARTIAL') &&
    (user?.role === 'BRANCH_MANAGER' || user?.role === 'SUPER_ADMIN');

  // Per-item approve
  const approveItemMutation = useMutation({
    mutationFn: (itemId: string) =>
      api.patch(`/transfers/${transfer.id}/items/${itemId}/approve`),
    onSuccess: () => { toast.success('Item accepted'); onUpdate(); },
    onError: (err: any) =>
      toast.error('Failed to accept', { description: err.response?.data?.message }),
  });

  // Per-item reject
  const rejectItemMutation = useMutation({
    mutationFn: ({ itemId, notes }: { itemId: string; notes?: string }) =>
      api.patch(`/transfers/${transfer.id}/items/${itemId}/reject`, {
        rejectionReason: notes || 'Rejected',
      }),
    onSuccess: () => { toast.success('Item rejected'); onUpdate(); },
    onError: (err: any) =>
      toast.error('Failed to reject', { description: err.response?.data?.message }),
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.patch(`/transfers/${transfer.id}/cancel`),
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
    setIsSubmitting(true);
    if (response.status === 'ACCEPTED') {
      await approveItemMutation.mutateAsync(itemId);
    } else {
      await rejectItemMutation.mutateAsync({ itemId, notes: response.notes });
    }
    setIsSubmitting(false);
    // Clear the response for this item after submitting
    setItemResponses((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this transfer?')) return;
    await cancelMutation.mutateAsync();
  };

  const cfg = statusConfig[transfer.status];
  const StatusIcon = cfg.icon;

  const pendingItems  = transfer.items.filter((i) => i.status === 'PENDING');
  const acceptedItems = transfer.items.filter((i) => i.status === 'ACCEPTED');
  const rejectedItems = transfer.items.filter((i) => i.status === 'REJECTED');

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
              <p className="font-medium">{transfer.fromBranch.name}</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <ArrowRightLeft className="h-3 w-3" /> To
              </span>
              <p className="font-medium">{transfer.toBranch.name}</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" /> Requested By
              </span>
              <p className="font-medium">
                {transfer.requestedBy.firstName} {transfer.requestedBy.lastName}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Date
              </span>
              <p className="font-medium">{new Date(transfer.createdAt).toLocaleString()}</p>
            </div>
          </div>

          {/* Status + direction badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cfg.color}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {transfer.status}
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
          {transfer.notes && (
            <div className="bg-gray-50 p-3 rounded-md text-sm">
              <span className="text-muted-foreground">Notes: </span>
              {transfer.notes}
            </div>
          )}

          {/* Items */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Transfer Items</h3>

            {transfer.items.map((item) => {
              const itemCfg = itemStatusConfig[item.status];
              const response = itemResponses[item.id];
              const vLabel = item.variant ? variantLabel[item.variant] : null;

              return (
                <div
                  key={item.id}
                  className={`border rounded-lg p-4 space-y-3 ${
                    item.status !== 'PENDING' ? itemCfg.color : 'border-dashed border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.product.isCylinderTracked && (
                          <Flame className="h-4 w-4 text-orange-500 shrink-0" />
                        )}
                        <span className="font-medium">{item.product.name}</span>
                        {vLabel && (
                          <Badge variant="outline" className={`text-xs ${vLabel.color}`}>
                            {vLabel.label}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Quantity: {item.quantity}
                      </p>
                      {item.notes && item.status !== 'PENDING' && (
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">Note:</span> {item.notes}
                        </p>
                      )}
                    </div>
                    <Badge className={itemCfg.color}>{itemCfg.label}</Badge>
                  </div>

                  {/* Per-item response controls — only for PENDING items when receiver */}
                  {item.status === 'PENDING' && canRespond && (
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
                            {response.status === 'REJECTED' ? 'Rejection reason (optional)' : 'Notes (optional)'}
                          </Label>
                          <Textarea
                            placeholder={`Notes for ${response.status.toLowerCase()}...`}
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
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="gap-2">
          {isOutgoing && transfer.status === 'PENDING' && (
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
