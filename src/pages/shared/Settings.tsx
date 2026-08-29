import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store'
import api from '@/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { UserCircle, Shield, Eye, EyeOff, Check, AlertCircle } from 'lucide-react'

const Settings = () => {
  const { user, setAuth } = useAuthStore()
  
  // Profile State
  const [firstName, setFirstName] = useState(user?.firstName || '')
  const [lastName, setLastName] = useState(user?.lastName || '')
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)

  // Password State
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

  // Password Visibility Toggles
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Password Strength Logic
  const getPasswordStrength = (pass: string) => {
    let score = 0
    if (pass.length >= 8) score += 25
    if (/[A-Z]/.test(pass)) score += 25
    if (/[0-9]/.test(pass)) score += 25
    if (/[^A-Za-z0-9]/.test(pass)) score += 25
    return score
  }

  const strength = getPasswordStrength(newPassword)
  let strengthColor = 'bg-slate-200'
  let strengthLabel = 'Weak'
  
  if (newPassword.length > 0) {
    if (strength <= 25) { strengthColor = 'bg-red-500'; strengthLabel = 'Weak' }
    else if (strength <= 75) { strengthColor = 'bg-amber-500'; strengthLabel = 'Moderate' }
    else { strengthColor = 'bg-green-500'; strengthLabel = 'Strong' }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUpdatingProfile(true)
    try {
      // 🚀 Changed from `/users/${user?.id}` to `/users/me/profile`
      const res = await api.patch('/users/me/profile', { firstName, lastName })
      
      if (user) {
        setAuth({ ...user, firstName, lastName }, localStorage.getItem('access_token') || '')
      }
      toast.success('Profile updated successfully!')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update profile')
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      return toast.error('New passwords do not match')
    }
    if (strength < 50) {
      return toast.error('Please choose a stronger password')
    }

    setIsUpdatingPassword(true)
    try {
      // 🚀 Changed from `/users/${user?.id}/password` to `/users/me/password`
      await api.patch('/users/me/password', { 
        currentPassword, 
        newPassword 
      })
      toast.success('Password updated successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update password')
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Account Settings</h1>
        <p className="text-muted-foreground">Manage your profile and security preferences</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Card */}
        <Card className="h-fit shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserCircle className="w-5 h-5 text-primary" /> Personal Information
            </CardTitle>
            <CardDescription>Update your display name.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input value={firstName} onChange={e => setFirstName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input value={lastName} onChange={e => setLastName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Email (Cannot be changed here)</Label>
                <Input value={user?.email || ''} disabled className="bg-muted" />
              </div>
              <Button type="submit" disabled={isUpdatingProfile || (!firstName || !lastName)}>
                {isUpdatingProfile ? 'Saving...' : 'Save Profile Changes'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Security Card */}
        <Card className="shadow-sm border-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="w-5 h-5 text-primary" /> Security & Password
            </CardTitle>
            <CardDescription>Ensure your account is using a long, random password to stay secure.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-5">
              <div className="space-y-2">
                <Label>Current Password</Label>
                <div className="relative">
                  <Input 
                    type={showCurrent ? "text" : "password"} 
                    value={currentPassword} 
                    onChange={e => setCurrentPassword(e.target.value)} 
                    required 
                  />
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground">
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2 border-t pt-4">
                <Label>New Password</Label>
                <div className="relative">
                  <Input 
                    type={showNew ? "text" : "password"} 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)} 
                    required 
                  />
                  <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground">
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                
                {/* Password Strength Enforcer */}
                {newPassword && (
                  <div className="space-y-1.5 mt-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-muted-foreground">Password strength</span>
                      <span className={strengthColor.replace('bg-', 'text-')}>{strengthLabel}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-300 ${strengthColor}`} style={{ width: `${Math.max(strength, 10)}%` }} />
                    </div>
                    <ul className="text-[10px] text-muted-foreground space-y-1 pt-1">
                      <li className="flex items-center gap-1">{newPassword.length >= 8 ? <Check className="w-3 h-3 text-green-500" /> : <AlertCircle className="w-3 h-3" />} At least 8 characters</li>
                      <li className="flex items-center gap-1">{/[A-Z]/.test(newPassword) ? <Check className="w-3 h-3 text-green-500" /> : <AlertCircle className="w-3 h-3" />} One uppercase letter</li>
                      <li className="flex items-center gap-1">{/[0-9]/.test(newPassword) ? <Check className="w-3 h-3 text-green-500" /> : <AlertCircle className="w-3 h-3" />} One number</li>
                    </ul>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Confirm New Password</Label>
                <div className="relative">
                  <Input 
                    type={showConfirm ? "text" : "password"} 
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)} 
                    required 
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={isUpdatingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword}>
                {isUpdatingPassword ? 'Updating Security...' : 'Update Password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Settings
