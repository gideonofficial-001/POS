import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore, useSidebarStore, useNotificationStore } from '@/store'
import { notificationsApi } from '@/api'
import Sidebar from './Sidebar'
import Header from './Header'

const MainLayout = () => {
  const { user } = useAuthStore()
  const { collapsed } = useSidebarStore()
  const { setUnreadCount } = useNotificationStore()

  // Fetch unread notification count
  const { data: unreadData } = useQuery({
    queryKey: ['unread-count'],
    queryFn: async () => {
      const response = await notificationsApi.getUnreadCount()
      return response.data
    },
    enabled: !!user,
    refetchInterval: 30000,
  })

  useEffect(() => {
    if (unreadData) {
      setUnreadCount(unreadData.count)
    }
  }, [unreadData, setUnreadCount])

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className={`transition-all duration-300 ${collapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <Header />
        <main className="p-4 lg:p-6 pt-20 lg:pt-24">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default MainLayout