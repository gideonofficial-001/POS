import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/api'
import { useAuthStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Lock, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { generateDeviceFingerprint } from '@/lib/utils'

const Login = () => {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string; deviceFingerprint: string }) => {
      const response = await authApi.login(credentials.email, credentials.password, credentials.deviceFingerprint)
      return response.data
    },
    onSuccess: (data) => {
      if (data.requiresDeviceAuth) {
        localStorage.setItem('pendingAuthEmail', email)
        localStorage.setItem('deviceRequestId', data.deviceRequestId)
        navigate('/device-auth')
        return
      }

      setAuth(data.user, data.access_token)
      toast.success('Login successful!')

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
      const msg = error.response?.data?.message || error.message || 'Login failed'
      setError(msg)
      toast.error(msg)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('Please enter both email and password')
      return
    }

    const deviceFingerprint = generateDeviceFingerprint()
    loginMutation.mutate({ email, password, deviceFingerprint })
  }

  return (
    <Card className="w-full shadow-xl">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-center mb-4">
          <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-2xl">N</span>
          </div>
        </div>
        <CardTitle className="text-2xl text-center">Welcome Back</CardTitle>
        <CardDescription className="text-center">
          Sign in to Njugush Enterprises POS
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
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                disabled={loginMutation.isPending}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                disabled={loginMutation.isPending}
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-center text-muted-foreground w-full">
          Njugush Enterprises POS System v1.0
        </p>
      </CardFooter>
    </Card>
  )
}

export default Login