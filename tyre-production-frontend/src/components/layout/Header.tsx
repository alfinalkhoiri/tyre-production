import { LogOut, Factory } from 'lucide-react'
import { useAuth, ROLE_LABEL, ROLE_COLOR } from '@/context/AuthContext'

export function Header() {
  const { user, role, logout } = useAuth()
  const colors = role ? ROLE_COLOR[role] : null
  const displayName = user?.first_name
    ? `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`
    : user?.username ?? ''

  return (
    <header style={{
      height: '52px',
      background: '#1e293b',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '20px' }}>🏭</span>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: '16px' }}>TyreProd</span>
        <span style={{ color: '#64748b', fontSize: '13px' }}>Subcon Cirebon</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {role && colors && (
          <div style={{
            background: colors.bg,
            border: `1px solid ${colors.border}`,
            borderRadius: '6px',
            padding: '4px 12px',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <Factory size={13} color={colors.text} />
            <span style={{ color: colors.text, fontSize: '12px', fontWeight: 700 }}>
              {ROLE_LABEL[role]}
            </span>
            {displayName && (
              <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                — {displayName}
              </span>
            )}
          </div>
        )}
        <button
          onClick={logout}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '4px',
            color: '#94a3b8', fontSize: '12px', padding: '4px 8px',
            borderRadius: '6px', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#ffffff10' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
        >
          <LogOut size={14} />
          Keluar
        </button>
      </div>
    </header>
  )
}
