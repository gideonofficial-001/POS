import { useState, useEffect } from 'react'
import { mpesaApi } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/utils'
import { Smartphone, Banknote, CheckCircle2, Loader2, AlertCircle, X } from 'lucide-react'
import { toast } from 'sonner'

interface PaymentEntry {
  method: 'MPESA' | 'CASH'
  amount: number
  mpesaRef?: string
}

interface Props {
  total: number
  onConfirm: (payments: PaymentEntry[]) => void
  onClose: () => void
}

type MpesaStatus = 'idle' | 'sending' | 'pending' | 'confirmed' | 'failed'

export function PaymentSplitModal({ total, onConfirm, onClose }: Props) {
  const [mpesaAmount, setMpesaAmount] = useState<string>('')
  const [cashAmount, setCashAmount] = useState<string>(String(total))
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState('')

  const [mpesaStatus, setMpesaStatus] = useState<MpesaStatus>('idle')
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null)
  const [mpesaRef, setMpesaRef] = useState<string>('')
  const [mpesaReceiptInput, setMpesaReceiptInput] = useState('') // manual fallback
  const [pollCount, setPollCount] = useState(0)

  const mpesaAmt = Number(mpesaAmount) || 0
  const cashAmt = Math.max(0, total - mpesaAmt)
  const needsMpesa = mpesaAmt > 0
  const mpesaConfirmed = mpesaStatus === 'confirmed'
  const canConfirm = !needsMpesa || mpesaConfirmed

  // Auto-fill cash as remainder when M-Pesa changes
  useEffect(() => {
    setCashAmount(String(cashAmt))
  }, [mpesaAmount])

  // ── Phone validation ──────────────────────────────────────────────────────
  const formatPhone = (raw: string): string | null => {
    const digits = raw.replace(/\D/g, '')
    if (digits.startsWith('0') && digits.length === 10) return '254' + digits.slice(1)
    if (digits.startsWith('254') && digits.length === 12) return digits
    if (digits.startsWith('7') && digits.length === 9) return '254' + digits
    return null
  }

  // ── STK Push ─────────────────────────────────────────────────────────────
  const handleSendStk = async () => {
    const formatted = formatPhone(phone)
    if (!formatted) {
      setPhoneError('Enter a valid Kenyan number (07xx or 254xx)')
      return
    }
    setPhoneError('')
    setMpesaStatus('sending')
    setPollCount(0)
    try {
      const res = await mpesaApi.stkPush(formatted, mpesaAmt)
      setCheckoutRequestId(res.data.checkoutRequestId)
      setMpesaStatus('pending')
      toast.info(`STK push sent to ${phone}. Waiting for payment...`)
    } catch (err: any) {
      setMpesaStatus('failed')
      toast.error(err.response?.data?.message || 'Failed to send STK push')
    }
  }

  // ── Poll for status ───────────────────────────────────────────────────────
  useEffect(() => {
    if (mpesaStatus !== 'pending' || !checkoutRequestId) return
    if (pollCount >= 12) { // 60 seconds max
      setMpesaStatus('failed')
      toast.error('Payment timed out. Use the receipt code input below.')
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await mpesaApi.getStatus(checkoutRequestId)
        const { status, receiptNumber } = res.data
        if (status === 'COMPLETED' && receiptNumber) {
          setMpesaRef(receiptNumber)
          setMpesaStatus('confirmed')
          toast.success(`M-Pesa confirmed! Receipt: ${receiptNumber}`)
        } else if (status === 'FAILED') {
          setMpesaStatus('failed')
          toast.error('M-Pesa payment failed or was cancelled.')
        } else {
          setPollCount(c => c + 1)
        }
      } catch {
        setPollCount(c => c + 1)
      }
    }, 5000)
    return () => clearTimeout(timer)
  }, [mpesaStatus, checkoutRequestId, pollCount])

  // ── Manual receipt confirmation (fallback) ────────────────────────────────
  const handleManualConfirm = () => {
    if (mpesaReceiptInput.trim().length < 6) {
      toast.error('Enter a valid M-Pesa receipt code')
      return
    }
    setMpesaRef(mpesaReceiptInput.trim().toUpperCase())
    setMpesaStatus('confirmed')
    toast.success('Payment confirmed manually.')
  }

  // ── Final confirm ─────────────────────────────────────────────────────────
  const handleConfirm = () => {
    const payments: PaymentEntry[] = []
    if (mpesaAmt > 0) payments.push({ method: 'MPESA', amount: mpesaAmt, mpesaRef: mpesaRef || undefined })
    if (cashAmt > 0) payments.push({ method: 'CASH', amount: cashAmt })
    onConfirm(payments)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm" style={{ backgroundColor: '#ffffff', color: '#111827' }}>
        <DialogHeader>
          <DialogTitle style={{ color: '#111827' }}>Payment</DialogTitle>
        </DialogHeader>

        {/* Total banner */}
        <div className="rounded-xl bg-slate-900 text-white p-4 text-center">
          <p className="text-sm opacity-70 uppercase tracking-wider">Total Due</p>
          <p className="text-3xl font-black">{formatCurrency(total)}</p>
        </div>

        {/* ── M-Pesa row ── */}
        <div className="space-y-2">
          <label className="text-sm font-semibold flex items-center gap-2" style={{ color: '#111827' }}>
            <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-white" />
            </div>
            M-Pesa Amount (KES)
          </label>
          <Input
            type="number"
            min={0}
            max={total}
            placeholder="0"
            value={mpesaAmount}
            onChange={(e) => {
              const v = Math.min(Number(e.target.value), total)
              setMpesaAmount(String(v || ''))
              setMpesaStatus('idle')
              setCheckoutRequestId(null)
              setMpesaRef('')
            }}
            style={{ backgroundColor: '#ffffff', color: '#111827', borderColor: '#d1d5db' }}
          />
        </div>

        {/* ── Cash row (auto) ── */}
        <div className="space-y-2">
          <label className="text-sm font-semibold flex items-center gap-2" style={{ color: '#111827' }}>
            <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center">
              <Banknote className="w-4 h-4 text-white" />
            </div>
            Cash Amount (KES)
          </label>
          <div
            className="h-10 px-3 flex items-center rounded-md border font-bold text-sm"
            style={{ backgroundColor: '#f9fafb', color: '#111827', borderColor: '#d1d5db' }}
          >
            {formatCurrency(cashAmt)}
          </div>
        </div>

        {/* ── STK section — only when M-Pesa > 0 ── */}
        {needsMpesa && (
          <div className="border rounded-xl overflow-hidden" style={{ borderColor: '#d1d5db' }}>
            <div className="px-4 py-2 bg-green-50 border-b flex items-center justify-between" style={{ borderColor: '#d1d5db' }}>
              <span className="text-sm font-bold text-green-800">M-Pesa — {formatCurrency(mpesaAmt)}</span>
              {mpesaStatus === 'confirmed' && (
                <span className="flex items-center gap-1 text-xs text-green-700 font-bold">
                  <CheckCircle2 className="w-4 h-4" /> Confirmed
                </span>
              )}
            </div>

            <div className="p-4 space-y-3" style={{ backgroundColor: '#ffffff' }}>

              {/* Phone + send */}
              {mpesaStatus !== 'confirmed' && (
                <>
                  <div>
                    <p className="text-xs font-semibold mb-1" style={{ color: '#374151' }}>Customer's Phone Number</p>
                    <div className="flex gap-2">
                      <Input
                        type="tel"
                        placeholder="0712 345 678"
                        value={phone}
                        onChange={(e) => { setPhone(e.target.value); setPhoneError('') }}
                        disabled={mpesaStatus === 'sending' || mpesaStatus === 'pending'}
                        style={{ backgroundColor: '#ffffff', color: '#111827', borderColor: phoneError ? '#ef4444' : '#d1d5db' }}
                      />
                      <Button
                        className="bg-green-600 hover:bg-green-700 text-white shrink-0"
                        onClick={handleSendStk}
                        disabled={!phone || mpesaStatus === 'sending' || mpesaStatus === 'pending'}
                      >
                        {mpesaStatus === 'sending' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}
                      </Button>
                    </div>
                    {phoneError && <p className="text-xs text-red-500 mt-1">{phoneError}</p>}
                  </div>

                  {/* Pending state */}
                  {mpesaStatus === 'pending' && (
                    <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <Loader2 className="w-5 h-5 animate-spin text-amber-600 shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-amber-800">Waiting for payment…</p>
                        <p className="text-xs text-amber-600">Customer should enter their PIN on their phone</p>
                      </div>
                    </div>
                  )}

                  {/* Failed state */}
                  {mpesaStatus === 'failed' && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                      <p className="text-xs text-red-700">Payment failed or timed out.</p>
                    </div>
                  )}

                  {/* Manual receipt fallback */}
                  {(mpesaStatus === 'pending' || mpesaStatus === 'failed') && (
                    <div>
                      <p className="text-xs font-semibold mb-1" style={{ color: '#374151' }}>
                        Or enter M-Pesa receipt code manually:
                      </p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="e.g. RCK1AB23DE"
                          value={mpesaReceiptInput}
                          onChange={(e) => setMpesaReceiptInput(e.target.value.toUpperCase())}
                          style={{
                            backgroundColor: '#ffffff', color: '#111827',
                            borderColor: '#d1d5db', fontFamily: 'monospace',
                            letterSpacing: '0.1em', textTransform: 'uppercase',
                          }}
                        />
                        <Button variant="outline" onClick={handleManualConfirm}>Verify</Button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Confirmed state */}
              {mpesaStatus === 'confirmed' && (
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-green-800">Payment received!</p>
                    <p className="text-xs text-green-700 font-mono">{mpesaRef}</p>
                  </div>
                  <button className="ml-auto text-green-600 hover:text-green-800" onClick={() => { setMpesaStatus('idle'); setMpesaRef(''); }}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            className="flex-1 font-bold"
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            {needsMpesa && !mpesaConfirmed ? 'Awaiting M-Pesa…' : `Confirm ${formatCurrency(total)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
