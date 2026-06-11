import React, { createContext, useContext, useState } from 'react'
import axios from 'axios'

export type Role = 'admin' | 'purchasing' | 'operator' | 'viewer'

export interface AuthUser {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  is_staff: boolean
  role: Role
}

/** Maps backend role to GUDANG or PRODUKSI UI layout */
export function getUIGroup(role: Role | null): 'GUDANG' | 'PRODUKSI' {
  return role === 'operator' ? 'PRODUKSI' : 'GUDANG'
}

export const ROLE_LABEL: Record<Role, string> = {
  admin:      'Admin',
  purchasing: 'Admin Purchasing',
  operator:   'Operator Gudang',
  viewer:     'Manajemen',
}

export const ROLE_COLOR: Record<Role, { bg: string; border: string; text: string }> = {
  admin:      { bg: '#6d28d920', border: '#7c3aed40', text: '#a78bfa' },
  purchasing: { bg: '#1d4ed820', border: '#3b82f640', text: '#60a5fa' },
  operator:   { bg: '#15803d20', border: '#22c55e40', text: '#4ade80' },
  viewer:     { bg: '#37415120', border: '#6b728040', text: '#9ca3af' },
}

interface AuthContextType {
  user: AuthUser | null
  role: Role | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

function loadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadUser)
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('access_token'))
  const [isLoading, setIsLoading] = useState(false)

  const login = async (username: string, password: string) => {
    setIsLoading(true)
    try {
      const { data } = await axios.post('/api/auth/login/', { username, password })
      localStorage.setItem('access_token', data.access)
      localStorage.setItem('refresh_token', data.refresh)
      localStorage.setItem('user', JSON.stringify(data.user))
      setUser(data.user)
      setIsAuthenticated(true)
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    const refresh = localStorage.getItem('refresh_token')
    const token = localStorage.getItem('access_token')
    if (refresh) {
      axios.post('/api/auth/logout/', { refresh }, {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {})
    }
    localStorage.clear()
    setUser(null)
    setIsAuthenticated(false)
  }

  return (
    <AuthContext.Provider value={{
      user,
      role: user?.role ?? null,
      isAuthenticated,
      isLoading,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
