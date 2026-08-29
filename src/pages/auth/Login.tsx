import { useState } from 'react'
import { Logo } from '@/components/Logo'
import { useNavigate } from 'react-router-dom'
import api from '@/api'
import { useAuthStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { toast } from 'sonner'
import { MapPin, Loader2, ShieldAlert, AlertCircle } from 'lucide-react'
import { generateDeviceFingerprint } from '@/lib/utils'

interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
}

type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable'

interface LoginPayload {
  email: string
  password: string
  deviceFingerprint: string
  latitude?: number
  longitude?: number
  accuracy?: number
  deviceType?: string
  userAgent?: string
}

const Login = () => {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle')
  const [locationWarning, setLocationWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const requestLocation = (): Promise<LocationData | null> =>
    new Promise((resolve) => {
      if (!navigator.geolocation) {
        setLocationStatus('unavailable')
        return resolve(null)
      }
      setLocationStatus('requesting')
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationStatus('granted')
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          })
        },
        (err) => {
          console.warn('Location denied:', err.message)
          setLocationStatus('denied')
          resolve(null)
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      )
    })

  const getDeviceType = (): string => {
    const ua = navigator.userAgent
    if (/Mobi|Android/i.test(ua)) return 'mobile'
    if (/Tablet|iPad/i.test(ua)) return 'tablet'
    return 'desktop'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setLocationWarning(null)

    try {
      const location = await requestLocation()
      const deviceFingerprint = generateDeviceFingerprint()

      const payload: LoginPayload = {
        email,
        password,
        deviceFingerprint,
        deviceType: getDeviceType(),
        userAgent: navigator.userAgent,
      }

      if (location) {
        payload.latitude = location.latitude
        payload.longitude = location.longitude
        payload.accuracy = location.accuracy
      }

      const response = await api.post('/auth/login', payload)
      const data = response.data

      // Scenario A: Backend returns 200 OK but requires device auth
      if (data.requiresDeviceAuth) {
        localStorage.setItem('pendingAuthEmail', email)
        localStorage.setItem('deviceRequestId', data.deviceRequestId)
        navigate('/device-auth')
        return
      }

      const { user, access_token, locationWarning: warning } = data

      if (warning) {
        setLocationWarning(warning)
        toast.warning('Login Warning', { description: warning })
      }

      setAuth(user, access_token)

      if (locationStatus === 'granted') {
        toast.success('Login successful', { description: 'Location verified for security.' })
      } else {
        toast.success('Login successful!')
      }

      switch (user.role) {
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
    } catch (err: any) {
      const errorData = err.response?.data

      // Scenario B (THE FIX): Backend throws a 401/403 Error containing the device auth flag
      if (errorData?.requiresDeviceAuth) {
        localStorage.setItem('pendingAuthEmail', email)
        localStorage.setItem('deviceRequestId', errorData.deviceRequestId)
        toast.info('Unrecognized device. Authorization required.')
        navigate('/device-auth')
        return
      }

      const msg = errorData?.message || err.message || 'Login failed. Please try again.'
      const display = Array.isArray(msg) ? msg.join(' ') : msg
      setError(display)
      toast.error('Login Failed', { description: display })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <CardHeader className="space-y-1">
        <div className="flex items-center justify-center mb-4">
          {/* Replaced the blue box with our new Logo */}
          <Logo size="lg" variant="color" showText={false} />
        </div>
        <CardTitle className="text-2xl text-center">Welcome Back</CardTitle>
        <CardDescription className="text-center">
          Sign in to Njugush Enterprises POS
        </CardDescription>
      </CardHeader>

      <CardContent>
        {locationWarning && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>{locationWarning}</span>
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin
              className={`h-4 w-4 shrink-0 ${
                locationStatus === 'granted'
                  ? 'text-green-500'
                  : locationStatus === 'denied'
                  ? 'text-amber-500'
                  : locationStatus === 'requesting'
                  ? 'animate-pulse text-blue-500'
                  : 'text-gray-400'
              }`}
            />
            <span>
              {locationStatus === 'idle' && 'Location will be requested for security'}
              {locationStatus === 'requesting' && 'Requesting location access…'}
              {locationStatus === 'granted' && 'Location access granted'}
              {locationStatus === 'denied' && 'Location denied — using IP check instead'}
              {locationStatus === 'unavailable' && 'Geolocation not supported'}
            </span>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>
      </CardContent>

      <CardFooter>
        <p className="text-xs text-center text-muted-foreground w-full">
          Njugush Enterprises POS System v1.0 · Location is used for security only
        </p>
      </CardFooter>
    </Card>
  )
}

export default Login
