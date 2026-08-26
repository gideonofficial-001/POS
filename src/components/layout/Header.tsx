import { useNavigate } from 'react-router-dom'
import { useAuthStore, useNotificationStore, useSidebarStore } from '@/store'
import { Bell, Menu, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const Header = () => {
  const { user } = useAuthStore()
  const { unreadCount } = useNotificationStore()
  const { toggleMobile } = useSidebarStore()
  const navigate = useNavigate()

  if (!user) return null

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-auto z-30 bg-background/80 backdrop-blur-md border-b h-16 flex items-center justify-between px-4 lg:px-6">
      <button
        onClick={toggleMobile}
        className="lg:hidden p-2 hover:bg-muted rounded-lg"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-3">
        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={() => navigate('/notifications')}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>

        {/* User Profile */}
        <div className="flex items-center gap-3 pl-3 border-l">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-medium leading-tight">{user.firstName} {user.lastName}</p>
            <p className="text-xs text-muted-foreground capitalize">{user.role.toLowerCase().replace('_', ' ')}</p>
          </div>
          <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header