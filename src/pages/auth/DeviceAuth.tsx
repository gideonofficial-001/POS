import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/api'
import { useAuthStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Shield, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

const DeviceAuth = () => {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [authCode, setAuthCode] = useState('')
  const [error, setError] = useState('')

  const requestId = localStorage.getItem('deviceRequestId') || ''

  // 1. Edge Case: Boot them back to login if they shouldn't be here
  useEffect(() => {
    if (!requestId) {
      toast.error('No pending authorization found. Please log in again.')
      navigate('/login')
    }
  }, [requestId, navigate])

  const verifyMutation = useMutation({
    mutationFn: async (data: { requestId: string; authorizationCode: string }) => {
      const response = await authApi.verifyDeviceCode(data.requestId, data.authorizationCode)
      return response.data
    },
    onSuccess: (data) => {
      setAuth(data.user, data.access_token)
      localStorage.removeItem('pendingAuthEmail')
      localStorage.removeItem('deviceRequestId')
      toast.success('Device authorized successfully!')

      switch (data.user.role) {
        case 'SUPER_ADMIN':
          navigate('/admin/dashboard')
          break
        case 'OVERALL_MANAGER':
          navigate('/manager/dashboard')
          break
        case 'BRANCH_MANAGER':
          navigate('/branch/dashboard')
          break
        default:
          navigate('/')
      }
    },
    onError: (error: any) => {
      const msg = error.response?.data?.message || 'Invalid authorization code'
      setError(msg)
      toast.error(msg)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!authCode || authCode.length !== 6) {
      setError('Please enter the full 6-digit authorization code')
      return
    }

    verifyMutation.mutate({ requestId, authorizationCode: authCode })
  }

  const handleCancel = () => {
    localStorage.removeItem('pendingAuthEmail')
    localStorage.removeItem('deviceRequestId')
    navigate('/login')
  }

  // If there's no requestId, don't render the form while the useEffect redirects
  if (!requestId) return null; 

  return (
    <Card className="w-full shadow-xl">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-center mb-4">
          <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center">
            <Shield className="w-8 h-8 text-primary" />
          </div>
        </div>
        <CardTitle className="text-2xl text-center">Device Authorization</CardTitle>
        <CardDescription className="text-center">
          Your administrator has been notified. Once they approve your device,
          they'll share a 6-digit code with you directly.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="authCode">Authorization Code</Label>
            <Input
              id="authCode"
              type="text"
              inputMode="numeric" // 2. Mobile Keyboard Improvement
              pattern="[0-9]*"
              placeholder="000000"
              maxLength={6}
              value={authCode}
              onChange={(e) => setAuthCode(e.target.value.replace(/\D/g, ''))}
              className="text-center text-2xl tracking-[0.5em] font-mono"
              disabled={verifyMutation.isPending}
            />
          </div>
          <Button type="submit" className="w-full" disabled={verifyMutation.isPending}>
            {verifyMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify Code'
            )}
          </Button>
        </form>

        {/* 3. The Escape Hatch */}
        <div className="mt-6 flex flex-col items-center gap-3">
          <p className="text-xs text-center text-muted-foreground">
            Contact your administrator if you haven't received the code.
          </p>
          <Button variant="ghost" size="sm" onClick={handleCancel} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Login
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default DeviceAuth
