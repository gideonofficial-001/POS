import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/api';
import { useAuthStore } from '@/store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, Package, AlertCircle } from 'lucide-react';

interface Branch { id: string; name: string; }

interface InventoryItem {
  id: string;
  productId: string;
  quantity: number;
  fullCylinders: number | null;
  product: { id: string; name: string; isCylinderTracked: boolean; };
}

interface TransferItemForm {
  id: string;
  productId: string;
  quantity: number;
  notes?: string;
}

export function CreateTransferModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuthStore();
  const [toBranchId, setToBranchId] = useState('');
  const [items, setItems] = useState<TransferItemForm[]>([]);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data } = await api.get('/branches');
      return (data as Branch[]).filter((b) => b.id !== user?.branchId);
    },
  });

  const { data: inventory } = useQuery({
    queryKey: ['inventory', 'branch', user?.branchId],
    queryFn: async () => {
      const { data } = await api.get(`/inventory?branchId=${user?.branchId}`);
      return data as InventoryItem[];
    },
    enabled: !!user?.branchId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => api.post('/transfers', data),
    onSuccess: () => { toast.success('Transfer created successfully'); onSuccess(); onClose(); },
    onError: (err: any) => {
      toast.error('Failed to create transfer', { description: err.response?.data?.message || 'Something went wrong' });
    },
  });

  const addItem = () => setItems([...items, { id: crypto.randomUUID(), productId: '', quantity: 1 }]);
  const removeItem = (id: string) => setItems(items.filter((i) => i.id !== id));
  const updateItem = (id: string, updates: Partial<TransferItemForm>) =>
    setItems(items.map((i) => (i.id === id ? { ...i, ...updates } : i)));

  const getAvailableStock = (productId: string): number => {
    const inv = inventory?.find((i) => i.productId === productId);
    if (!inv) return 0;
    return inv.product.isCylinderTracked && inv.fullCylinders != null ? inv.fullCylinders : inv.quantity;
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!toBranchId) errs.toBranch = 'Please select a destination branch';
    if (items.length === 0) errs.items = 'Add at least one item';
    items.forEach((item, idx) => {
      if (!item.productId) errs[`item_${idx}_product`] = 'Select a product';
      if (item.quantity < 1) errs[`item_${idx}_qty`] = 'Quantity must be at least 1';
      const stock = getAvailableStock(item.productId);
      if (item.productId && item.quantity > stock) errs[`item_${idx}_qty`] = `Only ${stock} available`;
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    createMutation.mutate({
      fromBranchId: user?.branchId,
      toBranchId,
      notes: notes || undefined,
      items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" /> Create New Transfer
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label>To Branch</Label>
            <Select value={toBranchId} onValueChange={setToBranchId}>
              <SelectTrigger className={errors.toBranch ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select destination branch" />
              </SelectTrigger>
              <SelectContent>
                {branches?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.toBranch && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.toBranch}</p>}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Items</Label>
              <Button type="button" size="sm" variant="outline" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" /> Add Item
              </Button>
            </div>

            {errors.items && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.items}</p>}

            {items.length === 0 && (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                <Package className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No items added yet</p>
              </div>
            )}

            {items.map((item, idx) => {
              const stock = getAvailableStock(item.productId);
              return (
                <div key={item.id} className="border rounded-lg p-4 space-y-3 bg-gray-50/50">
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Item {idx + 1}</span>
                    <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500" onClick={() => removeItem(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Product</Label>
                      <Select value={item.productId} onValueChange={(val) => updateItem(item.id, { productId: val })}>
                        <SelectTrigger className={errors[`item_${idx}_product`] ? 'border-red-500' : ''}>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {inventory?.map((inv) => {
                            const available = inv.product.isCylinderTracked && inv.fullCylinders != null
                              ? inv.fullCylinders : inv.quantity;
                            return (
                              <SelectItem key={inv.productId} value={inv.productId}>
                                {inv.product.name} ({available} in stock)
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      {errors[`item_${idx}_product`] && <p className="text-xs text-red-500">{errors[`item_${idx}_product`]}</p>}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Quantity</Label>
                      <Input type="number" min={1} max={stock || undefined} value={item.quantity}
                        onChange={(e) => updateItem(item.id, { quantity: parseInt(e.target.value) || 1 })}
                        className={errors[`item_${idx}_qty`] ? 'border-red-500' : ''} />
                      {item.productId && <p className="text-xs text-muted-foreground">Available: {stock}</p>}
                      {errors[`item_${idx}_qty`] && <p className="text-xs text-red-500">{errors[`item_${idx}_qty`]}</p>}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Notes (optional)</Label>
                      <Input placeholder="Any notes..." value={item.notes || ''}
                        onChange={(e) => updateItem(item.id, { notes: e.target.value })} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <Label>Transfer Notes (optional)</Label>
            <Textarea placeholder="Any overall notes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending || items.length === 0}>
            {createMutation.isPending ? 'Creating...' : 'Create Transfer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateTransferModal;
