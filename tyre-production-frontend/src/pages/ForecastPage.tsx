import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getEstimates } from '@/api/ml'
import type { EstimateItem } from '@/types'

function formatNum(n: number | null, digits = 2): string {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

const STATUS_LABEL: Record<string, string> = {
  aman:       'Aman',
  perlu_pesan: 'Perlu Pesan',
}

function StatusChip({ status }: { status: EstimateItem['status'] }) {
  const cls = status === 'perlu_pesan' ? 'chip chip-danger' : 'chip chip-success'
  return <span className={cls}>{STATUS_LABEL[status] ?? status}</span>
}

export function ForecastPage() {
  const [horizon, setHorizon] = useState(7)
  const [search, setSearch]   = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['estimates', horizon],
    queryFn: () => getEstimates(horizon),
    staleTime: 60_000,
  })

  const estimates = data?.estimates ?? []
  const filtered  = estimates.filter(e =>
    e.kode.toLowerCase().includes(search.toLowerCase()) ||
    e.name.toLowerCase().includes(search.toLowerCase())
  )

  const perluPesan = estimates.filter(e => e.status === 'perlu_pesan')
  const pctAlert   = estimates.length > 0 ? (perluPesan.length / estimates.length) * 100 : 0

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Estimasi Kebutuhan Material</h2>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>
          Perkiraan pemakaian berbasis rata-rata pemakaian harian historis (ADC). Bukan prediksi ML — digunakan untuk bantu perencanaan pengadaan.
        </p>
      </div>

      {/* Info formula */}
      <div className="card" style={{ padding: '10px 14px', marginBottom: '14px', background: 'var(--color-background-info)', border: '1px solid var(--color-border-info)' }}>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
          <strong>ADC Berbobot</strong> = 0.5 × rata7hari + 0.3 × rata14hari + 0.2 × rata30hari &nbsp;·&nbsp;
          <strong>Status "Perlu Pesan"</strong> jika sisa hari ≤ {data?.horizon ?? 7} atau proyeksi stok &lt; safety stock
        </div>
      </div>

      {/* Alert banner */}
      {!isLoading && perluPesan.length > 0 && (
        <div className="alert alert-danger" style={{ marginBottom: '14px' }}>
          ⚠️ <strong>{perluPesan.length} material perlu dipesan</strong>
          {' '}({pctAlert.toFixed(0)}% dari total) —{' '}
          {perluPesan.slice(0, 4).map(e => e.kode).join(', ')}
          {perluPesan.length > 4 && `, +${perluPesan.length - 4} lainnya`}
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '14px' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Horizon Proyeksi</label>
          <div className="filter-pills">
            {[7, 14, 30].map(h => (
              <button key={h} className={`filter-pill ${horizon === h ? 'active' : ''}`} onClick={() => setHorizon(h)}>
                {h} hari
              </button>
            ))}
          </div>
        </div>
        <div className="form-group" style={{ margin: 0, flex: 1, minWidth: '200px' }}>
          <label className="form-label">Cari Material</label>
          <input
            className="form-input"
            placeholder="Kode atau nama..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Summary metrics */}
      {!isLoading && (
        <div className="metrics-grid" style={{ marginBottom: '14px' }}>
          {[
            { label: 'Total Material',  value: estimates.length,                                        color: undefined },
            { label: 'Perlu Pesan',     value: perluPesan.length,                                      color: perluPesan.length > 0 ? 'var(--color-text-danger)' : undefined },
            { label: 'Stok Aman',       value: estimates.filter(e => e.status === 'aman').length,       color: 'var(--color-text-success)' },
            { label: 'Tanpa Riwayat',   value: estimates.filter(e => e.adc === 0).length,              color: 'var(--color-text-secondary)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="metric-card">
              <div className="metric-value" style={{ color }}>{value}</div>
              <div className="metric-label">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabel */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>Menghitung estimasi...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Material</th>
                <th style={{ textAlign: 'right' }}>Stok Saat Ini</th>
                <th style={{ textAlign: 'right' }}>ADC / Hari</th>
                <th style={{ textAlign: 'right' }}>Perkiraan {horizon}h</th>
                <th style={{ textAlign: 'right' }}>Proyeksi Stok</th>
                <th style={{ textAlign: 'right' }}>Sisa Hari</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Saran Pesan</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '24px' }}>
                    {search ? 'Tidak ada material yang cocok.' : 'Belum ada data pemakaian.'}
                  </td>
                </tr>
              ) : (
                filtered.map(e => {
                  const isCritical   = e.status === 'perlu_pesan'
                  const projNegative = e.projected_stock < 0
                  return (
                    <tr key={e.material_id} className={isCritical ? 'row-danger' : ''}>
                      <td>
                        <span style={{ fontWeight: 600 }}>{e.kode}</span>
                        <span style={{ color: 'var(--color-text-secondary)', fontSize: 11, marginLeft: 6 }}>{e.name}</span>
                        <span style={{ marginLeft: 6 }}><span className="chip chip-neutral" style={{ fontSize: 10 }}>{e.unit}</span></span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatNum(e.current_stock)}</td>
                      <td style={{ textAlign: 'right' }}>
                        {e.adc > 0 ? (
                          <span title={`7h: ${e.adc_7} · 14h: ${e.adc_14} · 30h: ${e.adc_30}`}>
                            {formatNum(e.adc)}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>Belum ada data</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--color-text-secondary)' }}>
                        {e.adc > 0 ? formatNum(e.predicted_total) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: projNegative ? 'var(--color-text-danger)' : undefined }}>
                        {e.adc > 0 ? formatNum(e.projected_stock) : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {e.days_remaining !== null ? (
                          <span style={{ fontWeight: 700, color: e.days_remaining <= 7 ? 'var(--color-text-danger)' : e.days_remaining <= 14 ? 'var(--color-text-warning)' : undefined }}>
                            {formatNum(e.days_remaining, 1)} hari
                          </span>
                        ) : '—'}
                      </td>
                      <td><StatusChip status={e.status} /></td>
                      <td style={{ textAlign: 'right', fontWeight: e.suggested_order > 0 ? 700 : 400, color: e.suggested_order > 0 ? 'var(--color-text-danger)' : 'var(--color-text-secondary)' }}>
                        {e.suggested_order > 0 ? formatNum(e.suggested_order) : '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 10 }}>
          * ADC = Average Daily Consumption · Horizon {horizon} hari · Lead time 7 hari · Safety days 7 hari
        </div>
      )}
    </div>
  )
}
