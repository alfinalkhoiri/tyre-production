import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { getMaterials } from '@/api/spec'
import { getOrders, getProdStock } from '@/api/production'
import { useAuth, getUIGroup } from '@/context/AuthContext'

function formatNum(n: number, d = 2) {
  return n.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function formatDate(s: string) {
  return new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const STATUS_CHIP: Record<string, { cls: string; label: string }> = {
  DRAFT:        { cls: 'chip-neutral',  label: 'Draft' },
  CONFIRMED:    { cls: 'chip-info',     label: 'Dikonfirmasi' },
  MAT_SENT:     { cls: 'chip-warning',  label: 'Siap Produksi' },
  IN_PROGRESS:  { cls: 'chip-warning',  label: 'Berjalan' },
  RESULT_SENT:  { cls: 'chip-info',     label: 'Hasil Dikirim' },
  DONE:         { cls: 'chip-success',  label: 'Selesai' },
}

// ── GUDANG Dashboard ─────────────────────────────────────────

function GudangDashboard() {
  const { data: matData } = useQuery({
    queryKey: ['materials'],
    queryFn: () => getMaterials({ page_size: '100' }),
  })
  const { data: ordersData } = useQuery({
    queryKey: ['orders', 1],
    queryFn: () => getOrders({ page_size: '20' }),
  })

  const materials   = matData?.results ?? []
  const orders      = ordersData?.results ?? []
  const lowStock    = materials.filter(m => parseFloat(m.stock) < parseFloat(m.safety_stock))
  const critStock   = materials.filter(m => parseFloat(m.stock) < parseFloat(m.safety_stock) * 0.5)
  const activeOrders  = orders.filter(o => o.status === 'IN_PROGRESS')
  const pendingOrders = orders.filter(o => ['DRAFT', 'CONFIRMED', 'MAT_SENT'].includes(o.status))
  const doneOrders    = orders.filter(o => o.status === 'DONE')

  return (
    <>
      <div className="metrics-grid" style={{ marginBottom: '16px' }}>
        {[
          { label: 'Total Izin',   value: ordersData?.count ?? '—' },
          { label: 'Aktif',        value: activeOrders.length,  color: 'var(--color-text-warning)' },
          { label: 'Pending',      value: pendingOrders.length, color: 'var(--color-text-info)' },
          { label: 'Stok Kritis',  value: critStock.length, color: critStock.length > 0 ? 'var(--color-text-danger)' : 'var(--color-text-secondary)' },
          { label: 'Stok Rendah',  value: lowStock.length, color: lowStock.length > 0 ? 'var(--color-text-warning)' : undefined },
          { label: 'Selesai',      value: doneOrders.length, color: 'var(--color-text-success)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="metric-card">
            <div className="metric-value" style={{ color }}>{value}</div>
            <div className="metric-label">{label}</div>
          </div>
        ))}
      </div>

      {critStock.length > 0 && (
        <div className="alert alert-danger" style={{ marginBottom: '14px' }}>
          <AlertTriangle size={14} />
          <div>
            <strong>Kekurangan Material!</strong> {critStock.length} material di bawah 50% safety stock:{' '}
            {critStock.map(m => <span key={m.id} className="chip chip-danger" style={{ marginLeft: 4 }}>{m.kode}</span>)}
          </div>
        </div>
      )}
      {lowStock.length > 0 && critStock.length === 0 && (
        <div className="alert alert-warning" style={{ marginBottom: '14px' }}>
          <AlertTriangle size={14} />
          {lowStock.length} material di bawah safety stock: {lowStock.map(m => m.kode).join(', ')}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        {/* Izin terbaru */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border-tertiary)' }}>
            <span style={{ fontWeight: 600, fontSize: '13px' }}>Izin Produksi Terbaru</span>
          </div>
          <table className="tbl">
            <thead><tr><th>No. Izin</th><th>Tanggal</th><th>Status</th></tr></thead>
            <tbody>
              {orders.slice(0, 6).map(o => {
                const sc = STATUS_CHIP[o.status] ?? STATUS_CHIP.DRAFT
                return (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600 }}>{o.number}</td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{formatDate(o.date)}</td>
                    <td><span className={`chip ${sc.cls}`}>{sc.label}</span></td>
                  </tr>
                )
              })}
              {orders.length === 0 && (
                <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>Belum ada izin</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Stok gudang */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border-tertiary)' }}>
            <span style={{ fontWeight: 600, fontSize: '13px' }}>Status Stok Gudang</span>
          </div>
          <table className="tbl">
            <thead><tr><th>Material</th><th style={{ textAlign: 'right' }}>Stok</th><th>Status</th></tr></thead>
            <tbody>
              {materials.slice(0, 8).map(m => {
                const stock  = parseFloat(m.stock)
                const safety = parseFloat(m.safety_stock)
                const status = stock >= safety ? 'AMAN' : stock >= safety * 0.5 ? 'RENDAH' : 'KRITIS'
                const cls    = status === 'AMAN' ? 'chip-success' : status === 'RENDAH' ? 'chip-warning' : 'chip-danger'
                return (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 600 }}>{m.kode}</td>
                    <td style={{ textAlign: 'right', color: stock < 0 ? 'var(--color-text-danger)' : undefined }}>
                      {formatNum(stock, 0)} {m.unit}
                    </td>
                    <td><span className={`chip ${cls}`}>{status}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ── PRODUKSI Dashboard ───────────────────────────────────────

function ProduksiDashboard() {
  const { data: ordersData } = useQuery({
    queryKey: ['orders-dashboard-prod'],
    queryFn: () => getOrders({ page_size: '100' }),
  })
  const { data: prodStock = [], isLoading: stockLoading } = useQuery({
    queryKey: ['prod-stock'],
    queryFn: getProdStock,
    refetchInterval: 30000,
  })

  const orders      = ordersData?.results ?? []
  const activeOrders = orders.filter(o => ['MAT_SENT', 'IN_PROGRESS'].includes(o.status))
  const countBy = (s: string) => orders.filter(o => o.status === s).length

  const minusStock  = prodStock.filter(r => r.balance < 0)
  const habisStock  = prodStock.filter(r => r.balance === 0 && r.received > 0)
  const tersedia    = prodStock.filter(r => r.balance > 0)

  const statusOf = (r: typeof prodStock[0]) => {
    if (r.received === 0) return { label: 'KOSONG', cls: 'chip-neutral' }
    if (r.balance < 0)    return { label: 'MINUS',  cls: 'chip-danger' }
    if (r.balance === 0)  return { label: 'HABIS',  cls: 'chip-neutral' }
    return { label: 'ADA', cls: 'chip-success' }
  }

  return (
    <>
      <div className="metrics-grid" style={{ marginBottom: '16px' }}>
        {[
          { label: 'Siap Produksi', value: countBy('MAT_SENT'),     color: 'var(--color-text-info)' },
          { label: 'Berjalan',      value: countBy('IN_PROGRESS'),  color: 'var(--color-text-warning)' },
          { label: 'Hasil Dikirim', value: countBy('RESULT_SENT'),  color: 'var(--color-text-success)' },
          { label: 'Stok Tersedia', value: tersedia.length,         color: 'var(--color-text-success)' },
          { label: 'Stok Habis',    value: habisStock.length,       color: habisStock.length > 0 ? 'var(--color-text-warning)' : undefined },
          { label: 'Stok Minus',    value: minusStock.length,       color: minusStock.length > 0 ? 'var(--color-text-danger)' : undefined },
        ].map(({ label, value, color }) => (
          <div key={label} className="metric-card">
            <div className="metric-value" style={{ color }}>{value}</div>
            <div className="metric-label">{label}</div>
          </div>
        ))}
      </div>

      {minusStock.length > 0 && (
        <div className="alert alert-danger" style={{ marginBottom: '14px' }}>
          <AlertTriangle size={14} />
          <div>
            <strong>Stok Minus!</strong> Pemakaian melebihi yang diterima:{' '}
            {minusStock.map(r => <span key={r.material_id} className="chip chip-danger" style={{ marginLeft: 4 }}>{r.kode}</span>)}
          </div>
        </div>
      )}
      {habisStock.length > 0 && minusStock.length === 0 && (
        <div className="alert alert-warning" style={{ marginBottom: '14px' }}>
          <AlertTriangle size={14} />
          {habisStock.length} material habis di lini produksi: {habisStock.map(r => r.kode).join(', ')}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        {/* Order aktif */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border-tertiary)' }}>
            <span style={{ fontWeight: 600, fontSize: '13px' }}>Order Aktif</span>
            {activeOrders.length > 0 && (
              <span className="chip chip-warning" style={{ marginLeft: 8, fontSize: 10 }}>{activeOrders.length}</span>
            )}
          </div>
          <table className="tbl">
            <thead><tr><th>No. Izin</th><th>Shift</th><th>Status</th></tr></thead>
            <tbody>
              {activeOrders.length === 0 ? (
                <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>Tidak ada order aktif</td></tr>
              ) : activeOrders.slice(0, 6).map(o => {
                const sc = STATUS_CHIP[o.status] ?? STATUS_CHIP.DRAFT
                return (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600 }}>{o.number}</td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{o.shift_display}</td>
                    <td><span className={`chip ${sc.cls}`}>{sc.label}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Stok produksi */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border-tertiary)' }}>
            <span style={{ fontWeight: 600, fontSize: '13px' }}>Stok di Lini Produksi</span>
            <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginLeft: 6 }}>Diterima − Terpakai</span>
          </div>
          {stockLoading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 12 }}>Memuat...</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Material</th>
                  <th style={{ textAlign: 'right' }}>Sisa</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {prodStock
                  .filter(r => r.received > 0)
                  .sort((a, b) => a.balance - b.balance)
                  .slice(0, 10)
                  .map(r => {
                    const { label, cls } = statusOf(r)
                    return (
                      <tr key={r.material_id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{r.kode}</div>
                          <div style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{r.name}</div>
                        </td>
                        <td style={{
                          textAlign: 'right', fontWeight: 700,
                          color: r.balance < 0 ? 'var(--color-text-danger)' : r.balance === 0 ? 'var(--color-text-secondary)' : 'var(--color-text-success)',
                        }}>
                          {formatNum(r.balance, 0)} {r.unit}
                        </td>
                        <td><span className={`chip ${cls}`}>{label}</span></td>
                      </tr>
                    )
                  })}
                {prodStock.filter(r => r.received > 0).length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                      Belum ada material diterima
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}

// ── Main Dashboard ───────────────────────────────────────────

export function DashboardPage() {
  const { role } = useAuth()
  const uiGroup = getUIGroup(role)

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }}>Dashboard</h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
          Ringkasan sistem produksi ban · {uiGroup === 'GUDANG' ? 'Gudang' : 'Produksi'}
        </p>
      </div>

      {uiGroup === 'PRODUKSI' ? <ProduksiDashboard /> : <GudangDashboard />}
    </div>
  )
}
