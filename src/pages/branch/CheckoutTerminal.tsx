import { useState, useEffect, useRef } from 'react'
import { mpesaApi, salesApi } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/utils'
import { Smartphone, Banknote, CheckCircle2, Loader2, AlertCircle, X, Hash } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  saleId: string
  total: number
  onSuccess: (method: string, ref?: string) => void
  onCancel: () => void
}

type Mode = 'SELECT' | 'STK' | 'MANUAL' | 'PROCESSING' | 'SUCCESS' | 'FAILED'

export function CheckoutTerminal({ saleId, total, onSuccess, onCancel }: Props) {
  const [mode, setMode] = useState<Mode>('SELECT')
  
  // STK State
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null)
  
  // Manual State
  const [receiptCode, setReceiptCode] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const pollCount = useRef(0)
  const pollTimer = useRef<NodeJS.Timeout | null>(null)

  const cleanupPolling = () => {
    if (pollTimer.current) clearTimeout(pollTimer.current)
  }

  useEffect(() => {
    return cleanupPolling
  }, [])

  // ── CASH PAYMENT ──
  const handleCashPayment = async () => {
    setMode('PROCESSING')
    try {
      await salesApi.complete(saleId, 'CASH')
      setMode('SUCCESS')
      setTimeout(() => onSuccess('CASH'), 1500)
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to complete cash payment')
      setMode('FAILED')
    }
  }

  // ── STK PUSH FLOW ──
  const handleSendStk = async () => {
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 9) {
      setPhoneError('Enter a valid phone number')
      return
    }
    setPhoneError('')
    setMode('PROCESSING')
    
    try {
      // Amount is securely calculated on the backend using the saleId
      const res = await mpesaApi.stkPush(phone, saleId)
      setCheckoutRequestId(res.data.checkoutRequestId)
      setMode('STK')
      pollCount.current = 0
      startPolling(res.data.checkoutRequestId)
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to initiate STK push')
      setMode('FAILED')
    }
  }

  const startPolling = (cid: string) => {
    cleanupPolling()
    
    const checkStatus = async () => {
      pollCount.current += 1
      if (pollCount.current > 15) { // Stop after 15 attempts (roughly 75 seconds)
        setErrorMessage('Payment request timed out. Please verify manually.')
        setMode('FAILED')
        return
      }

      try {
        const res = await mpesaApi.getStatus(cid)
        if (res.data.status === 'COMPLETED') {
          setMode('SUCCESS')
          setTimeout(() => onSuccess('MPESA', res.data.receiptNumber), 2000)
          return
        } else if (res.data.status === 'FAILED') {
          setErrorMessage(res.data.resultDesc || 'Payment was cancelled or failed')
          setMode('FAILED')
          return
        }
      } catch (e) {
        // Ignore network blips
      }

      pollTimer.current = setTimeout(checkStatus, 5000)
    }

    pollTimer.current = setTimeout(checkStatus, 5000)
  }

  // ── MANUAL RECEIPT FLOW ──
  const handleManualConfirm = async () => {
    const cleanReceipt = receiptCode.trim().toUpperCase()
    if (cleanReceipt.length !== 10) {
      toast.error('M-Pesa receipt must be exactly 10 characters')
      return
    }

    setMode('PROCESSING')
    try {
      // 🚀 ARCHITECTURE FIX: Manual receipts are sent to the backend as UNVERIFIED. 
      // They do NOT automatically become completed.
      await salesApi.recordManualReceipt(saleId, cleanReceipt)
      setMode('SUCCESS')
      toast.info('Payment recorded as Unverified for manager review.')
      setTimeout(() => onSuccess('MPESA_MANUAL', cleanReceipt), 2000)
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to record manual receipt')
      setMode('FAILED')
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden bg-white">
        <DialogHeader className="p-4 border-b bg-slate-50">
          <DialogTitle className="text-center">Checkout Terminal</DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-6">
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Total Due</p>
            <p className="text-4xl font-black text-slate-900">{formatCurrency(total)}</p>
          </div>

          {mode === 'SELECT' && (
            <div className="space-y-3">
              <Button className="w-full h-14 text-lg justify-start px-4 bg-emerald-600 hover:bg-emerald-700" onClick={() => setMode('STK')}>
                <Smartphone className="w-5 h-5 mr-3" /> Send STK Push
              </Button>
              <Button variant="outline" className="w-full h-14 text-lg justify-start px-4" onClick={() => setMode('MANUAL')}>
                <Hash className="w-5 h-5 mr-3" /> Enter Receipt Manually
              </Button>
              <Button variant="secondary" className="w-full h-14 text-lg justify-start px-4 bg-slate-100" onClick={handleCashPayment}>
                <Banknote className="w-5 h-5 mr-3" /> Pay via Cash
              </Button>
            </div>
          )}

          {(mode === 'STK' && !checkoutRequestId) && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-center">Enter Customer Phone Number</p>
              <Input 
                type="tel" placeholder="0712 345 678" value={phone} 
                onChange={(e) => { setPhone(e.target.value); setPhoneError('') }}
                className={`h-12 text-center text-lg font-bold tracking-widest ${phoneError ? 'border-red-500' : ''}`}
                autoFocus
              />
              <Button className="w-full h-12 bg-emerald-600 hover:bg-emerald-700" onClick={handleSendStk} disabled={phone.length < 9}>
                Send Prompt
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setMode('SELECT')}>Back</Button>
            </div>
          )}

          {(mode === 'STK' && checkoutRequestId) && (
            <div className="flex flex-col items-center py-6 text-center space-y-4">
              <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
              <div>
                <p className="font-bold text-lg">Waiting for PIN...</p>
                <p className="text-sm text-muted-foreground mt-1">Prompt sent to {phone}</p>
              </div>
            </div>
          )}

          {mode === 'MANUAL' && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-center">Enter M-Pesa Receipt Code</p>
              <Input 
                placeholder="e.g. RCK1AB23DE" value={receiptCode} 
                onChange={(e) => setReceiptCode(e.target.value.toUpperCase())}
                className="h-12 text-center text-lg font-mono font-bold tracking-[0.2em] uppercase"
                maxLength={10} autoFocus
              />
              <Button className="w-full h-12 bg-slate-900" onClick={handleManualConfirm} disabled={receiptCode.length !== 10}>
                Record Payment
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setMode('SELECT')}>Back</Button>
            </div>
          )}

          {mode === 'PROCESSING' && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="w-10 h-10 text-slate-900 animate-spin mb-4" />
              <p className="font-bold">Processing Transaction...</p>
            </div>
          )}

          {mode === 'SUCCESS' && (
            <div className="flex flex-col items-center py-8 text-emerald-600">
              <CheckCircle2 className="w-16 h-16 mb-4" />
              <p className="font-black text-xl">Payment Complete!</p>
            </div>
          )}

          {mode === 'FAILED' && (
            <div className="flex flex-col items-center py-6 text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
              <p className="font-bold text-lg text-red-600">Transaction Failed</p>
              <p className="text-sm text-muted-foreground mt-2 mb-6">{errorMessage}</p>
              <Button variant="outline" className="w-full" onClick={() => setMode('SELECT')}>Try Another Method</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
