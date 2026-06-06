import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAuditLogs, type AuditLogEntry } from '@/api/audit'
import { Pagination } from '@/components/ui/Pagination'
import { SkeletonTable } from '@/components/ui/Skeleton'

const ACTION_COLORS: Record<string, { bg: string; color: string }> = {
  LOGIN:         { bg: '#eff6ff', color: '#2563eb' },
  LOGOUT:        { bg: '#f9fafb', color: '#6b7280' },
  CREATE:        { bg: '#f0fdf4', color: '#16a34a' },
  UPDATE:        { bg: '#fffbeb', color: '#d97706' },
  DELETE:        { bg: '#fef2f2', color: '#dc2626' },
  STATUS_CHANGE: { bg: '#faf5ff', color: '#7c3aed' },
}

function ActionBadge({ action }: { action: string }) {
  const s = ACTION_COLORS[action] ?? { bg: '#f3f4f6', color: '#374151' }
  return (
    <span style={{
      background: s.bg, color: s.color,
      fontSize: '11px', fontWeight: 600,
      padding: '2px 8px', borderRadius: '20px',
      whiteSpace: 'nowrap',
    }}>
      {action}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function AuditLogPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [modelFilter, setModelFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, search, actionFilter, modelFilter],
    queryFn: () => getAuditLogs({
      page,
      search: search || undefined,
      action: actionFilter || undefined,
      model_name: modelFilter || undefined,
    }),
    keepPreviousData: true,
  })

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }}>Audit Log</h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
          Riwayat semua aktivitas sistem
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          type="search"
          placeholder="Cari user, model, objek..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{
            padding: '8px 12px', border: '1px solid #e5e7eb',
            borderRadius: '8px', fontSize: '13px', width: '240px',
            outline: 'none',
          }}
        />
        <select
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value); setPage(1) }}
          style={{
            padding: '8px 12px', border: '1px solid #e5e7eb',
            borderRadius: '8px', fontSize: '13px', background: '#fff',
          }}
        >
          <option value="">Semua aksi</option>
          {['LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE'].map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select
          value={modelFilter}
          onChange={e => { setModelFilter(e.target.value); setPage(1) }}
          style={{
            padding: '8px 12px', border: '1px solid #e5e7eb',
            borderRadius: '8px', fontSize: '13px', background: '#fff',
          }}
        >
          <option value="">Semua model</option>
          {['User', 'ProductionOrder', 'StockTransaction'].map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <SkeletonTable rows={8} cols={5} />
      ) : (
        <>
          <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '10px' }}>
            <table className="tbl" style={{ minWidth: '700px' }}>
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>User</th>
                  <th>Aksi</th>
                  <th>Model</th>
                  <th>Objek</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {data?.results.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9ca3af', padding: '24px' }}>Tidak ada data</td></tr>
                )}
                {data?.results.map((entry: AuditLogEntry) => (
                  <tr key={entry.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '12px', color: '#6b7280' }}>
                      {formatDate(entry.created_at)}
                    </td>
                    <td style={{ fontWeight: 600, fontSize: '13px' }}>{entry.username || '—'}</td>
                    <td><ActionBadge action={entry.action} /></td>
                    <td style={{ fontSize: '12px', color: '#6b7280' }}>{entry.model_name || '—'}</td>
                    <td style={{ fontSize: '13px' }}>{entry.object_repr || entry.object_id || '—'}</td>
                    <td style={{ fontSize: '12px', color: '#9ca3af', fontFamily: 'monospace' }}>
                      {entry.ip_address || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data && (
            <Pagination
              page={page}
              pageSize={20}
              total={data.count}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  )
}
