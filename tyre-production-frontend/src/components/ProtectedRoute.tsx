import { Navigate } from 'react-router-dom'
import { useAuth, type Role } from '@/context/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: Role[]
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, role } = useAuth()

  if (!isAuthenticated || !role) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '300px', gap: '12px',
      }}>
        <div style={{ fontSize: '48px' }}>🔒</div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: 0 }}>
          Akses Ditolak
        </h2>
        <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
          Role <strong>{role}</strong> tidak punya izin mengakses halaman ini.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
