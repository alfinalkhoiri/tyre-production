import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { getProdStock } from '@/api/production'

function formatNum(n: number, d = 2) {
  return n.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d })
}

type ProdStatus = 'TERSEDIA' | 'RENDAH' | 'KRITIS' | 'HABIS' | 'MINUS' | 'KOSONG'

export function StokProdPage() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['prod-stock'],
    queryFn: getProdStock,
    refetchInterval: 30000,
  })

  const statusOf = (r: typeof rows[0]): ProdStatus => {
    if (r.received === 0) return 'KOSONG'
    if (r.balance < 0) return 'MINUS'
    if (r.balance === 0) return 'HABIS'
    if (r.safety_stock > 0 && r.balance <= r.safety_stock * 0.5) return 'KRITIS'
    if (r.safety_stock > 0 && r.balance <= r.safety_stock) return 'RENDAH'
    return 'TERSEDIA'
  }

  const statusChip: Record<ProdStatus, string> = {
    TERSEDIA: 'chip-success',
    RENDAH:   'chip-warning',
    KRITIS:   'chip-danger',
    HABIS:    'chip-neutral',
    MINUS:    'chip-danger',
    KOSONG:   'chip-neutral',
  }

  const critRows  = rows.filter(r => { const s = statusOf(r); return s === 'KRITIS' || s === 'MINUS' })
  const lowRows   = rows.filter(r => statusOf(r) === 'RENDAH')
  const habisRows = rows.filter(r => statusOf(r) === 'HABIS')

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
      {critRows.length > 0 && (
        <div className="alert alert-danger" style={{ marginBottom: '12px' }}>
          <AlertTriangle size={14} />
          <div>
            <strong>{critRows.length} material kritis</strong> — stok produksi di bawah 50% safety stock atau minus.{' '}
            {critRows.map(r => <span key={r.material_id} className="chip chip-danger" style={{ marginLeft: 4 }}>{r.kode}</span>)}
            <div style={{ marginTop: '4px', fontSize: '12px', opacity: 0.8 }}>
              Segera hubungi Purchasing untuk pengiriman material.
            </div>
          </div>
        </div>
      )}
      {lowRows.length > 0 && critRows.length === 0 && (
        <div className="alert alert-warning" style={{ marginBottom: '12px' }}>
          <AlertTriangle size={14} />
          <div>
            <strong>{lowRows.length} material hampir habis</strong> — stok produksi mendekati safety stock.{' '}
            {lowRows.map(r => <span key={r.material_id} className="chip chip-warning" style={{ marginLeft: 4 }}>{r.kode}</span>)}
            <div style={{ marginTop: '4px', fontSize: '12px', opacity: 0.8 }}>
              Informasikan ke Purchasing agar segera mengirim material.
            </div>
          </div>
        </div>
      )}
      {habisRows.length > 0 && critRows.length === 0 && lowRows.length === 0 && (
        <div className="alert alert-warning" style={{ marginBottom: '12px' }}>
          <AlertTriangle size={14} />
          {habisRows.length} material <strong>habis</strong>
        </div>
      )}

      {/* Metrics */}
      <div className="metrics-grid" style={{ marginBottom: '14px' }}>
        {[
          { label: 'Tersedia',      value: rows.filter(r => statusOf(r) === 'TERSEDIA').length, color: 'var(--color-text-success)' },
          { label: 'Rendah',        value: lowRows.length,  color: lowRows.length  > 0 ? 'var(--color-text-warning)' : undefined },
          { label: 'Kritis/Minus',  value: critRows.length, color: critRows.length > 0 ? 'var(--color-text-danger)'  : undefined },
          { label: 'Habis',         value: habisRows.length, color: 'var(--color-text-secondary)' },
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
                <th style={{ textAlign: 'right' }}>Safety Stock</th>
                <th>Status</th>
                <th style={{ minWidth: '140px' }}>Konsumsi vs Safety</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const st = statusOf(row)
                const usedPct   = row.received > 0 ? Math.min(100, (row.used / row.received) * 100) : 0
                const safetyPct = row.safety_stock > 0 && row.received > 0
                  ? Math.min(100, (row.safety_stock / row.received) * 100)
                  : 0
                const isDanger  = st === 'MINUS' || st === 'KRITIS'
                const isWarn    = st === 'RENDAH'
                return (
                  <tr key={row.material_id} className={isDanger ? 'row-danger' : isWarn ? 'row-warning' : ''}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{row.kode}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{row.name}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>{formatNum(row.received)} {row.unit}</td>
                    <td style={{ textAlign: 'right', color: row.used > row.received ? 'var(--color-text-danger)' : undefined }}>
                      {formatNum(row.used)} {row.unit}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color:
                      row.balance < 0 ? 'var(--color-text-danger)'
                      : row.safety_stock > 0 && row.balance <= row.safety_stock ? 'var(--color-text-warning)'
                      : row.balance === 0 ? 'var(--color-text-secondary)'
                      : 'var(--color-text-success)'
                    }}>
                      {formatNum(row.balance)} {row.unit}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                      {row.safety_stock > 0 ? `${formatNum(row.safety_stock)} ${row.unit}` : '—'}
                    </td>
                    <td>
                      <span className={`chip ${statusChip[st]} ${isDanger ? 'blink' : ''}`}>{st}</span>
                    </td>
                    <td>
                      {/* Progress bar with safety stock line */}
                      <div style={{ position: 'relative', height: 8, background: 'var(--color-background-tertiary)', borderRadius: 4, overflow: 'visible' }}>
                        <div style={{
                          height: '100%', width: `${usedPct}%`, borderRadius: 4, transition: 'width 0.3s',
                          background: isDanger ? 'var(--color-accent-danger)' : isWarn ? 'var(--color-accent-warning)' : 'var(--color-accent-primary)',
                        }} />
                        {/* Safety stock marker */}
                        {safetyPct > 0 && (
                          <div style={{
                            position: 'absolute', top: -2, left: `${safetyPct}%`,
                            width: 2, height: 12, background: '#f59e0b', borderRadius: 1,
                          }} title={`Safety: ${formatNum(row.safety_stock)} ${row.unit}`} />
                        )}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', marginTop: '3px' }}>
                        {usedPct.toFixed(0)}% terpakai
                        {row.safety_stock > 0 && (
                          <span style={{ color: '#f59e0b', marginLeft: 4 }}>│ safety {safetyPct.toFixed(0)}%</span>
                        )}
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
