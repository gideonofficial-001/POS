import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Package, Flame, AlertCircle } from 'lucide-react';

interface Branch {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  isLpg: boolean;
  hasRefill: boolean;
  hasCylinder: boolean;
  inventory: { quantity: number }[];
}

interface Cylinder {
  id: string;
  serialNumber: string;
  productId: string;
  status: string;
}

interface TransferItemForm {
  id: string; // temp id
  productId: string;
  quantity: number;
  lpgComponent?: 'REFILL' | 'CYLINDER';
  cylinderId?: string;
  notes?: string;
}

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateTransferModal({ onClose, onSuccess }: Props) {
  const { user } = useAuthStore();
  const [toBranchId, setToBranchId] = useState('');
  const [items, setItems] = useState<TransferItemForm[]>([]);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data } = await api.get('/branches');
      return data.filter((b: Branch) => b.id !== user?.branchId);
    },
  });

  const { data: products } = useQuery({
    queryKey: ['products', 'with-inventory'],
    queryFn: async () => {
      const { data } = await api.get('/products');
      return data as Product[];
    },
  });

  const { data: cylinders } = useQuery({
    queryKey: ['cylinders', 'available'],
    queryFn: async () => {
      const { data } = await api.get('/inventory/cylinders?status=FULL');
      return data as Cylinder[];
    },
    enabled: items.some((i) => i.lpgComponent === 'CYLINDER'),
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return api.post('/inventory/transfers', data);
    },
    onSuccess: () => {
      toast.success('Transfer created successfully');
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      toast.error('Failed to create transfer', {
        description: err.response?.data?.message || 'Something went wrong',
      });
    },
  });

  const addItem = () => {
    setItems([...items, { id: crypto.randomUUID(), productId: '', quantity: 1 }]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter((i) => i.id !== id));
  };

  const updateItem = (id: string, updates: Partial<TransferItemForm>) => {
    setItems(items.map((i) => (i.id === id ? { ...i, ...updates } : i)));
  };

  const getProduct = (productId: string) => products?.find((p) => p.id === productId);

  const getAvailableStock = (productId: string) => {
    const product = getProduct(productId);
    return product?.inventory?.[0]?.quantity || 0;
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!toBranchId) newErrors.toBranch = 'Please select a destination branch';
    if (items.length === 0) newErrors.items = 'Add at least one item';

    items.forEach((item, idx) => {
      if (!item.productId) newErrors[`item_${idx}_product`] = 'Select a product';
      if (item.quantity < 1) newErrors[`item_${idx}_qty`] = 'Quantity must be at least 1';

      const stock = getAvailableStock(item.productId);
      if (item.quantity > stock) {
        newErrors[`item_${idx}_qty`] = `Only ${stock} available in stock`;
      }

      const product = getProduct(item.productId);
      if (product?.isLpg && !item.lpgComponent) {
        newErrors[`item_${idx}_lpg`] = 'Select refill or cylinder';
      }
      if (item.lpgComponent === 'CYLINDER' && !item.cylinderId) {
        newErrors[`item_${idx}_cyl`] = 'Select a cylinder';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const payload = {
      toBranchId,
      notes: notes || undefined,
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        ...(item.lpgComponent && { lpgComponent: item.lpgComponent }),
        ...(item.cylinderId && { cylinderId: item.cylinderId }),
        ...(item.notes && { notes: item.notes }),
      })),
    };

    createMutation.mutate(payload);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Create New Transfer
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Destination Branch */}
          <div className="space-y-2">
            <Label>To Branch</Label>
            <Select value={toBranchId} onValueChange={setToBranchId}>
              <SelectTrigger className={errors.toBranch ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select destination branch" />
              </SelectTrigger>
              <SelectContent>
                {branches?.map((branch: Branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.toBranch && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {errors.toBranch}
              </p>
            )}
          </div>

          {/* Transfer Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Items</Label>
              <Button type="button" size="sm" variant="outline" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />
                Add Item
              </Button>
            </div>

            {errors.items && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {errors.items}
              </p>
            )}

            {items.length === 0 && (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                <Package className="mx-auto h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No items added yet</p>
                <p className="text-xs">Click "Add Item" to start</p>
              </div>
            )}

            {items.map((item, idx) => {
              const product = getProduct(item.productId);
              const stock = getAvailableStock(item.productId);

              return (
                <div key={item.id} className="border rounded-lg p-4 space-y-3 bg-gray-50/50">
                  <div className="flex items-start justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Item {idx + 1}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-red-500"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Product Select */}
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Product</Label>
                      <Select
                        value={item.productId}
                        onValueChange={(val) => {
                          updateItem(item.id, { productId: val, lpgComponent: undefined, cylinderId: undefined });
                        }}
                      >
                        <SelectTrigger className={errors[`item_${idx}_product`] ? 'border-red-500' : ''}>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products?.map((p: Product) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} {p.isLpg && <Flame className="inline h-3 w-3 text-orange-500 ml-1" />}
                              {' '}({p.inventory?.[0]?.quantity || 0} in stock)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors[`item_${idx}_product`] && (
                        <p className="text-xs text-red-500">{errors[`item_${idx}_product`]}</p>
                      )}
                    </div>

                    {/* Quantity */}
                    <div className="space-y-1">
                      <Label className="text-xs">Quantity</Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, { quantity: parseInt(e.target.value) || 1 })}
                        className={errors[`item_${idx}_qty`] ? 'border-red-500' : ''}
                      />
                      {product && (
                        <p className="text-xs text-muted-foreground">
                          Available: {stock}
                        </p>
                      )}
                      {errors[`item_${idx}_qty`] && (
                        <p className="text-xs text-red-500">{errors[`item_${idx}_qty`]}</p>
                      )}
                    </div>

                    {/* LPG Component (if applicable) */}
                    {product?.isLpg && (
                      <div className="space-y-1">
                        <Label className="text-xs flex items-center gap-1">
                          <Flame className="h-3 w-3 text-orange-500" />
                          Type
                        </Label>
                        <Select
                          value={item.lpgComponent || ''}
                          onValueChange={(val: 'REFILL' | 'CYLINDER') => {
                            updateItem(item.id, { lpgComponent: val, cylinderId: undefined });
                          }}
                        >
                          <SelectTrigger className={errors[`item_${idx}_lpg`] ? 'border-red-500' : ''}>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {product.hasRefill && (
                              <SelectItem value="REFILL">Refill Only</SelectItem>
                            )}
                            {product.hasCylinder && (
                              <SelectItem value="CYLINDER">With Cylinder</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        {errors[`item_${idx}_lpg`] && (
                          <p className="text-xs text-red-500">{errors[`item_${idx}_lpg`]}</p>
                        )}
                      </div>
                    )}

                    {/* Cylinder Select (if cylinder type) */}
                    {item.lpgComponent === 'CYLINDER' && (
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Select Cylinder</Label>
                        <Select
                          value={item.cylinderId || ''}
                          onValueChange={(val) => updateItem(item.id, { cylinderId: val })}
                        >
                          <SelectTrigger className={errors[`item_${idx}_cyl`] ? 'border-red-500' : ''}>
                            <SelectValue placeholder="Select cylinder" />
                          </SelectTrigger>
                          <SelectContent>
                            {cylinders
                              ?.filter((c) => c.productId === item.productId)
                              .map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  #{c.serialNumber}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        {errors[`item_${idx}_cyl`] && (
                          <p className="text-xs text-red-500">{errors[`item_${idx}_cyl`]}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Notes per item */}
                  <div className="space-y-1">
                    <Label className="text-xs">Notes (optional)</Label>
                    <Textarea
                      placeholder="Any special instructions..."
                      className="text-sm min-h-[50px]"
                      value={item.notes || ''}
                      onChange={(e) => updateItem(item.id, { notes: e.target.value })}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Overall Notes */}
          <div className="space-y-2">
            <Label>Transfer Notes (optional)</Label>
            <Textarea
              placeholder="Any overall notes for this transfer..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending || items.length === 0}
          >
            {createMutation.isPending ? 'Creating...' : 'Create Transfer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
