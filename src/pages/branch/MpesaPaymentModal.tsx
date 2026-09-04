import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { mpesaApi } from '@/api'
import { Smartphone, CheckCircle2, XCircle, Loader2, X, AlertCircle, Hash, ArrowLeft } from 'lucide-react'

type Mode   = 'select' | 'stk' | 'code'
type Step   = 'input' | 'waiting' | 'success' | 'failed'

interface MpesaResult {
  receiptNumber: string
  phoneNumber: string
  amount: number
  customerName?: string | null
}

interface Props {
  amount: number
  saleId?: string
  invoiceId?: string
  onSuccess: (result: MpesaResult) => void
  onClose: () => void
}

const GREEN  = '#00a651'
const DKGREEN= '#007a3d'

function fmt(n: number) {
  return `KES ${Number(n).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`
}

function formatPhone(raw: string): string {
  let p = raw.replace(/\D/g, '')
  if (p.startsWith('0') && p.length === 10) p = '254' + p.slice(1)
  else if (p.startsWith('7') || p.startsWith('1')) p = '254' + p
  return p
}

function validatePhone(value: string): boolean {
  return /^2547\d{8}$|^2541\d{8}$/.test(formatPhone(value))
}

export function MpesaPaymentModal({ amount, saleId, invoiceId, onSuccess, onClose }: Props) {
  const [mode, setMode]   = useState<Mode>('select')
  const [step, setStep]   = useState<Step>('input')
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [code, setCode]   = useState('')
  const [codeError, setCodeError] = useState('')
  const [result, setResult]         = useState<MpesaResult | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [elapsed, setElapsed]       = useState(0)
  
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
      stopPolling()
    }
  }, [])

  const stopPolling = () => {
    if (pollRef.current)  clearInterval(pollRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  // ── STK push ──────────────────────────────────────────────────────────────

  const handleStkSend = async () => {
    if (!validatePhone(phone)) { setPhoneError('Enter a valid Kenyan number e.g. 0712 345 678'); return }
    setPhoneError('')
    setSubmitting(true)
    try {
      const res = await mpesaApi.stkPush(formatPhone(phone), amount, saleId, invoiceId)
      setStep('waiting')
      startPolling(res.data.checkoutRequestId)
    } catch (err: any) {
      setPhoneError(err.response?.data?.message || 'Failed to send STK push — try again')
    } finally {
      setSubmitting(false)
    }
  }

  const startPolling = (cid: string) => {
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    let attempts = 0
    
    pollRef.current = setInterval(async () => {
      attempts++
      try {
        const res = await mpesaApi.getStatus(cid)
        const tx  = res.data
        if (tx.status === 'COMPLETED') {
          stopPolling()
          const r: MpesaResult = {
            receiptNumber: tx.receiptNumber || '',
            phoneNumber: tx.phoneNumber || phone,
            amount: tx.amount,
            customerName: tx.customerName ?? null,
          }
          setResult(r)
          setStep('success')
          onSuccess(r)
        } else if (tx.status === 'FAILED') {
          stopPolling()
          setErrorMessage(tx.resultDesc || 'Payment was declined or cancelled')
          setStep('failed')
        } else if (attempts >= 40) { // 2 minutes max
          stopPolling()
          setErrorMessage('Payment timed out. Check your M-Pesa messages and try again.')
          setStep('failed')
        }
      } catch { /* keep polling on network blip */ }
    }, 3000)
  }

  const handleRetry = () => {
    stopPolling()
    setStep('input')
    setErrorMessage('')
    setElapsed(0)
  }

  // ── Manual Code verification ─────────────────────────────────────────────────────

  const handleVerifyCode = async () => {
    const clean = code.trim().toUpperCase()
    // M-Pesa receipt codes are exactly 10 alphanumeric characters
    if (clean.length !== 10) { setCodeError('Enter a valid 10-character M-Pesa receipt code e.g. RCK12ABC3D'); return }
    
    setCodeError('')
    setSubmitting(true)
    
    // Simulate a brief loading state for the cashier
    setTimeout(() => {
        const r: MpesaResult = {
          receiptNumber: clean,
          phoneNumber: 'Manual Till Payment',
          amount: amount,
        }
        setResult(r)
        setStep('success')
        onSuccess(r)
        setSubmitting(false)
    }, 800)
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  const modal = (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.65)', padding: '1rem',
    }}>
      <div style={{
        background: 'white', borderRadius: '1.25rem', width: '100%', maxWidth: '22rem',
        boxShadow: '0 24px 64px rgba(0,0,0,0.35)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          background: `linear-gradient(135deg, ${GREEN} 0%, ${DKGREEN} 100%)`,
          padding: '1.25rem 1.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {(mode !== 'select' && step === 'input') && (
              <button onClick={() => { setMode('select'); setStep('input'); setPhoneError(''); setCodeError('') }}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%',
                         padding: '0.3rem', cursor: 'pointer', display: 'flex', color: 'white', marginRight: '0.25rem' }}>
                <ArrowLeft size={16} />
              </button>
            )}
            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '50%', padding: '0.5rem' }}>
              <Smartphone size={20} color="white" />
            </div>
            <div>
              <p style={{ color: 'white', fontWeight: 700, fontSize: '1rem', margin: 0 }}>M-Pesa Payment</p>
              <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8125rem', margin: 0 }}>{fmt(amount)}</p>
            </div>
          </div>
          {step !== 'waiting' && (
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%',
              padding: '0.375rem', cursor: 'pointer', display: 'flex', color: 'white' }}>
              <X size={18} />
            </button>
          )}
        </div>

        <div style={{ padding: '1.5rem' }}>

          {/* ── MODE SELECT ─────────────────────────────────────────── */}
          {mode === 'select' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0 0 0.25rem' }}>
                How is the customer paying?
              </p>

              <button onClick={() => setMode('stk')} style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '1rem 1.25rem', borderRadius: '0.875rem',
                border: `2px solid ${GREEN}`, background: '#f0fdf4',
                cursor: 'pointer', textAlign: 'left', width: '100%',
              }}>
                <div style={{ background: GREEN, borderRadius: '50%', padding: '0.5rem', flexShrink: 0 }}>
                  <Smartphone size={20} color="white" />
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.9375rem', margin: '0 0 0.125rem', color: '#14532d' }}>
                    Send STK Push
                  </p>
                  <p style={{ fontSize: '0.8125rem', color: '#15803d', margin: 0 }}>
                    Prompt customer's phone to pay
                  </p>
                </div>
              </button>

              <button onClick={() => setMode('code')} style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '1rem 1.25rem', borderRadius: '0.875rem',
                border: '2px solid #d1d5db', background: '#f9fafb',
                cursor: 'pointer', textAlign: 'left', width: '100%',
              }}>
                <div style={{ background: '#374151', borderRadius: '50%', padding: '0.5rem', flexShrink: 0 }}>
                  <Hash size={20} color="white" />
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.9375rem', margin: '0 0 0.125rem', color: '#111827' }}>
                    Enter M-Pesa Code
                  </p>
                  <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: 0 }}>
                    Customer already paid directly to till
                  </p>
                </div>
              </button>

              <button onClick={onClose} style={{
                padding: '0.625rem', background: 'none', border: '1.5px solid #e5e7eb',
                borderRadius: '0.625rem', fontSize: '0.875rem', color: '#6b7280',
                cursor: 'pointer', marginTop: '0.25rem',
              }}>
                Cancel — Pay with Cash
              </button>
            </div>
          )}

          {/* ── STK PUSH: INPUT ─────────────────────────────────────── */}
          {mode === 'stk' && step === 'input' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
                Enter the customer's phone number. They'll receive a payment prompt.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>Phone Number</label>
                <input
                  type="tel" placeholder="0712 345 678" value={phone} autoFocus
                  onChange={(e) => { setPhone(e.target.value); if (phoneError) setPhoneError('') }}
                  onKeyDown={(e) => e.key === 'Enter' && handleStkSend()}
                  style={{
                    padding: '0.75rem 1rem', fontSize: '1.125rem', fontWeight: 600,
                    border: `2px solid ${phoneError ? '#ef4444' : '#d1d5db'}`,
                    borderRadius: '0.625rem', outline: 'none', width: '100%', boxSizing: 'border-box',
                    letterSpacing: '0.05em',
                  }}
                />
                {phoneError && (
                  <p style={{ color: '#ef4444', fontSize: '0.75rem', margin: 0,
                               display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <AlertCircle size={12} /> {phoneError}
                  </p>
                )}
              </div>
              <button onClick={handleStkSend} disabled={submitting || !phone.trim()} style={{
                padding: '0.875rem', background: submitting || !phone.trim() ? '#9ca3af' : GREEN,
                color: 'white', border: 'none', borderRadius: '0.625rem', fontSize: '1rem',
                fontWeight: 700, cursor: submitting || !phone.trim() ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              }}>
                {submitting
                  ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Sending…</>
                  : <><Smartphone size={18} /> Send STK Push</>}
              </button>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* ── STK PUSH: WAITING ───────────────────────────────────── */}
          {mode === 'stk' && step === 'waiting' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                          gap: '1rem', textAlign: 'center' }}>
              <div style={{
                width: '5rem', height: '5rem', borderRadius: '50%', background: '#f0fdf4',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `3px solid ${GREEN}`,
                animation: 'pulse 1.5s ease-in-out infinite',
              }}>
                <Smartphone size={32} color={GREEN} />
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: '1rem', margin: '0 0 0.25rem' }}>Waiting for payment…</p>
                <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>Check phone and enter M-Pesa PIN</p>
              </div>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.75rem',
                            padding: '0.75rem 1rem', width: '100%' }}>
                <p style={{ margin: '0 0 0.25rem', fontSize: '0.8125rem', color: '#15803d', fontWeight: 600 }}>
                  STK Push sent to {phone}
                </p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#16a34a' }}>Amount: <strong>{fmt(amount)}</strong></p>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>
                Waiting {elapsed}s · Auto-detecting…
              </p>
              <button onClick={handleRetry} style={{
                padding: '0.5rem 1.5rem', border: '1.5px solid #e5e7eb',
                borderRadius: '0.5rem', background: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.875rem',
              }}>
                Cancel / Try Different Number
              </button>
              <style>{`
                @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.8;transform:scale(1.05)} }
                @keyframes spin  { to { transform: rotate(360deg); } }
              `}</style>
            </div>
          )}

          {/* ── CODE VERIFICATION: INPUT ─────────────────────────────── */}
          {mode === 'code' && step === 'input' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
                Verify the M-Pesa SMS on the customer's phone and enter the 10-character Receipt Code to link this sale.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>
                  M-Pesa Receipt Code
                </label>
                <input
                  type="text" placeholder="e.g. RCK12ABC3D" value={code} autoFocus maxLength={10}
                  onChange={(e) => { setCode(e.target.value.toUpperCase()); if (codeError) setCodeError('') }}
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyCode()}
                  style={{
                    padding: '0.75rem 1rem', fontSize: '1.25rem', fontWeight: 700,
                    border: `2px solid ${codeError ? '#ef4444' : '#d1d5db'}`,
                    borderRadius: '0.625rem', outline: 'none', width: '100%', boxSizing: 'border-box',
                    letterSpacing: '0.15em', fontFamily: 'monospace', textTransform: 'uppercase',
                  }}
                />
                {codeError && (
                  <p style={{ color: '#ef4444', fontSize: '0.75rem', margin: 0,
                               display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <AlertCircle size={12} /> {codeError}
                  </p>
                )}
              </div>
              <button onClick={handleVerifyCode} disabled={submitting || !code.trim()} style={{
                padding: '0.875rem', background: submitting || !code.trim() ? '#9ca3af' : '#1f2937',
                color: 'white', border: 'none', borderRadius: '0.625rem', fontSize: '1rem',
                fontWeight: 700, cursor: submitting || !code.trim() ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              }}>
                {submitting
                  ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Processing…</>
                  : <><Hash size={18} /> Record Payment</>}
              </button>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* ── SUCCESS ─────────────────────────────────────────────── */}
          {step === 'success' && result && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                          gap: '1rem', textAlign: 'center' }}>
              <div style={{
                width: '5rem', height: '5rem', borderRadius: '50%', background: '#f0fdf4',
                display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #16a34a',
              }}>
                <CheckCircle2 size={36} color="#16a34a" />
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: '1.125rem', margin: '0 0 0.25rem' }}>Payment Confirmed!</p>
                <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>{fmt(result.amount)} received via M-Pesa</p>
              </div>

              {/* Receipt details */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.75rem',
                            padding: '1rem', width: '100%', textAlign: 'left',
                            display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#15803d' }}>Receipt No.</span>
                  <span style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '0.1em',
                                 fontFamily: 'monospace', color: '#14532d' }}>
                    {result.receiptNumber}
                  </span>
                </div>
                {result.phoneNumber && result.phoneNumber !== 'unknown' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: '#15803d' }}>Phone / Origin</span>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#14532d' }}>
                      {result.phoneNumber}
                    </span>
                  </div>
                )}
                {result.customerName && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: '#15803d' }}>Customer</span>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#14532d' }}>
                      {result.customerName}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              borderTop: '1px solid #bbf7d0', paddingTop: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#15803d' }}>Amount Paid</span>
                  <span style={{ fontWeight: 700, fontSize: '1rem', color: '#14532d' }}>
                    {fmt(result.amount)}
                  </span>
                </div>
              </div>

              <button onClick={onClose} style={{
                padding: '0.875rem 2rem', background: '#16a34a', color: 'white',
                border: 'none', borderRadius: '0.625rem', fontSize: '1rem',
                fontWeight: 700, cursor: 'pointer', width: '100%',
              }}>
                Done — Print Receipt
              </button>
            </div>
          )}

          {/* ── FAILED ──────────────────────────────────────────────── */}
          {step === 'failed' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                          gap: '1rem', textAlign: 'center' }}>
              <div style={{
                width: '5rem', height: '5rem', borderRadius: '50%', background: '#fef2f2',
                display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #dc2626',
              }}>
                <XCircle size={36} color="#dc2626" />
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: '1rem', margin: '0 0 0.25rem' }}>Payment Failed</p>
                <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>{errorMessage}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                <button onClick={handleRetry} style={{
                  padding: '0.875rem', background: GREEN, color: 'white',
                  border: 'none', borderRadius: '0.625rem', fontSize: '1rem', fontWeight: 700, cursor: 'pointer',
                }}>
                  Try Again
                </button>
                <button onClick={onClose} style={{
                  padding: '0.75rem', background: 'none', border: '1.5px solid #e5e7eb',
                  borderRadius: '0.625rem', fontSize: '0.9rem', color: '#6b7280', cursor: 'pointer', fontWeight: 500,
                }}>
                  Cancel — Pay with Cash
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

export default MpesaPaymentModal
