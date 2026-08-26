import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '@/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency, formatDate } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, Package, DollarSign } from 'lucide-react'

const Reports = () => {
  const [days, setDays] = useState(30)

  const { data: salesTrend } = useQuery({
    queryKey: ['sales-trend', days],
    queryFn: async () => {
      const response = await reportsApi.getSalesTrend(days)
      return response.data
    },
  })

  const { data: productPerf } = useQuery({
    queryKey: ['product-performance'],
    queryFn: async () => {
      const response = await reportsApi.getProductPerformance()
      return response.data
    },
  })

  const { data: inventoryVal } = useQuery({
    queryKey: ['inventory-valuation'],
    queryFn: async () => {
      const response = await reportsApi.getInventoryValuation()
      return response.data
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground">Business analytics and insights</p>
      </div>

      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales">Sales Trend</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="sales" className="space-y-4">
          <div className="flex gap-2">
            {[7, 14, 30, 90].map(d => (
              <button key={d} onClick={() => setDays(d)} className={`px-3 py-1 rounded-md text-sm ${days === d ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                {d} days
              </button>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Sales Trend (Last {days} Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {salesTrend?.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No sales data available</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={salesTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} />
                    <YAxis tickFormatter={(v) => `KES ${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: any) => formatCurrency(value)} />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="w-5 h-5" />
                Product Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {productPerf?.map((product: any) => (
                  <div key={product.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">{product.type} | {product.code}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatCurrency(product.totalRevenue)}</p>
                      <p className="text-sm text-muted-foreground">{product.totalSold} sold | {product.currentStock} in stock</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Inventory Valuation
              </CardTitle>
            </CardHeader>
            <CardContent>
              {inventoryVal?.summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 bg-muted rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">Total Items</p>
                    <p className="text-xl font-bold">{inventoryVal.summary.totalItems}</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">Total Quantity</p>
                    <p className="text-xl font-bold">{inventoryVal.summary.totalQuantity}</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">Total Value</p>
                    <p className="text-xl font-bold">{formatCurrency(inventoryVal.summary.totalValue)}</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">Potential Profit</p>
                    <p className="text-xl font-bold text-green-600">{formatCurrency(inventoryVal.summary.potentialProfit)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default Reports