import { useState, useEffect } from 'react'
import { mpesaApi } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/utils'
import { Smartphone, Banknote, CheckCircle2, Loader2, AlertCircle, X, User } from 'lucide-react'
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

// ── Shared inline style tokens (forces light theme inside this modal) ─────────
const s = {
  bg:         { backgroundColor: '#ffffff' },
  text:       { color: '#111827' },
  subtext:    { color: '#374151' },
  inputStyle: { backgroundColor: '#ffffff', color: '#111827', borderColor: '#d1d5db' },
  divider:    { borderColor: '#d1d5db' },
  btnCancel:  { backgroundColor: '#374151', color: '#ffffff', border: 'none' },
  btnWaiting: { backgroundColor: '#d1d5db', color: '#6b7280', border: 'none', cursor: 'not-allowed' },
  btnConfirm: { backgroundColor: '#2563eb', color: '#ffffff', border: 'none' },
} as const

export function PaymentSplitModal({ total, onConfirm, onClose }: Props) {
  const [mpesaAmount, setMpesaAmount] = useState<string>('')
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState('')

  const [mpesaStatus, setMpesaStatus] = useState<MpesaStatus>('idle')
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null)
  const [mpesaRef, setMpesaRef] = useState<string>('')
  const [customerName, setCustomerName] = useState<string | null>(null)
  const [failureReason, setFailureReason] = useState<string>('Payment failed or was cancelled.')
  const [mpesaReceiptInput, setMpesaReceiptInput] = useState('')
  const [pollCount, setPollCount] = useState(0)

  const mpesaAmt  = Number(mpesaAmount) || 0
  const cashAmt   = Math.max(0, total - mpesaAmt)
  const needsMpesa    = mpesaAmt > 0
  const mpesaConfirmed = mpesaStatus === 'confirmed'
  const canConfirm    = !needsMpesa || mpesaConfirmed

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
    setCustomerName(null)
    setFailureReason('Payment failed or was cancelled.')
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
    if (pollCount >= 12) {
      setMpesaStatus('failed')
      setFailureReason('Payment timed out. Enter the M-Pesa receipt code below.')
      toast.error('Payment timed out.')
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await mpesaApi.getStatus(checkoutRequestId)
        const { status, receiptNumber, customerName: name, resultDesc } = res.data

        if (status === 'COMPLETED' && receiptNumber) {
          setMpesaRef(receiptNumber)
          setCustomerName(name || null)
          setMpesaStatus('confirmed')
          toast.success(`M-Pesa confirmed! Receipt: ${receiptNumber}`)
        } else if (status === 'FAILED') {
          // Show Safaricom's own description (e.g. "Request cancelled by user")
          setFailureReason(resultDesc || 'Payment failed or was cancelled.')
          setMpesaStatus('failed')
        } else {
          setPollCount(c => c + 1)
        }
      } catch {
        setPollCount(c => c + 1)
      }
    }, 5000)
    return () => clearTimeout(timer)
  }, [mpesaStatus, checkoutRequestId, pollCount])

  // ── Manual receipt confirmation ───────────────────────────────────────────
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
    if (cashAmt  > 0) payments.push({ method: 'CASH',  amount: cashAmt })
    onConfirm(payments)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm" style={s.bg}>
        <DialogHeader>
          <DialogTitle style={s.text}>Payment</DialogTitle>
        </DialogHeader>

        {/* Total banner */}
        <div className="rounded-xl bg-slate-900 text-white p-4 text-center">
          <p className="text-sm opacity-70 uppercase tracking-wider">Total Due</p>
          <p className="text-3xl font-black">{formatCurrency(total)}</p>
        </div>

        {/* ── M-Pesa amount ── */}
        <div className="space-y-2">
          <label className="text-sm font-semibold flex items-center gap-2" style={s.text}>
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
              setCustomerName(null)
            }}
            style={s.inputStyle}
          />
        </div>

        {/* ── Cash amount (auto-calculated) ── */}
        <div className="space-y-2">
          <label className="text-sm font-semibold flex items-center gap-2" style={s.text}>
            <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center">
              <Banknote className="w-4 h-4 text-white" />
            </div>
            Cash Amount (KES)
          </label>
          <div
            className="h-10 px-3 flex items-center rounded-md border font-bold text-sm"
            style={{ backgroundColor: '#f9fafb', color: '#111827', ...s.divider }}
          >
            {formatCurrency(cashAmt)}
          </div>
        </div>

        {/* ── STK section ── */}
        {needsMpesa && (
          <div className="border rounded-xl overflow-hidden" style={s.divider}>

            {/* Section header */}
            <div className="px-4 py-2 bg-green-50 border-b flex items-center justify-between" style={s.divider}>
              <span className="text-sm font-bold text-green-800">M-Pesa — {formatCurrency(mpesaAmt)}</span>
              {mpesaConfirmed && (
                <span className="flex items-center gap-1 text-xs text-green-700 font-bold">
                  <CheckCircle2 className="w-4 h-4" /> Confirmed
                </span>
              )}
            </div>

            <div className="p-4 space-y-3" style={s.bg}>

              {/* Phone + send — hidden once confirmed */}
              {!mpesaConfirmed && (
                <>
                  <div>
                    <p className="text-xs font-semibold mb-1" style={s.subtext}>Customer's Phone Number</p>
                    <div className="flex gap-2">
                      <Input
                        type="tel"
                        placeholder="0712 345 678"
                        value={phone}
                        onChange={(e) => { setPhone(e.target.value); setPhoneError('') }}
                        disabled={mpesaStatus === 'sending' || mpesaStatus === 'pending'}
                        style={{ ...s.inputStyle, borderColor: phoneError ? '#ef4444' : '#d1d5db' }}
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

                  {/* Pending */}
                  {mpesaStatus === 'pending' && (
                    <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <Loader2 className="w-5 h-5 animate-spin text-amber-600 shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-amber-800">Waiting for payment…</p>
                        <p className="text-xs text-amber-600">Customer should enter their PIN</p>
                      </div>
                    </div>
                  )}

                  {/* Failed — shows the exact reason from Safaricom */}
                  {mpesaStatus === 'failed' && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                      <p className="text-xs text-red-700">{failureReason}</p>
                    </div>
                  )}

                  {/* Manual receipt fallback */}
                  {(mpesaStatus === 'pending' || mpesaStatus === 'failed') && (
                    <div>
                      <p className="text-xs font-semibold mb-1" style={s.subtext}>
                        Or enter M-Pesa receipt code manually:
                      </p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="e.g. RCK1AB23DE"
                          value={mpesaReceiptInput}
                          onChange={(e) => setMpesaReceiptInput(e.target.value.toUpperCase())}
                          style={{
                            ...s.inputStyle,
                            fontFamily: 'monospace',
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                          }}
                        />
                        <button
                          onClick={handleManualConfirm}
                          style={{
                            backgroundColor: '#374151', color: '#ffffff',
                            border: 'none', borderRadius: '6px',
                            padding: '0 16px', fontSize: '14px',
                            fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                          }}
                        >
                          Verify
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Confirmed — show receipt + customer name if Safaricom returned it */}
              {mpesaConfirmed && (
                <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-green-800">Payment received!</p>
                    <p className="text-xs text-green-700 font-mono mt-0.5">{mpesaRef}</p>
                    {customerName && (
                      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-green-200">
                        <User className="w-3.5 h-3.5 text-green-600 shrink-0" />
                        <p className="text-xs font-semibold text-green-800">{customerName}</p>
                      </div>
                    )}
                  </div>
                  <button
                    className="text-green-600 hover:text-green-800 shrink-0"
                    onClick={() => { setMpesaStatus('idle'); setMpesaRef(''); setCustomerName(null) }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Action buttons — fully explicit styles so dark mode can't override ── */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            style={{
              ...s.btnCancel,
              flex: 1, height: '40px', borderRadius: '8px',
              fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            style={{
              flex: 1, height: '40px', borderRadius: '8px',
              fontSize: '14px', fontWeight: 700, cursor: canConfirm ? 'pointer' : 'not-allowed',
              ...(canConfirm ? s.btnConfirm : s.btnWaiting),
            }}
          >
            {needsMpesa && !mpesaConfirmed ? 'Awaiting M-Pesa…' : `Confirm ${formatCurrency(total)}`}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
