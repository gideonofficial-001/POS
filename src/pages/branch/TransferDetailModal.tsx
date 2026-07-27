import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api';
import { useAuthStore } from '@/store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  Flame,
  MapPin,
  User,
  Calendar,
  AlertTriangle,
} from 'lucide-react';

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
  product: { id: string; name: string; isLpg: boolean; unit?: string };
  quantity: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  lpgComponent: 'REFILL' | 'CYLINDER' | null;
  cylinder?: { id: string; serialNumber: string } | null;
  notes?: string;
}

interface Props {
  transfer: Transfer;
  onClose: () => void;
  onUpdate: () => void;
}

const statusConfig = {
  PENDING: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  PARTIAL: { color: 'bg-blue-100 text-blue-800', icon: AlertTriangle },
  COMPLETED: { color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  CANCELLED: { color: 'bg-red-100 text-red-800', icon: XCircle },
};

const itemStatusConfig = {
  PENDING: { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Pending Response' },
  ACCEPTED: { color: 'bg-green-100 text-green-700 border-green-200', label: 'Accepted' },
  REJECTED: { color: 'bg-red-100 text-red-700 border-red-200', label: 'Rejected' },
};

export function TransferDetailModal({ transfer, onClose, onUpdate }: Props) {
  const { user } = useAuthStore();
  const [itemResponses, setItemResponses] = useState<Record<string, { status: 'ACCEPTED' | 'REJECTED' | null; notes: string }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isIncoming = transfer.toBranch.id === user?.branchId;
  const isOutgoing = transfer.fromBranch.id === user?.branchId;
  const canRespond = isIncoming && (transfer.status === 'PENDING' || transfer.status === 'PARTIAL');

  const respondMutation = useMutation({
    mutationFn: async (data: { items: { itemId: string; status: 'ACCEPTED' | 'REJECTED'; notes?: string }[] }) => {
      return api.post(`/inventory/transfers/${transfer.id}/respond`, data);
    },
    onSuccess: () => {
      toast.success('Transfer response submitted successfully');
      onUpdate();
      onClose();
    },
    onError: (err: any) => {
      toast.error('Failed to respond', {
        description: err.response?.data?.message || 'Something went wrong',
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      return api.post(`/inventory/transfers/${transfer.id}/cancel`);
    },
    onSuccess: () => {
      toast.success('Transfer cancelled');
      onUpdate();
      onClose();
    },
    onError: (err: any) => {
      toast.error('Failed to cancel', {
        description: err.response?.data?.message || 'Something went wrong',
      });
    },
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

  const handleSubmitResponse = async () => {
    const responses = Object.entries(itemResponses)
      .filter(([_, data]) => data.status !== null)
      .map(([itemId, data]) => ({
        itemId,
        status: data.status!,
        notes: data.notes,
      }));

    if (responses.length === 0) {
      toast.error('Please select at least one item to respond to');
      return;
    }

    setIsSubmitting(true);
    await respondMutation.mutateAsync({ items: responses });
    setIsSubmitting(false);
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this transfer?')) return;
    await cancelMutation.mutateAsync();
  };

  const statusConfigItem = statusConfig[transfer.status];
  const StatusIcon = statusConfigItem.icon;

  // Count items by status
  const pendingItems = transfer.items.filter((i) => i.status === 'PENDING');
  const acceptedItems = transfer.items.filter((i) => i.status === 'ACCEPTED');
  const rejectedItems = transfer.items.filter((i) => i.status === 'REJECTED');

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Transfer {transfer.transferCode}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Transfer Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> From
              </span>
              <p className="font-medium">{transfer.fromBranch.name}</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> To
              </span>
              <p className="font-medium">{transfer.toBranch.name}</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" /> Requested By
              </span>
              <p className="font-medium">{transfer.requestedBy.name}</p>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Date
              </span>
              <p className="font-medium">{new Date(transfer.createdAt).toLocaleString()}</p>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <Badge className={statusConfigItem.color}>
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

          {/* Summary */}
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1 text-yellow-700">
              <Clock className="h-4 w-4" />
              <span>{pendingItems.length} pending</span>
            </div>
            <div className="flex items-center gap-1 text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              <span>{acceptedItems.length} accepted</span>
            </div>
            <div className="flex items-center gap-1 text-red-700">
              <XCircle className="h-4 w-4" />
              <span>{rejectedItems.length} rejected</span>
            </div>
          </div>

          {/* Notes */}
          {transfer.notes && (
            <div className="bg-gray-50 p-3 rounded-md text-sm">
              <span className="text-muted-foreground">Notes:</span>
              <p className="mt-1">{transfer.notes}</p>
            </div>
          )}

          {/* Items List */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Transfer Items</h3>
            {transfer.items.map((item) => {
              const itemConfig = itemStatusConfig[item.status];
              const response = itemResponses[item.id];

              return (
                <div
                  key={item.id}
                  className={`border rounded-lg p-4 space-y-3 ${
                    item.status === 'PENDING' && canRespond
                      ? 'border-dashed border-gray-300'
                      : itemConfig.color
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {item.product.isLpg && <Flame className="h-4 w-4 text-orange-500" />}
                        <span className="font-medium">{item.product.name}</span>
                        {item.lpgComponent && (
                          <Badge variant="outline" className="text-xs">
                            {item.lpgComponent}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Quantity: {item.quantity} {item.product.unit || 'units'}
                      </p>
                      {item.cylinder && (
                        <p className="text-xs text-muted-foreground font-mono">
                          Cylinder: #{item.cylinder.serialNumber}
                        </p>
                      )}
                    </div>
                    <Badge className={itemConfig.color}>
                      {itemConfig.label}
                    </Badge>
                  </div>

                  {/* Response controls for pending items */}
                  {item.status === 'PENDING' && canRespond && (
                    <div className="space-y-3 pt-2 border-t border-dashed">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={response?.status === 'ACCEPTED' ? 'default' : 'outline'}
                          className={response?.status === 'ACCEPTED' ? 'bg-green-600 hover:bg-green-700' : ''}
                          onClick={() => handleItemResponse(item.id, 'ACCEPTED')}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant={response?.status === 'REJECTED' ? 'default' : 'outline'}
                          className={response?.status === 'REJECTED' ? 'bg-red-600 hover:bg-red-700' : ''}
                          onClick={() => handleItemResponse(item.id, 'REJECTED')}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>

                      {response?.status && (
                        <div className="space-y-1">
                          <Label className="text-xs">Notes (optional)</Label>
                          <Textarea
                            placeholder={`Reason for ${response.status.toLowerCase()}...`}
                            className="text-sm min-h-[60px]"
                            value={response.notes || ''}
                            onChange={(e) => handleItemNotes(item.id, e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Show existing notes */}
                  {item.notes && item.status !== 'PENDING' && (
                    <p className="text-xs text-muted-foreground pt-2 border-t">
                      <span className="font-medium">Note:</span> {item.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="gap-2">
          {canRespond && pendingItems.length > 0 && (
            <Button
              onClick={handleSubmitResponse}
              disabled={isSubmitting || Object.values(itemResponses).filter((r) => r.status).length === 0}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Response'}
            </Button>
          )}
          {isOutgoing && transfer.status === 'PENDING' && (
            <Button variant="outline" className="text-red-600" onClick={handleCancel}>
              Cancel Transfer
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
