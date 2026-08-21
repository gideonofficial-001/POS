import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/api';
import { useAuthStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
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
  uid: string;
  productId: string;
  quantity: number;
  variant: Variant;
}

// ── Product Picker Portal ─────────────────────────────────────────────────────
// Rendered via createPortal to document.body so Radix's pointer-events:none
// on the body (set by Dialog) cannot block it.

function ProductPicker({
  inventory,
  onSelect,
  onClose,
}: {
  inventory: InventoryItem[];
  onSelect: (inv: InventoryItem) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');

  // Prevent background scroll while picker is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return inventory.filter((inv) =>
      inv.product.name.toLowerCase().includes(q) ||
      (inv.product.brand?.toLowerCase() ?? '').includes(q) ||
      (inv.product.cylinderSize?.toLowerCase() ?? '').includes(q),
    );
  }, [inventory, search]);

  const getStockInfo = (inv: InventoryItem) => {
    const available = inv.product.isCylinderTracked && inv.fullCylinders != null
      ? inv.fullCylinders
      : inv.quantity;
    if (available <= 0)
      return { label: 'Out of stock', cls: 'bg-red-100 text-red-700' };
    if (available <= 5)
      return { label: `${available} left`, cls: 'bg-amber-100 text-amber-700' };
    return { label: `${available} in stock`, cls: 'bg-green-100 text-green-700' };
  };

  const picker = (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 99999,
               display: 'flex', alignItems: 'flex-end',
               justifyContent: 'center', padding: '1rem',
               backgroundColor: 'rgba(0,0,0,0.55)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{ background: 'white', borderRadius: '1rem', width: '100%',
                 maxWidth: '32rem', display: 'flex', flexDirection: 'column',
                 maxHeight: '85vh', boxShadow: '0 25px 50px rgba(0,0,0,0.3)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '1rem', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <h3 style={{ fontWeight: 600, fontSize: '1rem', margin: 0 }}>Select Product</h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
                     padding: '0.25rem', borderRadius: '0.5rem', display: 'flex' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem',
                                        top: '50%', transform: 'translateY(-50%)',
                                        color: '#9ca3af', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search by name, brand, size..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              style={{
                width: '100%', paddingLeft: '2.25rem', paddingRight: '0.75rem',
                paddingTop: '0.5rem', paddingBottom: '0.5rem',
                border: '1px solid #d1d5db', borderRadius: '0.5rem',
                fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Scrollable grid */}
        <div style={{ overflowY: 'auto', padding: '0.75rem', flex: 1,
                      WebkitOverflowScrolling: 'touch' }}>
          {filtered.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.875rem',
                        padding: '2rem 0' }}>
              No products match "{search}"
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {filtered.map((inv) => {
                const stock = getStockInfo(inv);
                const isLpg = inv.product.isCylinderTracked;
                const isOutOfStock = inv.quantity <= 0;

                return (
                  <button
                    key={inv.productId}
                    type="button"
                    disabled={isOutOfStock}
                    onClick={() => { onSelect(inv); onClose(); }}
                    style={{
                      textAlign: 'left', borderRadius: '0.75rem',
                      border: '1.5px solid #e5e7eb', padding: '0.75rem',
                      background: isOutOfStock ? '#f9fafb' : 'white',
                      opacity: isOutOfStock ? 0.5 : 1,
                      cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                      display: 'flex', flexDirection: 'column', gap: '0.5rem',
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isOutOfStock)
                        (e.currentTarget as HTMLButtonElement).style.borderColor = '#6366f1';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <div style={{
                        padding: '0.375rem', borderRadius: '0.5rem', flexShrink: 0,
                        background: isLpg ? '#fff7ed' : '#eff6ff',
                      }}>
                        {isLpg
                          ? <Flame size={16} style={{ color: '#ea580c' }} />
                          : <Package size={16} style={{ color: '#2563eb' }} />}
                      </div>
                      <p style={{ fontWeight: 500, fontSize: '0.8125rem',
                                  lineHeight: 1.3, margin: 0, wordBreak: 'break-word' }}>
                        {inv.product.name}
                      </p>
                    </div>

                    <span style={{
                      display: 'inline-block', fontSize: '0.6875rem', fontWeight: 600,
                      padding: '0.125rem 0.5rem', borderRadius: '9999px',
                    }}
                      className={stock.cls}
                    >
                      {stock.label}
                    </span>

                    {isLpg && inv.fullCylinders != null && (
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.4 }}>
                        <p style={{ margin: 0 }}>Full: {inv.fullCylinders}</p>
                        <p style={{ margin: 0 }}>Empty: {inv.quantity - inv.fullCylinders}</p>
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

  return createPortal(picker, document.body);
}

// ── Main Modal ────────────────────────────────────────────────────────────────
// Uses a plain div overlay (NOT shadcn Dialog) so Radix never touches pointer-events.

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
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

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
    setPickerFor(uid);
  };

  const removeItem = (uid: string) => setItems((prev) => prev.filter((i) => i.uid !== uid));

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

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!toBranchId) errs.toBranch = 'Please select a destination branch';
    if (items.length === 0) errs.items = 'Add at least one item';
    items.forEach((item, idx) => {
      if (!item.productId) { errs[`${idx}_product`] = 'Select a product'; return; }
      if (item.quantity < 1) errs[`${idx}_qty`] = 'Quantity must be at least 1';
      const max = getMaxQty(item.productId, item.variant);
      if (item.quantity > max) errs[`${idx}_qty`] = `Only ${max} available`;
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

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'white', borderRadius: '1rem 1rem 0 0',
          width: '100%', maxWidth: '42rem',
          maxHeight: '92vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '1rem 1.25rem', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Package size={20} />
            <h2 style={{ fontWeight: 700, fontSize: '1.125rem', margin: 0 }}>Create New Transfer</h2>
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem',
                     borderRadius: '0.5rem', display: 'flex', color: '#6b7280' }}>
            <X size={22} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div style={{ overflowY: 'auto', padding: '1.25rem',
                      flex: 1, WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* To Branch */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
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
                <p style={{ color: '#ef4444', fontSize: '0.75rem', display: 'flex',
                            alignItems: 'center', gap: '0.25rem', margin: 0 }}>
                  <AlertCircle size={12} />{errors.toBranch}
                </p>
              )}
            </div>

            {/* Items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Label>Items</Label>
                <Button type="button" size="sm" variant="outline" onClick={addItem}>
                  <Plus size={14} style={{ marginRight: '0.25rem' }} /> Add Item
                </Button>
              </div>

              {errors.items && (
                <p style={{ color: '#ef4444', fontSize: '0.75rem', display: 'flex',
                            alignItems: 'center', gap: '0.25rem', margin: 0 }}>
                  <AlertCircle size={12} />{errors.items}
                </p>
              )}

              {items.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem',
                              border: '2px dashed #d1d5db', borderRadius: '0.75rem',
                              color: '#6b7280' }}>
                  <Package size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.4 }} />
                  <p style={{ margin: 0, fontSize: '0.875rem' }}>No items yet — click Add Item</p>
                </div>
              )}

              {items.map((item, idx) => {
                const inv = getInventoryItem(item.productId);
                const isLpg = inv?.product.isCylinderTracked ?? false;
                const maxQty = getMaxQty(item.productId, item.variant);

                return (
                  <div key={item.uid}
                    style={{ border: '1.5px solid #e5e7eb', borderRadius: '0.75rem',
                             padding: '1rem', display: 'flex', flexDirection: 'column',
                             gap: '0.75rem', background: '#f9fafb' }}>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600,
                                     color: '#6b7280', textTransform: 'uppercase',
                                     letterSpacing: '0.05em' }}>
                        Item {idx + 1}
                      </span>
                      <button onClick={() => removeItem(item.uid)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer',
                                 color: '#ef4444', padding: '0.25rem', borderRadius: '0.375rem',
                                 display: 'flex' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* Product selector button */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <Label style={{ fontSize: '0.75rem' }}>Product</Label>
                      <button
                        type="button"
                        onClick={() => setPickerFor(item.uid)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '0.625rem 0.75rem', borderRadius: '0.5rem',
                          border: `1.5px solid ${errors[`${idx}_product`] ? '#ef4444' : '#d1d5db'}`,
                          background: 'white', cursor: 'pointer', fontSize: '0.875rem',
                          textAlign: 'left', width: '100%',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                          {inv ? (
                            <>
                              {inv.product.isCylinderTracked &&
                                <Flame size={15} style={{ color: '#ea580c', flexShrink: 0 }} />}
                              <span style={{ fontWeight: 500, overflow: 'hidden',
                                             textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {inv.product.name}
                              </span>
                              {maxQty > 0 && (
                                <span style={{ fontSize: '0.7rem', background: '#dcfce7',
                                               color: '#15803d', padding: '0.125rem 0.375rem',
                                               borderRadius: '9999px', flexShrink: 0, fontWeight: 600 }}>
                                  {maxQty} avail.
                                </span>
                              )}
                            </>
                          ) : (
                            <span style={{ color: '#9ca3af' }}>Select product...</span>
                          )}
                        </div>
                        <ChevronDown size={16} style={{ color: '#9ca3af', flexShrink: 0 }} />
                      </button>
                      {errors[`${idx}_product`] && (
                        <p style={{ color: '#ef4444', fontSize: '0.75rem', margin: 0 }}>
                          {errors[`${idx}_product`]}
                        </p>
                      )}
                    </div>

                    {/* Variant selector — LPG only */}
                    {isLpg && item.productId && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <Label style={{ fontSize: '0.75rem' }}>Type</Label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                          {([
                            { value: 'REFILL' as Variant, label: 'Refill (Full)',
                              avail: inv?.fullCylinders ?? 0 },
                            { value: 'EMPTY_SHELL' as Variant, label: 'Empty Shell',
                              avail: inv && inv.fullCylinders != null
                                ? inv.quantity - inv.fullCylinders : 0 },
                          ]).map(({ value, label, avail }) => (
                            <button key={value} type="button"
                              onClick={() => updateItem(item.uid, { variant: value, quantity: 1 })}
                              style={{
                                padding: '0.625rem 0.75rem', borderRadius: '0.625rem',
                                border: `2px solid ${item.variant === value ? '#6366f1' : '#e5e7eb'}`,
                                background: item.variant === value ? '#eef2ff' : 'white',
                                cursor: 'pointer', textAlign: 'left',
                                display: 'flex', flexDirection: 'column', gap: '0.125rem',
                              }}>
                              <span style={{ fontWeight: 600, fontSize: '0.8125rem',
                                             color: item.variant === value ? '#4f46e5' : '#374151' }}>
                                {label}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                {avail} available
                              </span>
                              {item.variant === value && (
                                <CheckCircle2 size={13} style={{ color: '#4f46e5', marginTop: '0.125rem' }} />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quantity */}
                    {item.productId && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <Label style={{ fontSize: '0.75rem' }}>
                          Quantity {maxQty > 0 && <span style={{ color: '#9ca3af' }}>(max {maxQty})</span>}
                        </Label>
                        <Input
                          type="number" min={1} max={maxQty || undefined}
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(item.uid, { quantity: parseInt(e.target.value) || 1 })}
                          className={errors[`${idx}_qty`] ? 'border-red-500' : ''}
                        />
                        {errors[`${idx}_qty`] && (
                          <p style={{ color: '#ef4444', fontSize: '0.75rem', margin: 0 }}>
                            {errors[`${idx}_qty`]}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Notes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Any notes for the receiving branch..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ minHeight: '5rem' }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #e5e7eb',
                      display: 'flex', gap: '0.75rem', justifyContent: 'flex-end',
                      flexShrink: 0 }}>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending || items.length === 0}
          >
            {createMutation.isPending ? 'Creating...' : 'Create Transfer'}
          </Button>
        </div>
      </div>

      {/* Product picker — separate portal layer on top */}
      {pickerFor && (
        <ProductPicker
          inventory={inventory}
          onSelect={(inv) => {
            const isLpg = inv.product.isCylinderTracked;
            updateItem(pickerFor, {
              productId: inv.productId,
              quantity: 1,
              variant: isLpg ? 'REFILL' : 'STANDARD',
            });
            setPickerFor(null);
          }}
          onClose={() => setPickerFor(null)}
        />
      )}
    </div>,
    document.body,
  );
}

export default CreateTransferModal;
