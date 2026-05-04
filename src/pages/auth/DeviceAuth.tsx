import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/api';
import { useAuthStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Smartphone, Shield } from 'lucide-react';
import { toast } from 'sonner';

const DeviceAuth = () => {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [authorizationCode, setAuthorizationCode] = useState('');
  const [error, setError] = useState('');

  const requestId = localStorage.getItem('deviceRequestId');

  const verifyMutation = useMutation({
    mutationFn: async (code: string) => {
      if (!requestId) throw new Error('No device request found');
      const response = await authApi.verifyDeviceCode(requestId, code);
      return response.data;
    },
    onSuccess: (data) => {
      setAuth(data.user, data.access_token);
      localStorage.removeItem('pendingAuthEmail');
      localStorage.removeItem('deviceRequestId');
      toast.success('Device authorized successfully!');

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
      setError(error.response?.data?.message || 'Invalid authorization code');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!authorizationCode) {
      setError('Please enter the authorization code');
      return;
    }

    verifyMutation.mutate(authorizationCode);
  };

  return (
    <Card className="w-full shadow-xl">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-center mb-4">
          <div className="w-16 h-16 bg-amber-100 rounded-xl flex items-center justify-center">
            <Shield className="w-8 h-8 text-amber-600" />
          </div>
        </div>
        <CardTitle className="text-2xl text-center">Device Authorization</CardTitle>
        <CardDescription className="text-center">
          This device needs to be authorized before you can log in.
          <br />
          Please contact your admin or manager for the authorization code.
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
            <Label htmlFor="code">Authorization Code</Label>
            <div className="relative">
              <Smartphone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="code"
                type="text"
                placeholder="Enter 6-digit code"
                value={authorizationCode}
                onChange={(e) => setAuthorizationCode(e.target.value)}
                className="pl-10 text-center text-2xl tracking-widest"
                maxLength={6}
                disabled={verifyMutation.isPending}
              />
            </div>
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={verifyMutation.isPending}
          >
            {verifyMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify Device'
            )}
          </Button>
        </form>
        <div className="mt-4 text-center">
          <Button
            variant="link"
            onClick={() => navigate('/login')}
            className="text-sm"
          >
            Back to Login
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DeviceAuth;
