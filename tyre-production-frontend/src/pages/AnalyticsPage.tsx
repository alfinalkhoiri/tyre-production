import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAnalytics } from '@/api/production'
import type { AnalyticsOrderSummary } from '@/types'

function formatNum(n: number, digits = 0) {
  return n.toLocaleString('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

// ── Bar chart berbasis CSS ────────────────────────────────────────────────────
function BarChart({
  data, valueKey, labelKey, color = 'var(--color-accent-primary)', unit = '',
}: {
  data: Record<string, number | string>[]
  valueKey: string
  labelKey: string
  color?: string
  unit?: string
}) {
  const max = Math.max(...data.map(d => Number(d[valueKey])), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {data.map((d, i) => {
        const val = Number(d[valueKey])
        const pct = (val / max) * 100
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 72, fontSize: 11, color: 'var(--color-text-secondary)', textAlign: 'right', flexShrink: 0 }}>
              {String(d[labelKey])}
            </div>
            <div style={{ flex: 1, background: 'var(--color-background-secondary)', borderRadius: 4, height: 22, overflow: 'hidden', position: 'relative' }}>
              <div style={{
                width: `${pct}%`, height: '100%', background: color,
                borderRadius: 4, transition: 'width 0.4s ease',
                minWidth: val > 0 ? 4 : 0,
              }} />
              {val > 0 && (
                <span style={{
                  position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 11, fontWeight: 600, color: pct > 60 ? '#fff' : 'var(--color-text-primary)',
                }}>
                  {formatNum(val)}{unit ? ` ${unit}` : ''}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Komponen kartu section ────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: 'var(--color-text-primary)' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

// ── Status order badge ────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  DRAFT:        'var(--color-text-secondary)',
  CONFIRMED:    'var(--color-accent-info)',
  MAT_SENT:     'var(--color-accent-warning)',
  IN_PROGRESS:  'var(--color-accent-primary)',
  RESULT_SENT:  'var(--color-accent-warning)',
  DONE:         'var(--color-accent-success)',
}

function OrderStatusGrid({ data }: { data: AnalyticsOrderSummary[] }) {
  // Funnel: base = jumlah semua order (count di DRAFT = tertinggi)
  const base = data[0]?.count || 1
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
      {data.map(d => {
        const pct = base > 0 ? Math.round((d.count / base) * 100) : 0
        const hasData = d.count > 0
        return (
          <div
            key={d.status}
            className="metric-card"
            style={{ border: `2px solid ${hasData ? STATUS_COLOR[d.status] : 'var(--color-border-tertiary)'}` }}
          >
            <div className="metric-value" style={{ color: hasData ? STATUS_COLOR[d.status] : 'var(--color-text-secondary)', fontSize: 28 }}>
              {d.count}
            </div>
            <div className="metric-label">{d.label}</div>
            <div style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              {pct}%
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function AnalyticsPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['analytics'],
    queryFn: getAnalytics,
    staleTime: 120_000,
  })

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', color: 'var(--color-text-secondary)' }}>
        Memuat data analitik...
      </div>
    )
  }

  if (isError) {
    return (
      <div className="alert alert-danger" style={{ margin: '20px 0' }}>
        Gagal memuat data analitik: {String((error as { message?: string })?.message ?? error)}
      </div>
    )
  }

  if (!data) return null

  const hasUsage      = data.usage_weekly.some(w => w.total_qty > 0)
  const hasProd       = data.production_monthly.some(m => m.total_tyre > 0)
  const hasTopMat     = data.top_materials.length > 0

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Analitik Produksi</h2>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>
          Ringkasan aktivitas produksi dan pemakaian material.
        </p>
      </div>

      {/* KPI Metrics */}
      <div className="metrics-grid" style={{ marginBottom: '16px' }}>
        {[
          { label: 'Total Izin Produksi', value: data.total_orders,        color: undefined },
          { label: 'Total Ban Diproduksi', value: data.total_tyre_produced, color: 'var(--color-text-success)' },
          { label: 'Izin Selesai',         value: data.order_summary.find(s => s.status === 'DONE')?.count ?? 0,        color: 'var(--color-text-success)' },
          { label: 'Sedang Berjalan',      value: (data.order_summary.find(s => s.status === 'IN_PROGRESS')?.count ?? 0) + (data.order_summary.find(s => s.status === 'MAT_SENT')?.count ?? 0), color: 'var(--color-text-info)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="metric-card">
            <div className="metric-value" style={{ color }}>{formatNum(value)}</div>
            <div className="metric-label">{label}</div>
          </div>
        ))}
      </div>

      {/* Grid 2 kolom */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* Kiri: Pemakaian mingguan */}
        <Section title="📦 Pemakaian Material — 8 Minggu Terakhir">
          {hasUsage ? (
            <BarChart
              data={data.usage_weekly as unknown as Record<string, number | string>[]}
              valueKey="total_qty"
              labelKey="label"
              color="var(--color-accent-primary)"
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-secondary)', fontSize: 12 }}>
              Belum ada data pemakaian material.
            </div>
          )}
        </Section>

        {/* Kanan: Produksi ban bulanan */}
        <Section title="🏭 Produksi Ban — 6 Bulan Terakhir">
          {hasProd ? (
            <BarChart
              data={data.production_monthly as unknown as Record<string, number | string>[]}
              valueKey="total_tyre"
              labelKey="label"
              color="var(--color-accent-success)"
              unit="ban"
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-secondary)', fontSize: 12 }}>
              Belum ada data pengiriman hasil produksi.
            </div>
          )}
        </Section>

        {/* Kiri bawah: Top material */}
        <Section title={`🔝 Top Material Dipakai — ${data.period_days} Hari Terakhir`}>
          {hasTopMat ? (
            <BarChart
              data={data.top_materials as unknown as Record<string, number | string>[]}
              valueKey="total_qty"
              labelKey="kode"
              color="var(--color-accent-warning)"
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-secondary)', fontSize: 12 }}>
              Belum ada data pemakaian 30 hari terakhir.
            </div>
          )}
          {hasTopMat && (
            <div style={{ marginTop: 10 }}>
              <table className="tbl" style={{ fontSize: 12 }}>
                <thead>
                  <tr><th>Kode</th><th>Nama Material</th><th style={{ textAlign: 'right' }}>Total Pakai</th><th>Unit</th></tr>
                </thead>
                <tbody>
                  {data.top_materials.map(m => (
                    <tr key={m.kode}>
                      <td style={{ fontWeight: 600 }}>{m.kode}</td>
                      <td style={{ color: 'var(--color-text-secondary)' }}>{m.name}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatNum(m.total_qty, 2)}</td>
                      <td><span className="chip chip-neutral" style={{ fontSize: 10 }}>{m.unit}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Kanan bawah: Status order */}
        <Section title="📋 Status Izin Produksi">
          <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '0 0 10px' }}>
            Jumlah izin yang sudah melewati setiap tahap produksi
          </p>
          <OrderStatusGrid data={data.order_summary} />
        </Section>

      </div>
    </div>
  )
}
