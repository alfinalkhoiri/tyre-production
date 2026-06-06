import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth, getUIGroup } from '@/context/AuthContext'
import { getPendingCounts } from '@/api/production'

const GUDANG_TABS = [
  { to: '/',          label: 'Dashboard',        end: true,  badgeKey: null },
  { to: '/spec',      label: 'Spesifikasi',       end: false, badgeKey: null },
  { to: '/stok',      label: 'Stok Material',     end: false, badgeKey: null },
  { to: '/izin',      label: 'Izin Produksi',     end: false, badgeKey: null },
  { to: '/terima',    label: 'Terima Hasil',      end: false, badgeKey: 'result_sent' },
  { to: '/analytics', label: 'Analitik',          end: false, badgeKey: null },
  { to: '/forecast',  label: 'Forecast',          end: false, badgeKey: null },
]

const PRODUKSI_TABS = [
  { to: '/',          label: 'Dashboard',        end: true,  badgeKey: null },
  { to: '/spec',      label: 'Spesifikasi',       end: false, badgeKey: null },
  { to: '/stok-prod', label: 'Stok Produksi',    end: false, badgeKey: null },
  { to: '/material',  label: 'Material',         end: false, badgeKey: 'pending_shipments' },
  { to: '/kirim',     label: 'Kirim Hasil',      end: false, badgeKey: null },
]

const ADMIN_EXTRA = { to: '/audit', label: 'Audit Log', end: false, badgeKey: null }

export function TabBar() {
  const { role } = useAuth()
  const uiGroup = getUIGroup(role)
  const baseTabs = uiGroup === 'PRODUKSI' ? PRODUKSI_TABS : GUDANG_TABS
  const tabs = role === 'admin' ? [...baseTabs, ADMIN_EXTRA] : baseTabs

  const { data: counts } = useQuery({
    queryKey: ['pending-counts'],
    queryFn: getPendingCounts,
    refetchInterval: 20000,
  })

  const getCount = (key: string | null): number => {
    if (!key || !counts) return 0
    return counts[key as keyof typeof counts] ?? 0
  }

  return (
    <nav style={{
      background: '#fff',
      borderBottom: '1px solid #e5e7eb',
      display: 'flex',
      padding: '0 20px',
      overflowX: 'auto',
    }}>
      {tabs.map(tab => {
        const badge = getCount(tab.badgeKey)
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            style={({ isActive }) => ({
              padding: '12px 16px',
              fontSize: '13px',
              fontWeight: 500,
              color: isActive ? '#2563eb' : '#6b7280',
              borderBottom: isActive ? '2px solid #2563eb' : '2px solid transparent',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
              marginBottom: '-1px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            })}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLAnchorElement
              if (el.style.color !== 'rgb(37, 99, 235)') el.style.color = '#374151'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLAnchorElement
              if (el.style.borderBottomColor !== 'rgb(37, 99, 235)') el.style.color = '#6b7280'
            }}
          >
            {tab.label}
            {badge > 0 && (
              <span style={{
                background: '#ef4444', color: '#fff',
                fontSize: '10px', fontWeight: 700,
                borderRadius: '10px', padding: '1px 6px',
                minWidth: '18px', textAlign: 'center', lineHeight: '16px',
              }}>
                {badge}
              </span>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}
