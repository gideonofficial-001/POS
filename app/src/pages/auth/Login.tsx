import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authApi, generateDeviceFingerprint } from '@/api';
import { useAuthStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Lock, Mail } from 'lucide-react';
import { toast } from 'sonner';

const Login = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string; deviceFingerprint: string }) => {
      const response = await authApi.login(credentials.email, credentials.password, credentials.deviceFingerprint);
      return response.data;
    },
    onSuccess: (data) => {
      if (data.requiresDeviceAuth) {
        // Store email and device fingerprint for device auth
        localStorage.setItem('pendingAuthEmail', email);
        localStorage.setItem('deviceRequestId', data.deviceRequestId);
        navigate('/device-auth');
        return;
      }

      setAuth(data.user, data.access_token);
      toast.success('Login successful!');

      // Redirect based on role
      switch (data.user.role) {
        case 'SUPER_ADMIN':
          navigate('/');
          break;
        case 'OVERALL_MANAGER':
          navigate('/manager');
          break;
        case 'BRANCH_MANAGER':
          navigate('/branch');
          break;
        default:
          navigate('/');
      }
    },
    onError: (error: any) => {
      setError(error.response?.data?.message || 'Login failed. Please try again.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    const deviceFingerprint = generateDeviceFingerprint();
    loginMutation.mutate({ email, password, deviceFingerprint });
  };

  return (
    <Card className="w-full shadow-xl">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-center mb-4">
          <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-2xl">N</span>
          </div>
        </div>
        <CardTitle className="text-2xl text-center">Welcome Back</CardTitle>
        <CardDescription className="text-center">
          Sign in to Njugush Enterprises POS
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
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
              <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
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
          <Button
            type="submit"
            className="w-full"
            disabled={loginMutation.isPending}
          >
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
      <CardFooter className="flex flex-col space-y-2">
        <p className="text-xs text-center text-gray-500">
          Default credentials for testing:
        </p>
        <div className="text-xs text-center text-gray-400 space-y-1">
          <p>CEO: ceo@njugush.co.ke / admin123</p>
          <p>Manager: manager@njugush.co.ke / admin123</p>
        </div>
      </CardFooter>
    </Card>
  );
};

export default Login;
