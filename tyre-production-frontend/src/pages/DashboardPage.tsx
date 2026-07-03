import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, PackageX, ClipboardX } from 'lucide-react'
import { getMaterials } from '@/api/spec'
import { getOrders, getProdStock, getPurchasingAlerts } from '@/api/production'
import { useAuth, getUIGroup } from '@/context/AuthContext'
import type { PurchasingAlerts, ProductionOrder } from '@/types'

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

// ── Purchasing Alert Banner ────────────────────────────────────

function PurchasingAlertBanner({ alerts, activeOrders }: { alerts: PurchasingAlerts; activeOrders: ProductionOrder[] }) {
  const critWarehouse  = alerts.low_warehouse_stock.filter(m => m.level === 'critical')
  const lowWarehouse   = alerts.low_warehouse_stock.filter(m => m.level === 'low')
  const critProd       = alerts.low_prod_stock.filter(m => m.level === 'critical')
  const lowProd        = alerts.low_prod_stock.filter(m => m.level === 'low')
  const needNewOrder   = alerts.active_orders_count <= 1

  const hasAny = critWarehouse.length > 0 || lowWarehouse.length > 0 ||
                 critProd.length > 0 || lowProd.length > 0 || needNewOrder

  if (!hasAny) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
      {/* Critical warehouse stock */}
      {critWarehouse.length > 0 && (
        <div className="alert alert-danger">
          <PackageX size={15} />
          <div>
            <strong>Stok Gudang Kritis!</strong> {critWarehouse.length} material di bawah 50% safety stock — segera lakukan pemesanan.
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
              {critWarehouse.map(m => (
                <span key={m.id} className="chip chip-danger" style={{ fontSize: '11px' }}>
                  {m.kode} · {m.name} — {m.stock?.toFixed(1)} / {m.safety_stock} {m.unit} ({m.pct?.toFixed(0)}%)
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Low warehouse stock */}
      {lowWarehouse.length > 0 && (
        <div className="alert alert-warning">
          <AlertTriangle size={15} />
          <div>
            <strong>Stok Gudang Rendah.</strong> {lowWarehouse.length} material mendekati safety stock.
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
              {lowWarehouse.map(m => (
                <span key={m.id} className="chip chip-warning" style={{ fontSize: '11px' }}>
                  {m.kode} · {m.name} — {m.stock?.toFixed(1)} / {m.safety_stock} {m.unit} ({m.pct?.toFixed(0)}%)
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Critical production stock — no active order */}
      {critProd.length > 0 && activeOrders.length === 0 && (
        <div className="alert alert-danger">
          <PackageX size={15} />
          <div>
            <strong>Stok Produksi Kritis!</strong>{' '}
            {critProd.length} material habis atau minus, namun{' '}
            <strong>tidak ada izin produksi aktif</strong>.{' '}
            Buat izin produksi baru sebelum mengirim material.
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
              {critProd.map(m => (
                <span key={m.id} className="chip chip-danger" style={{ fontSize: '11px' }}>
                  {m.kode} · {m.name} — sisa {m.balance?.toFixed(1)} {m.unit}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Critical production stock — with active orders */}
      {critProd.length > 0 && activeOrders.length > 0 && (
        <div className="alert alert-danger">
          <PackageX size={15} />
          <div>
            <strong>Stok Produksi Kritis!</strong>{' '}
            {critProd.length} material habis atau minus. Segera kirimkan untuk izin aktif:
            {activeOrders.map(o => (
              <span key={o.id} className="chip chip-info" style={{ fontSize: '11px', marginLeft: '4px' }}>
                {o.number}
              </span>
            ))}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
              {critProd.map(m => (
                <span key={m.id} className="chip chip-danger" style={{ fontSize: '11px' }}>
                  {m.kode} · {m.name} — sisa {m.balance?.toFixed(1)} {m.unit}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Low production stock */}
      {lowProd.length > 0 && critProd.length === 0 && (
        <div className="alert alert-warning">
          <AlertTriangle size={15} />
          <div>
            <strong>Stok Produksi Hampir Habis.</strong> {lowProd.length} material mendekati safety stock di lantai produksi.
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
              {lowProd.map(m => (
                <span key={m.id} className="chip chip-warning" style={{ fontSize: '11px' }}>
                  {m.kode} · {m.name} — sisa {m.balance?.toFixed(1)} {m.unit}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Few active orders */}
      {needNewOrder && (
        <div className="alert alert-warning">
          <ClipboardX size={15} />
          <div>
            <strong>Izin Produksi Hampir Habis!</strong>{' '}
            Hanya {alerts.active_orders_count} izin aktif tersisa
            {alerts.draft_orders_count > 0 && ` (${alerts.draft_orders_count} masih Draft)`}.{' '}
            Buat izin produksi baru agar proses tidak terhenti.
          </div>
        </div>
      )}
    </div>
  )
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
  const { data: purchasingAlerts } = useQuery({
    queryKey: ['purchasing-alerts'],
    queryFn: getPurchasingAlerts,
    refetchInterval: 60000,
  })

  const materials   = matData?.results ?? []
  const orders      = ordersData?.results ?? []
  const activeOrders  = orders.filter(o => ['MAT_SENT', 'IN_PROGRESS'].includes(o.status))
  const pendingOrders = orders.filter(o => ['DRAFT', 'CONFIRMED'].includes(o.status))
  const doneOrders    = orders.filter(o => o.status === 'DONE')

  // Use purchasingAlerts as single source of truth so metrics match the alert banner
  const critProd = purchasingAlerts?.low_prod_stock.filter(m => m.level === 'critical') ?? []
  const lowProd  = purchasingAlerts?.low_prod_stock.filter(m => m.level === 'low') ?? []
  const aktifCount = purchasingAlerts?.active_orders_count ?? activeOrders.length

  return (
    <>
      {purchasingAlerts && <PurchasingAlertBanner alerts={purchasingAlerts} activeOrders={activeOrders} />}

      <div className="metrics-grid" style={{ marginBottom: '16px' }}>
        {[
          { label: 'Total Izin',   value: ordersData?.count ?? '—' },
          { label: 'Aktif',        value: aktifCount,  color: aktifCount > 0 ? 'var(--color-text-warning)' : 'var(--color-text-secondary)' },
          { label: 'Pending',      value: pendingOrders.length, color: pendingOrders.length > 0 ? 'var(--color-text-info)' : undefined },
          { label: 'Stok Kritis',  value: critProd.length, color: critProd.length > 0 ? 'var(--color-text-danger)' : 'var(--color-text-secondary)' },
          { label: 'Stok Rendah',  value: lowProd.length, color: lowProd.length > 0 ? 'var(--color-text-warning)' : undefined },
          { label: 'Selesai',      value: doneOrders.length, color: 'var(--color-text-success)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="metric-card">
            <div className="metric-value" style={{ color }}>{value}</div>
            <div className="metric-label">{label}</div>
          </div>
        ))}
      </div>

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
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, fontSize: '13px' }}>Status Stok Gudang</span>
            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{materials.length} material</span>
          </div>
          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {[...materials]
              .sort((a, b) => {
                const pctA = parseFloat(a.safety_stock) > 0 ? parseFloat(a.stock) / parseFloat(a.safety_stock) : 1
                const pctB = parseFloat(b.safety_stock) > 0 ? parseFloat(b.stock) / parseFloat(b.safety_stock) : 1
                return pctA - pctB
              })
              .map(m => {
                const stock  = parseFloat(m.stock)
                const safety = parseFloat(m.safety_stock)
                const pct    = safety > 0 ? Math.min((stock / safety) * 100, 100) : 100
                const status = stock >= safety ? 'AMAN' : stock >= safety * 0.5 ? 'RENDAH' : 'KRITIS'
                const barColor = status === 'AMAN' ? 'var(--color-text-success)' : status === 'RENDAH' ? 'var(--color-text-warning)' : 'var(--color-text-danger)'
                const bgColor  = status === 'AMAN' ? '#dcfce7' : status === 'RENDAH' ? '#fef9c3' : '#fee2e2'
                return (
                  <div key={m.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--color-border-tertiary)', backgroundColor: status === 'KRITIS' ? 'rgba(239,68,68,0.04)' : undefined }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '1px' }}>{m.kode} · {m.category}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px', flexShrink: 0 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 600, fontSize: '13px', color: stock <= 0 ? 'var(--color-text-danger)' : undefined }}>
                            {formatNum(stock, 0)} <span style={{ fontWeight: 400, fontSize: '11px', color: 'var(--color-text-secondary)' }}>{m.unit}</span>
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>/ {formatNum(safety, 0)}</div>
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', background: bgColor, color: barColor, letterSpacing: '0.4px' }}>
                          {status}
                        </span>
                      </div>
                    </div>
                    <div style={{ height: '4px', borderRadius: '999px', background: 'var(--color-border-tertiary)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.max(pct, stock > 0 ? 2 : 0)}%`, background: barColor, borderRadius: '999px', transition: 'width 0.3s' }} />
                    </div>
                  </div>
                )
              })}
          </div>
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
