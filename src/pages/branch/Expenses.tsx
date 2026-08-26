import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { expensesApi } from '@/api'
import { useAuthStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from 'sonner'
import { Receipt, Plus } from 'lucide-react'

const expenseCategories = [
  { value: 'FUEL', label: 'Fuel' },
  { value: 'UTILITIES', label: 'Utilities' },
  { value: 'REPAIRS', label: 'Repairs' },
  { value: 'MISCELLANEOUS', label: 'Miscellaneous' },
  { value: 'OTHER', label: 'Other' },
]

const Expenses = () => {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [newExpense, setNewExpense] = useState({ amount: '', category: '', description: '', receiptUrl: '' })

  const { data: expenses } = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const response = await expensesApi.getAll({ branchId: user?.branchId })
      return response.data
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => expensesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      setShowCreate(false)
      setNewExpense({ amount: '', category: '', description: '', receiptUrl: '' })
      toast.success('Expense submitted for approval')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to submit expense')
    },
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED': return <Badge variant="success">Approved</Badge>
      case 'PENDING': return <Badge variant="warning">Pending</Badge>
      case 'REJECTED': return <Badge variant="destructive">Rejected</Badge>
      default: return <Badge>{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-muted-foreground">Submit and track expenses</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Submit Expense
        </Button>
      </div>

      <div className="space-y-3">
        {expenses?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Receipt className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No expenses yet</p>
          </div>
        ) : (
          expenses?.map((expense: any) => (
            <Card key={expense.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold">{expense.expenseCode}</h3>
                      {getStatusBadge(expense.status)}
                    </div>
                    <Badge variant="outline" className="mb-2">{expense.category}</Badge>
                    <p className="text-sm mt-1">{expense.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(expense.createdAt)}</p>
                  </div>
                  <p className="text-xl font-bold">{formatCurrency(expense.amount)}</p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Submit Expense</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate({...newExpense, amount: Number(newExpense.amount), branchId: user?.branchId}) }} className="space-y-4">
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select value={newExpense.category} onValueChange={v => setNewExpense({...newExpense, category: v})}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {expenseCategories.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Amount *</Label><Input type="number" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} required /></div>
            <div className="space-y-2"><Label>Description *</Label><Input placeholder="Brief explanation of the expense" value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} required /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>Submit</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Expenses