import { useQuery } from '@tanstack/react-query'
import { getProdStock } from '@/api/production'

function formatNum(n: number, d = 2) {
  return n.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d })
}

export function StokProdPage() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['prod-stock'],
    queryFn: getProdStock,
    refetchInterval: 30000,
  })

  const lowRows = rows.filter(r => r.balance < 0)
  const habisRows = rows.filter(r => r.balance === 0 && r.received > 0)

  const statusOf = (r: typeof rows[0]) => {
    if (r.received === 0) return 'KOSONG'
    if (r.balance < 0) return 'MINUS'
    if (r.balance === 0) return 'HABIS'
    return 'TERSEDIA'
  }

  const statusChip: Record<string, string> = {
    TERSEDIA: 'chip-success',
    HABIS: 'chip-neutral',
    MINUS: 'chip-danger',
    KOSONG: 'chip-neutral',
  }

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }}>Stok Produksi</h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
          Sisa material di lini produksi (Diterima − Pemakaian Harian)
        </p>
      </div>

      {/* Formula box */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: '14px', background: 'var(--color-background-info)', border: '1px solid var(--color-border-info)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', fontWeight: 600, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--color-text-info)' }}>📥 Diterima dari Gudang</span>
          <span style={{ color: 'var(--color-text-secondary)' }}>−</span>
          <span style={{ color: 'var(--color-text-warning)' }}>📊 Pemakaian Harian</span>
          <span style={{ color: 'var(--color-text-secondary)' }}>=</span>
          <span style={{ color: 'var(--color-text-success)' }}>📦 Sisa Stok Produksi</span>
        </div>
      </div>

      {/* Alerts */}
      {lowRows.length > 0 && (
        <div className="alert alert-danger" style={{ marginBottom: '12px' }}>
          ⚠️ {lowRows.length} material <strong>minus</strong> — pemakaian melebihi yang diterima
        </div>
      )}
      {habisRows.length > 0 && lowRows.length === 0 && (
        <div className="alert alert-warning" style={{ marginBottom: '12px' }}>
          ⚠️ {habisRows.length} material <strong>habis</strong>
        </div>
      )}

      {/* Metrics */}
      <div className="metrics-grid" style={{ marginBottom: '14px' }}>
        {[
          { label: 'Tersedia', value: rows.filter(r => statusOf(r) === 'TERSEDIA').length, color: 'var(--color-text-success)' },
          { label: 'Habis', value: habisRows.length, color: 'var(--color-text-secondary)' },
          { label: 'Minus', value: lowRows.length, color: 'var(--color-text-danger)' },
          { label: 'Total Material', value: rows.length, color: undefined },
        ].map(({ label, value, color }) => (
          <div key={label} className="metric-card">
            <div className="metric-value" style={{ color }}>{value}</div>
            <div className="metric-label">{label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>Memuat...</div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Material</th>
                <th style={{ textAlign: 'right' }}>Diterima</th>
                <th style={{ textAlign: 'right' }}>Terpakai</th>
                <th style={{ textAlign: 'right' }}>Sisa Stok</th>
                <th>Status</th>
                <th style={{ minWidth: '120px' }}>Konsumsi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const st = statusOf(row)
                const pct = row.received > 0 ? Math.min(100, (row.used / row.received) * 100) : 0
                return (
                  <tr key={row.material_id} className={st === 'MINUS' ? 'row-danger' : ''}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{row.kode}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{row.name}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatNum(row.received)} {row.unit}</td>
                    <td style={{ textAlign: 'right', color: row.used > row.received ? 'var(--color-text-danger)' : undefined }}>
                      {formatNum(row.used)} {row.unit}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: row.balance < 0 ? 'var(--color-text-danger)' : row.balance === 0 && row.received > 0 ? 'var(--color-text-secondary)' : 'var(--color-text-success)' }}>
                      {formatNum(row.balance)} {row.unit}
                    </td>
                    <td>
                      <span className={`chip ${statusChip[st]} ${st === 'MINUS' ? 'blink' : ''}`}>{st}</span>
                    </td>
                    <td>
                      <div style={{ height: 6, background: 'var(--color-background-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${pct}%`, borderRadius: 3, transition: 'width 0.3s',
                          background: st === 'MINUS' ? 'var(--color-accent-danger)' : 'var(--color-accent-primary)',
                        }} />
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                        {pct.toFixed(0)}% terpakai
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
