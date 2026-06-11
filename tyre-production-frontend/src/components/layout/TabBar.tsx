import { NavLink, useLocation } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { useState, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getPendingCounts } from '@/api/production'

type FlatTab  = { to: string; label: string; end?: boolean; badgeKey: string | null }
type GroupTab = { group: string; items: FlatTab[] }
type NavItem  = FlatTab | GroupTab

function isGroup(item: NavItem): item is GroupTab {
  return 'group' in item
}

const TAB_DASHBOARD: FlatTab = { to: '/',         label: 'Dashboard',   end: true,  badgeKey: null }
const TAB_SPEC:      FlatTab = { to: '/spec',      label: 'Spesifikasi', end: false, badgeKey: null }
const TAB_ANALYTICS: FlatTab = { to: '/analytics', label: 'Analitik',   end: false, badgeKey: null }
const TAB_FORECAST:  FlatTab = { to: '/forecast',  label: 'Estimasi Kebutuhan', end: false, badgeKey: null }
const TAB_AUDIT:     FlatTab = { to: '/audit',     label: 'Audit Log',  end: false, badgeKey: null }

const GUDANG_ITEMS: FlatTab[] = [
  { to: '/stok',   label: 'Stok Material', end: false, badgeKey: null },
  { to: '/izin',   label: 'Izin Produksi', end: false, badgeKey: null },
  { to: '/terima', label: 'Terima Hasil',  end: false, badgeKey: 'result_sent' },
]

const PRODUKSI_ITEMS: FlatTab[] = [
  { to: '/stok-prod', label: 'Stok Produksi', end: false, badgeKey: null },
  { to: '/material',  label: 'Material',      end: false, badgeKey: 'pending_shipments' },
  { to: '/kirim',     label: 'Kirim Hasil',   end: false, badgeKey: null },
]

const NAV: Record<string, NavItem[]> = {
  admin:      [TAB_DASHBOARD, TAB_SPEC, { group: 'Purchasing', items: GUDANG_ITEMS }, { group: 'Operator', items: PRODUKSI_ITEMS }, TAB_ANALYTICS, TAB_FORECAST, TAB_AUDIT],
  purchasing: [TAB_DASHBOARD, TAB_SPEC, ...GUDANG_ITEMS, TAB_ANALYTICS, TAB_FORECAST],
  operator:   [TAB_DASHBOARD, TAB_SPEC, ...PRODUKSI_ITEMS, TAB_ANALYTICS],
  viewer:     [TAB_DASHBOARD, TAB_SPEC, TAB_ANALYTICS, TAB_FORECAST],
}

const TAB_STYLE: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: '13px',
  fontWeight: 500,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  marginBottom: '-1px',
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  borderBottom: '2px solid transparent',
  transition: 'color 0.15s, border-color 0.15s',
}

function Badge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span style={{
      background: '#ef4444', color: '#fff',
      fontSize: '10px', fontWeight: 700,
      borderRadius: '10px', padding: '1px 6px',
      minWidth: '18px', textAlign: 'center', lineHeight: '16px',
    }}>
      {count}
    </span>
  )
}

function FlatTabItem({ tab, getCount }: { tab: FlatTab; getCount: (k: string | null) => number }) {
  return (
    <NavLink
      to={tab.to}
      end={tab.end}
      style={({ isActive }) => ({
        ...TAB_STYLE,
        color: isActive ? '#2563eb' : '#6b7280',
        borderBottom: isActive ? '2px solid #2563eb' : '2px solid transparent',
      })}
    >
      {tab.label}
      <Badge count={getCount(tab.badgeKey)} />
    </NavLink>
  )
}

function GroupTabItem({ group, getCount }: { group: GroupTab; getCount: (k: string | null) => number }) {
  const [open, setOpen] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const location = useLocation()

  const isAnyChildActive = group.items.some(
    item => location.pathname === item.to || location.pathname.startsWith(item.to + '/')
  )
  const totalBadge = group.items.reduce((sum, item) => sum + getCount(item.badgeKey), 0)

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 150)
  }

  const handleBtnEnter = () => {
    cancelClose()
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setDropPos({ top: rect.bottom + 2, left: rect.left })
    }
    setOpen(true)
  }

  return (
    <>
      <button
        ref={btnRef}
        onMouseEnter={handleBtnEnter}
        onMouseLeave={scheduleClose}
        style={{
          ...TAB_STYLE,
          color: isAnyChildActive ? '#2563eb' : '#6b7280',
          borderBottom: isAnyChildActive ? '2px solid #2563eb' : '2px solid transparent',
        }}
      >
        {group.group}
        <Badge count={totalBadge} />
        <span style={{ fontSize: '10px', opacity: 0.5 }}>▾</span>
      </button>

      {open && createPortal(
        <div
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          style={{
            position: 'fixed',
            top: dropPos.top,
            left: dropPos.left,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            minWidth: '180px',
            zIndex: 9999,
            padding: '4px 0',
          }}
        >
          {group.items.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#2563eb' : '#374151',
                textDecoration: 'none',
                background: isActive ? '#eff6ff' : 'transparent',
              })}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                if (el.style.background !== 'rgb(239, 246, 255)') el.style.background = '#f3f4f6'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                if (el.style.background !== 'rgb(239, 246, 255)') el.style.background = 'transparent'
              }}
            >
              {item.label}
              <Badge count={getCount(item.badgeKey)} />
            </NavLink>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}

export function TabBar() {
  const { role } = useAuth()
  const tabs = NAV[role ?? 'viewer'] ?? NAV.viewer

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
      {tabs.map(item =>
        isGroup(item)
          ? <GroupTabItem key={item.group} group={item} getCount={getCount} />
          : <FlatTabItem  key={item.to}    tab={item}   getCount={getCount} />
      )}
    </nav>
  )
}
