import { useState, useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/api';
import { useAuthStore } from '@/store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Plus, Trash2, Package, AlertCircle, Search,
  Flame, CheckCircle2, ChevronDown, X,
} from 'lucide-react';

interface Branch { id: string; name: string }

interface InventoryItem {
  id: string;
  productId: string;
  quantity: number;
  fullCylinders: number | null;
  product: {
    id: string;
    name: string;
    type: string;
    isCylinderTracked: boolean;
    cylinderSize?: string;
    brand?: string;
  };
}

type Variant = 'STANDARD' | 'REFILL' | 'EMPTY_SHELL';

interface TransferItemForm {
  uid: string;           // local key only
  productId: string;
  quantity: number;
  variant: Variant;
}

// ── Product Picker ──────────────────────────────────────────────────────────

function ProductPicker({
  inventory,
  selectedProductIds,
  onSelect,
  onClose,
}: {
  inventory: InventoryItem[];
  selectedProductIds: string[];
  onSelect: (inv: InventoryItem) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return inventory.filter((inv) =>
      inv.product.name.toLowerCase().includes(q) ||
      inv.product.brand?.toLowerCase().includes(q) ||
      inv.product.cylinderSize?.toLowerCase().includes(q),
    );
  }, [inventory, search]);

  const getStockBadge = (inv: InventoryItem) => {
    const available = inv.product.isCylinderTracked && inv.fullCylinders != null
      ? inv.fullCylinders
      : inv.quantity;
    if (available <= 0)  return { label: 'Out of stock', class: 'bg-red-100 text-red-700' };
    if (available <= 5)  return { label: `${available} left`, class: 'bg-amber-100 text-amber-700' };
    return { label: `${available} in stock`, class: 'bg-green-100 text-green-700' };
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h3 className="font-semibold">Select Product</h3>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="p-3 border-b shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name, brand, size..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* Grid */}
        <div className="overflow-y-auto p-3 flex-1">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No products match "{search}"
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filtered.map((inv) => {
                const stock = getStockBadge(inv);
                const isLpg = inv.product.isCylinderTracked;
                const isOutOfStock = inv.quantity <= 0;

                return (
                  <button
                    key={inv.productId}
                    type="button"
                    disabled={isOutOfStock}
                    onClick={() => { onSelect(inv); onClose(); }}
                    className={`
                      text-left rounded-xl border p-3 space-y-2 transition-all
                      ${isOutOfStock
                        ? 'opacity-40 cursor-not-allowed border-gray-100 bg-gray-50'
                        : 'hover:border-primary hover:shadow-sm hover:bg-primary/5 cursor-pointer border-border bg-card'
                      }
                    `}
                  >
                    {/* Product icon + name */}
                    <div className="flex items-start gap-2">
                      <div className={`p-1.5 rounded-lg shrink-0 ${isLpg ? 'bg-orange-100' : 'bg-blue-100'}`}>
                        {isLpg
                          ? <Flame className="h-4 w-4 text-orange-600" />
                          : <Package className="h-4 w-4 text-blue-600" />
                        }
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm leading-tight line-clamp-2">
                          {inv.product.name}
                        </p>
                        {inv.product.cylinderSize && (
                          <p className="text-xs text-muted-foreground">{inv.product.cylinderSize}</p>
                        )}
                      </div>
                    </div>

                    {/* Stock badge */}
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${stock.class}`}>
                      {stock.label}
                    </span>

                    {/* LPG breakdown if applicable */}
                    {isLpg && inv.fullCylinders != null && (
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p>Full: {inv.fullCylinders}</p>
                        <p>Empty: {inv.quantity - inv.fullCylinders}</p>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Modal ──────────────────────────────────────────────────────────────

export function CreateTransferModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuthStore();
  const [toBranchId, setToBranchId] = useState('');
  const [items, setItems] = useState<TransferItemForm[]>([]);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pickerFor, setPickerFor] = useState<string | null>(null); // uid of item being picked

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data } = await api.get('/branches');
      return (data as Branch[]).filter((b) => b.id !== user?.branchId);
    },
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory', 'branch', user?.branchId],
    queryFn: async () => {
      const { data } = await api.get(`/inventory?branchId=${user?.branchId}`);
      return data as InventoryItem[];
    },
    enabled: !!user?.branchId,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/transfers', data),
    onSuccess: () => {
      toast.success('Transfer created successfully');
      onSuccess();
      onClose();
    },
    onError: (err: any) =>
      toast.error('Failed to create transfer', {
        description: err.response?.data?.message || 'Something went wrong',
      }),
  });

  const addItem = () => {
    const uid = crypto.randomUUID();
    setItems((prev) => [...prev, { uid, productId: '', quantity: 1, variant: 'STANDARD' }]);
    setPickerFor(uid); // open picker immediately
  };

  const removeItem = (uid: string) =>
    setItems((prev) => prev.filter((i) => i.uid !== uid));

  const updateItem = (uid: string, updates: Partial<TransferItemForm>) =>
    setItems((prev) => prev.map((i) => (i.uid === uid ? { ...i, ...updates } : i)));

  const getInventoryItem = (productId: string) =>
    inventory.find((i) => i.productId === productId);

  const getMaxQty = (productId: string, variant: Variant): number => {
    const inv = getInventoryItem(productId);
    if (!inv) return 0;
    if (inv.product.isCylinderTracked) {
      if (variant === 'REFILL') return inv.fullCylinders ?? 0;
      if (variant === 'EMPTY_SHELL')
        return inv.fullCylinders != null ? inv.quantity - inv.fullCylinders : 0;
    }
    return inv.quantity;
  };

  const isLpgProduct = (productId: string) =>
    getInventoryItem(productId)?.product.isCylinderTracked ?? false;

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!toBranchId) errs.toBranch = 'Please select a destination branch';
    if (items.length === 0) errs.items = 'Add at least one item';

    items.forEach((item, idx) => {
      if (!item.productId) { errs[`${idx}_product`] = 'Select a product'; return; }
      if (item.quantity < 1) errs[`${idx}_qty`] = 'Quantity must be at least 1';
      const max = getMaxQty(item.productId, item.variant);
      if (item.quantity > max)
        errs[`${idx}_qty`] = `Only ${max} available`;
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
      items: items.map(({ productId, quantity, variant }) => ({
        productId,
        quantity,
        ...(variant !== 'STANDARD' && { variant }),
      })),
    });
  };

  const activePickerInventory = inventory; // show all; picker handles filtering

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" /> Create New Transfer
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Destination branch */}
            <div className="space-y-2">
              <Label>To Branch</Label>
              <Select value={toBranchId} onValueChange={setToBranchId}>
                <SelectTrigger className={errors.toBranch ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select destination branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches?.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.toBranch && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />{errors.toBranch}
                </p>
              )}
            </div>

            {/* Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Items</Label>
                <Button type="button" size="sm" variant="outline" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" /> Add Item
                </Button>
              </div>

              {errors.items && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />{errors.items}
                </p>
              )}

              {items.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed rounded-lg text-muted-foreground">
                  <Package className="mx-auto h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm">No items yet — click Add Item</p>
                </div>
              )}

              {items.map((item, idx) => {
                const inv = getInventoryItem(item.productId);
                const isLpg = isLpgProduct(item.productId);
                const maxQty = getMaxQty(item.productId, item.variant);

                return (
                  <div key={item.uid} className="border rounded-xl p-4 space-y-3 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Item {idx + 1}
                      </span>
                      <Button
                        type="button" size="icon" variant="ghost"
                        className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => removeItem(item.uid)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Product selector — tap to open grid picker */}
                    <div className="space-y-1">
                      <Label className="text-xs">Product</Label>
                      <button
                        type="button"
                        onClick={() => setPickerFor(item.uid)}
                        className={`
                          w-full flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm
                          hover:border-primary hover:bg-primary/5 transition-colors text-left
                          ${errors[`${idx}_product`] ? 'border-red-500' : 'border-input'}
                        `}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {inv ? (
                            <>
                              {inv.product.isCylinderTracked && (
                                <Flame className="h-4 w-4 text-orange-500 shrink-0" />
                              )}
                              <span className="truncate font-medium">{inv.product.name}</span>
                              {inv.product.isCylinderTracked && (
                                <Badge className="text-xs bg-green-100 text-green-700 shrink-0">
                                  {maxQty} avail.
                                </Badge>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">Select product...</span>
                          )}
                        </div>
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
                      {errors[`${idx}_product`] && (
                        <p className="text-xs text-red-500">{errors[`${idx}_product`]}</p>
                      )}
                    </div>

                    {/* Variant selector — only shown for LPG products */}
                    {isLpg && item.productId && (
                      <div className="space-y-1">
                        <Label className="text-xs">Type</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            { value: 'REFILL',      label: 'Refill (Full)',  avail: inv?.fullCylinders ?? 0 },
                            { value: 'EMPTY_SHELL', label: 'Empty Shell',    avail: inv && inv.fullCylinders != null ? inv.quantity - inv.fullCylinders : 0 },
                          ] as const).map(({ value, label, avail }) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => updateItem(item.uid, { variant: value, quantity: 1 })}
                              className={`
                                flex flex-col items-start rounded-lg border p-3 text-sm transition-all
                                ${item.variant === value
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border hover:border-primary/50'
                                }
                              `}
                            >
                              <span className="font-medium">{label}</span>
                              <span className="text-xs text-muted-foreground mt-0.5">
                                {avail} available
                              </span>
                              {item.variant === value && (
                                <CheckCircle2 className="h-3.5 w-3.5 mt-1 text-primary" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quantity */}
                    {item.productId && (
                      <div className="space-y-1">
                        <Label className="text-xs">
                          Quantity
                          {maxQty > 0 && (
                            <span className="text-muted-foreground ml-1">(max {maxQty})</span>
                          )}
                        </Label>
                        <Input
                          type="number"
                          min={1}
                          max={maxQty || undefined}
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(item.uid, { quantity: parseInt(e.target.value) || 1 })
                          }
                          className={errors[`${idx}_qty`] ? 'border-red-500' : ''}
                        />
                        {errors[`${idx}_qty`] && (
                          <p className="text-xs text-red-500">{errors[`${idx}_qty`]}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Transfer-level notes */}
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Any notes for the receiving branch..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || items.length === 0}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Transfer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product picker overlay */}
      {pickerFor && (
        <ProductPicker
          inventory={activePickerInventory}
          selectedProductIds={items.map((i) => i.productId).filter(Boolean)}
          onSelect={(inv) => {
            const isLpg = inv.product.isCylinderTracked;
            updateItem(pickerFor, {
              productId: inv.productId,
              quantity: 1,
              variant: isLpg ? 'REFILL' : 'STANDARD',
            });
          }}
          onClose={() => setPickerFor(null)}
        />
      )}
    </>
  );
}

export default CreateTransferModal;
