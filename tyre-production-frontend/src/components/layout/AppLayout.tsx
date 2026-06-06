import { Outlet, Navigate } from 'react-router-dom'
import { Header } from './Header'
import { TabBar } from './TabBar'
import { useAuth } from '@/context/AuthContext'

export function AppLayout() {
  const { isAuthenticated, role } = useAuth()
  if (!isAuthenticated || !role) return <Navigate to="/login" replace />

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <TabBar />
      <main style={{
        flex: 1,
        padding: '20px',
        maxWidth: '1280px',
        width: '100%',
        margin: '0 auto',
      }}>
        <Outlet />
      </main>
    </div>
  )
}
