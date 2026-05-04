import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { productsApi, salesApi, inventoryApi } from '@/api';
import { useAuthStore, useCartStore } from '@/store';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  ShoppingCart, 
  Minus, 
  Plus, 
  Trash2, 
  User, 
  Phone,
  Search,
  Package,
  Flame
} from 'lucide-react';
import { formatCurrency } from '@/utils';
import { toast } from 'sonner';
import { ProductType, SaleType } from '@/types';

const NewSale = () => {
  const { user } = useAuthStore();
  const { items, addItem, removeItem, updateQuantity, clearCart, getTotal, customerName, customerPhone, setCustomerInfo } = useCartStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [showCheckout, setShowCheckout] = useState(false);
  const [saleType, setSaleType] = useState<SaleType>(SaleType.CASH);

  const branchId = user?.branchId;

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const response = await productsApi.getAll();
      return response.data;
    },
  });

  const { data: inventory } = useQuery({
    queryKey: ['inventory', branchId],
    queryFn: async () => {
      if (!branchId) return null;
      const response = await inventoryApi.getByBranch(branchId);
      return response.data;
    },
    enabled: !!branchId,
  });

  const createSaleMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await salesApi.create(data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`Sale completed! Code: ${data.saleCode}`);
      clearCart();
      setShowCheckout(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create sale');
    },
  });

  // Filter products by category and search
  const filteredProducts = products?.filter((product: any) => {
    const matchesCategory = activeCategory === 'all' || product.type === activeCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Get stock for a product
  const getProductStock = (productId: string) => {
    const item = inventory?.find((inv: any) => inv.productId === productId);
    return item?.quantity || 0;
  };

  const handleAddToCart = (product: any) => {
    const stock = getProductStock(product.id);
    const cartItem = items.find(item => item.productId === product.id);
    const currentQty = cartItem?.quantity || 0;

    if (currentQty >= stock) {
      toast.error('Insufficient stock');
      return;
    }

    addItem(product, 1);
    toast.success(`${product.name} added to cart`);
  };

  const handleCheckout = () => {
    if (items.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    setShowCheckout(true);
  };

  const handleCompleteSale = () => {
    if (!branchId) {
      toast.error('No branch assigned');
      return;
    }

    const saleData = {
      branchId,
      type: saleType,
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      items: items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    };

    createSaleMutation.mutate(saleData);
  };

  const categories = [
    { id: 'all', label: 'All Products', icon: Package },
    { id: ProductType.LPG_REFILL, label: 'LPG Refills', icon: Flame },
    { id: ProductType.LPG_CYLINDER, label: 'Cylinders', icon: Package },
    { id: ProductType.ELECTRONICS, label: 'Electronics', icon: Package },
  ];

  return (
    <div className="h-[calc(100vh-6rem)] flex gap-6">
      {/* Products Section */}
      <div className="flex-1 flex flex-col">
        {/* Search and Categories */}
        <Card className="mb-4">
          <CardContent className="pt-6">
            <div className="flex gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Tabs value={activeCategory} onValueChange={setActiveCategory}>
              <TabsList className="grid grid-cols-4">
                {categories.map((cat) => (
                  <TabsTrigger key={cat.id} value={cat.id} className="flex items-center gap-2">
                    <cat.icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{cat.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {/* Products Grid */}
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts?.map((product: any) => {
              const stock = getProductStock(product.id);
              const isLowStock = stock <= product.minStockLevel;

              return (
                <Card 
                  key={product.id} 
                  className={`cursor-pointer transition-shadow hover:shadow-lg ${stock === 0 ? 'opacity-50' : ''}`}
                  onClick={() => stock > 0 && handleAddToCart(product)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <Badge variant={product.type === ProductType.LPG_REFILL ? 'default' : 'secondary'}>
                        {product.type === ProductType.LPG_REFILL ? 'Refill' : 
                         product.type === ProductType.LPG_CYLINDER ? 'Cylinder' : 'Product'}
                      </Badge>
                      <Badge variant={isLowStock ? 'destructive' : 'outline'}>
                        Stock: {stock}
                      </Badge>
                    </div>
                    <h3 className="font-medium text-sm mb-1">{product.name}</h3>
                    <p className="text-lg font-bold text-blue-600">
                      {formatCurrency(product.price)}
                    </p>
                    {product.cylinderSize && (
                      <p className="text-xs text-gray-500">{product.cylinderSize}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Cart Section */}
      <Card className="w-96 flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Cart ({items.length})
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 overflow-auto">
          {items.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>Cart is empty</p>
              <p className="text-sm">Click products to add</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.productId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.product.name}</p>
                    <p className="text-sm text-gray-500">
                      {formatCurrency(item.unitPrice)} x {item.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQuantity(item.productId, Math.max(0, item.quantity - 1))}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        const stock = getProductStock(item.productId);
                        if (item.quantity < stock) {
                          updateQuantity(item.productId, item.quantity + 1);
                        } else {
                          toast.error('Insufficient stock');
                        }
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500"
                      onClick={() => removeItem(item.productId)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex-col border-t pt-4">
          <div className="w-full space-y-3 mb-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-gray-400" />
              <Input
                placeholder="Customer name (optional)"
                value={customerName}
                onChange={(e) => setCustomerInfo(e.target.value, customerPhone)}
                className="flex-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-400" />
              <Input
                placeholder="Customer phone (optional)"
                value={customerPhone}
                onChange={(e) => setCustomerInfo(customerName, e.target.value)}
                className="flex-1"
              />
            </div>
          </div>

          <div className="w-full flex items-center justify-between mb-4">
            <span className="text-gray-600">Total</span>
            <span className="text-2xl font-bold">{formatCurrency(getTotal())}</span>
          </div>

          <Button 
            className="w-full" 
            size="lg"
            disabled={items.length === 0}
            onClick={handleCheckout}
          >
            Checkout
          </Button>
        </CardFooter>
      </Card>

      {/* Checkout Dialog */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Sale</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Sale Type</Label>
              <div className="flex gap-4 mt-2">
                <Button
                  variant={saleType === SaleType.CASH ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setSaleType(SaleType.CASH)}
                >
                  Cash
                </Button>
                <Button
                  variant={saleType === SaleType.INVOICE ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setSaleType(SaleType.INVOICE)}
                >
                  Invoice
                </Button>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Order Summary</h4>
              <div className="space-y-1">
                {items.map((item) => (
                  <div key={item.productId} className="flex justify-between text-sm">
                    <span>{item.product.name} x {item.quantity}</span>
                    <span>{formatCurrency(item.total)}</span>
                  </div>
                ))}
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>{formatCurrency(getTotal())}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCheckout(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCompleteSale}
              disabled={createSaleMutation.isPending}
            >
              {createSaleMutation.isPending ? 'Processing...' : 'Complete Sale'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NewSale;
