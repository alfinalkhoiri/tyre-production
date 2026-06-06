import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export function LoginPage() {
  const navigate = useNavigate()
  const { login, isLoading } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError('Username dan password wajib diisi.')
      return
    }
    setError('')
    try {
      await login(username.trim(), password)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 401) {
        setError('Username atau password salah.')
      } else {
        setError('Gagal terhubung ke server. Pastikan backend berjalan.')
      }
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '64px', height: '64px',
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            borderRadius: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px',
            margin: '0 auto 12px',
            boxShadow: '0 8px 24px #2563eb30',
          }}>🏭</div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
            TyreProd
          </h1>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>
            Sistem Manajemen Produksi Ban · Subcon Cirebon
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '32px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          border: '1px solid #e5e7eb',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', margin: '0 0 24px' }}>
            Masuk ke Sistem
          </h2>

          <form onSubmit={handleSubmit}>
            {/* Username */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block', fontSize: '13px', fontWeight: 500,
                color: '#374151', marginBottom: '6px',
              }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Masukkan username"
                disabled={isLoading}
                autoFocus
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: '#111827',
                  background: isLoading ? '#f9fafb' : '#fff',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#2563eb' }}
                onBlur={e => { e.currentTarget.style.borderColor = '#d1d5db' }}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block', fontSize: '13px', fontWeight: 500,
                color: '#374151', marginBottom: '6px',
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    padding: '10px 40px 10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#111827',
                    background: isLoading ? '#f9fafb' : '#fff',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#2563eb' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#d1d5db' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{
                    position: 'absolute', right: '10px', top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#9ca3af', fontSize: '16px', padding: '2px',
                  }}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '16px',
                fontSize: '13px',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span>⚠️</span>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '11px',
                background: isLoading ? '#93c5fd' : '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
              onMouseEnter={e => {
                if (!isLoading) (e.currentTarget as HTMLButtonElement).style.background = '#1d4ed8'
              }}
              onMouseLeave={e => {
                if (!isLoading) (e.currentTarget as HTMLButtonElement).style.background = '#2563eb'
              }}
            >
              {isLoading ? (
                <>
                  <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
                  Memproses...
                </>
              ) : (
                'Masuk'
              )}
            </button>
          </form>
        </div>

        {/* Role info */}
        <div style={{
          marginTop: '20px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '14px 16px',
        }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Role Tersedia
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {[
              { role: 'Admin', color: '#7c3aed' },
              { role: 'Manager', color: '#2563eb' },
              { role: 'Operator', color: '#16a34a' },
              { role: 'Viewer', color: '#6b7280' },
            ].map(r => (
              <span key={r.role} style={{
                fontSize: '11px', fontWeight: 500,
                color: r.color,
                background: `${r.color}15`,
                border: `1px solid ${r.color}30`,
                borderRadius: '20px',
                padding: '2px 10px',
              }}>
                {r.role}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
