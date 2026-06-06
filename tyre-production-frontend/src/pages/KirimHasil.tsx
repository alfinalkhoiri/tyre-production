import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, ChevronDown, ChevronRight, Package } from 'lucide-react'
import {
  getOrders, addDelivery, getDeliveries, getOrderProgress, getDailyUsages,
} from '@/api/production'
import type { ProductionOrder, TyreProgress } from '@/types'

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function ProgressBar({ value, max, color = 'var(--color-accent-primary)' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div style={{ height: 6, background: 'var(--color-background-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.3s' }} />
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card" style={{ width: 520, maxWidth: '95vw', maxHeight: '88vh', overflow: 'auto', padding: 22, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{title}</h3>
          <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }} onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function DeliveryModal({ order, progress, onDone }: {
  order: ProductionOrder
  progress: TyreProgress[]
  onDone: (newStatus: string) => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [qtyMap, setQtyMap] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: orderDetail } = useQuery({
    queryKey: ['order-detail', order.id],
    queryFn: () => import('@/api/production').then(m => m.getOrder(order.id)),
  })

  const { data: usageData, isSuccess: usageLoaded } = useQuery({
    queryKey: ['daily-usages-for-order', String(order.id)],
    queryFn: () => getDailyUsages({ order: String(order.id), page_size: '500' }),
  })

  const usedMap = useMemo(() => {
    const map: Record<number, number> = {}
    for (const u of usageData?.results ?? []) {
      for (const e of u.entries ?? []) {
        map[e.material] = (map[e.material] ?? 0) + parseFloat(e.qty)
      }
    }
    return map
  }, [usageData])

  // Only Tread & Carcass (Nylon) materials drive the bottleneck calculation
  const BOTTLENECK_CATS = ['Tread', 'Carcass']

  // Tyre output estimate per spec using Tread + Nylon (Carcass) as bottleneck
  // Net estimate = total from usage − already delivered (resets to 0 after delivery)
  const estimateMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const item of orderDetail?.items ?? []) {
      const key = `${item.tyre_spec_detail.size}|${item.tyre_spec_detail.model}|${item.tyre_spec_detail.variant}`
      const coverages: number[] = []
      for (const bom of item.tyre_spec_detail?.bom_items ?? []) {
        const mat = bom.material_detail
        if (!BOTTLENECK_CATS.includes(mat.category)) continue
        const needed = (mat.roll_length && bom.unit === 'm')
          ? parseFloat(bom.qty) * item.qty_plan / parseFloat(mat.roll_length)
          : parseFloat(bom.qty) * item.qty_plan
        const used = usedMap[mat.id] ?? 0
        if (used > 0 && needed > 0) coverages.push(used / needed)
      }
      if (coverages.length) {
        const totalFromUsage = Math.floor(Math.min(...coverages) * item.qty_plan)
        const alreadyDelivered = progress.find(p => `${p.size}|${p.model}|${p.variant}` === key)?.delivered ?? 0
        map[key] = Math.max(0, totalFromUsage - alreadyDelivered)
      }
    }
    return map
  }, [orderDetail, usedMap, progress])

  const hasUsage = usageLoaded && Object.keys(usedMap).length > 0

  // Auto-fill qty inputs from estimates when data loads (only if user hasn't typed yet)
  useEffect(() => {
    if (!Object.keys(estimateMap).length) return
    if (Object.keys(qtyMap).length) return
    const filled: Record<string, string> = {}
    for (const p of progress) {
      const key = `${p.size}|${p.model}|${p.variant}`
      const est = estimateMap[key]
      if (est && est > 0) {
        const sisa = Math.max(0, p.planned - p.delivered)
        if (sisa > 0) filled[key] = String(Math.min(est, sisa))
      }
    }
    if (Object.keys(filled).length) setQtyMap(filled)
  }, [estimateMap])

  const save = async () => {
    const specIdMap: Record<string, number> = {}
    for (const item of orderDetail?.items ?? []) {
      specIdMap[`${item.tyre_spec_detail.size}|${item.tyre_spec_detail.model}|${item.tyre_spec_detail.variant}`] = item.tyre_spec
    }
    const entries = progress
      .map(p => {
        const key = `${p.size}|${p.model}|${p.variant}`
        return { tyre_spec: specIdMap[key], qty_actual: parseInt(qtyMap[key] || '0') }
      })
      .filter(e => e.tyre_spec && e.qty_actual > 0)

    if (!entries.length) { setError('Isi minimal 1 qty hasil'); return }

    // Validasi: qty tidak boleh melebihi hasil konversi
    const exceeded = progress.filter(p => {
      const key = `${p.size}|${p.model}|${p.variant}`
      const qty = parseInt(qtyMap[key] || '0')
      const est = estimateMap[key]
      return qty > 0 && est !== undefined && qty > est
    })
    if (exceeded.length) {
      setError(`Qty melebihi hasil konversi: ${exceeded.map(p => `${p.size} (maks ${estimateMap[`${p.size}|${p.model}|${p.variant}`]})`).join(', ')}`)
      return
    }

    setSaving(true); setError('')
    try {
      const res = await addDelivery(order.id, { date, note, entries })
      onDone(res.order_status)
    } catch { setError('Gagal menyimpan') }
    finally { setSaving(false) }
  }

  return (
    <Modal title={`Kirim Hasil Tyre — ${order.number}`} onClose={() => onDone(order.status)}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div className="form-group">
          <label className="form-label">Tanggal Kirim</label>
          <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Catatan</label>
          <input className="form-input" value={note} onChange={e => setNote(e.target.value)} placeholder="Opsional" />
        </div>
      </div>
      {usageLoaded && !hasUsage ? (
        <div className="alert alert-danger" style={{ marginBottom: 12, fontSize: 12 }}>
          ⚠️ <strong>Belum ada pemakaian material tercatat.</strong> Input pemakaian harian terlebih dahulu sebelum mengirim hasil tyre.
        </div>
      ) : hasUsage ? (
        <div className="alert alert-info" style={{ marginBottom: 12, fontSize: 11 }}>
          📊 Qty terisi dari konversi Tread &amp; Nylon (bottleneck). Bisa dikirim bertahap — sesuaikan sebelum submit.
        </div>
      ) : null}
      <table className="tbl" style={{ marginBottom: 12 }}>
        <thead>
          <tr>
            <th>Tyre</th>
            <th style={{ textAlign: 'right' }}>Target</th>
            <th style={{ textAlign: 'right' }}>Sisa</th>
            <th style={{ textAlign: 'right', color: 'var(--color-text-info)' }}>Konversi</th>
            <th style={{ width: 100 }}>Qty Kirim</th>
          </tr>
        </thead>
        <tbody>
          {progress.map(p => {
            const key = `${p.size}|${p.model}|${p.variant}`
            const sisa = Math.max(0, p.planned - p.delivered)
            const est = estimateMap[key]
            const inputQty = parseInt(qtyMap[key] || '0')
            const overConversion = est !== undefined && inputQty > est
            return (
              <tr key={key} style={{ background: sisa === 0 ? 'var(--color-background-success)' : overConversion ? 'var(--color-background-danger)' : undefined }}>
                <td>
                  <strong>{p.size}</strong>
                  <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginLeft: 4 }}>{p.model}</span>
                </td>
                <td style={{ textAlign: 'right' }}>{p.planned}</td>
                <td style={{ textAlign: 'right', color: sisa > 0 ? 'var(--color-text-warning)' : 'var(--color-text-success)', fontWeight: 600 }}>{sisa}</td>
                <td style={{ textAlign: 'right', color: 'var(--color-text-info)', fontWeight: 600 }}>
                  {est !== undefined ? est : <span style={{ color: 'var(--color-text-secondary)' }}>—</span>}
                </td>
                <td>
                  <input className="form-input" type="number" min="0" style={{ width: 90, borderColor: overConversion ? 'var(--color-accent-danger)' : undefined }}
                    value={qtyMap[key] ?? ''} placeholder="0"
                    disabled={sisa === 0}
                    onChange={e => setQtyMap(m => ({ ...m, [key]: e.target.value }))} />
                  {overConversion && (
                    <div style={{ fontSize: 10, color: 'var(--color-text-danger)', marginTop: 2 }}>maks {est}</div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {error && <div className="alert alert-danger" style={{ marginBottom: 10, fontSize: 12 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-p btn-sm"
          onClick={save}
          disabled={saving || !hasUsage}
          title={!hasUsage ? 'Input pemakaian material terlebih dahulu' : undefined}
        >
          {saving ? 'Menyimpan...' : 'Kirim Hasil'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => onDone(order.status)}>Batal</button>
      </div>
    </Modal>
  )
}

function OrderCard({ order, onRefresh }: { order: ProductionOrder; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const qc = useQueryClient()

  const { data: progress } = useQuery({
    queryKey: ['order-progress-kirim', order.id],
    queryFn: () => getOrderProgress(order.id),
    enabled: expanded,
  })

  const { data: deliveries = [], refetch: refetchDeliveries } = useQuery({
    queryKey: ['deliveries-kirim', order.id],
    queryFn: () => getDeliveries(order.id),
    enabled: expanded,
  })

  const tyreProgress = progress?.tyre_progress ?? []
  const allDone = tyreProgress.length > 0 && tyreProgress.every(p => p.delivered >= p.planned)
  const items = order.items ?? []

  const handleDeliveryDone = (newStatus: string) => {
    setShowModal(false)
    refetchDeliveries()
    qc.invalidateQueries({ queryKey: ['order-progress-kirim', order.id] })
    qc.invalidateQueries({ queryKey: ['orders-kirim'] })
    if (newStatus !== order.status) onRefresh()
  }

  const statusColors: Record<string, string> = {
    MAT_SENT: 'chip-info',
    IN_PROGRESS: 'chip-warning',
    RESULT_SENT: 'chip-success',
  }
  const statusLabels: Record<string, string> = {
    MAT_SENT: 'Siap Produksi',
    IN_PROGRESS: 'Berjalan',
    RESULT_SENT: 'Hasil Dikirim',
  }

  return (
    <div className="card" style={{ padding: '14px 16px', marginBottom: '8px' }}>
      <div className="collapsible-header" onClick={() => setExpanded(e => !e)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
          <span style={{ fontWeight: 700, fontSize: '14px' }}>{order.number}</span>
          <span className={`chip ${statusColors[order.status] ?? 'chip-neutral'}`} style={{ fontSize: 11 }}>
            {statusLabels[order.status] ?? order.status}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            {formatDate(order.date)} · {order.shift_display}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {order.status === 'IN_PROGRESS' && !allDone && (
            <button className="btn btn-b btn-sm" onClick={e => { e.stopPropagation(); setExpanded(true); setShowModal(true) }}>
              <Plus size={11} /> Kirim Hasil
            </button>
          )}
          {expanded ? <ChevronDown size={15} color="#9ca3af" /> : <ChevronRight size={15} color="#9ca3af" />}
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--color-border-tertiary)', paddingTop: 12 }}>
          {/* Target */}
          {items.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>Target:</span>
              {items.map(item => (
                <span key={item.id} className="chip chip-info" style={{ fontSize: 11 }}>
                  {item.tyre_spec_detail.size} × {item.qty_plan}
                </span>
              ))}
            </div>
          )}

          {/* Tyre progress */}
          {tyreProgress.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                <Package size={12} /> Progress Hasil Tyre
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tyreProgress.map(p => {
                  const done = p.delivered >= p.planned
                  return (
                    <div key={`${p.size}|${p.model}`}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                        <span style={{ fontWeight: 600 }}>{p.size} <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>{p.model}</span></span>
                        <span style={{ color: done ? 'var(--color-text-success)' : 'var(--color-text-warning)', fontWeight: 700 }}>
                          {p.delivered} / {p.planned} {done ? '✓' : ''}
                        </span>
                      </div>
                      <ProgressBar value={p.delivered} max={p.planned} color={done ? 'var(--color-accent-success)' : 'var(--color-accent-primary)'} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Delivery history */}
          {deliveries.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>Riwayat Kirim</div>
              {deliveries.map(d => (
                <div key={d.id} style={{ border: '1px solid var(--color-border-success)', background: 'var(--color-background-success)', borderRadius: 6, padding: '7px 12px', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{formatDate(d.date)}</span>
                  {d.note && <span style={{ color: 'var(--color-text-secondary)' }}> — {d.note}</span>}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                    {d.entries.map(e => (
                      <span key={e.id} className="chip chip-success" style={{ fontSize: 10 }}>
                        {e.tyre_spec_detail.size} +{e.qty_actual} ban
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {allDone && (
            <div className="alert alert-success" style={{ fontSize: 12 }}>
              Semua hasil tyre telah dikirim ke gudang. Menunggu konfirmasi gudang.
            </div>
          )}
        </div>
      )}

      {showModal && progress && (
        <DeliveryModal order={order} progress={tyreProgress} onDone={handleDeliveryDone} />
      )}
    </div>
  )
}

export function KirimHasil() {
  const qc = useQueryClient()

  const { data: ordersData, isLoading, refetch } = useQuery({
    queryKey: ['orders-kirim'],
    queryFn: () => getOrders({ page_size: '100' }),
  })

  const orders = (ordersData?.results ?? []).filter(o =>
    ['MAT_SENT', 'IN_PROGRESS', 'RESULT_SENT'].includes(o.status)
  )

  const countBy = (s: string) => orders.filter(o => o.status === s).length

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 2px' }}>Kirim Hasil Produksi</h1>
        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
          Mulai produksi dan kirim hasil tyre ke gudang
        </p>
      </div>

      <div className="metrics-grid" style={{ marginBottom: '14px' }}>
        {[
          { label: 'Siap Produksi', value: countBy('MAT_SENT'), color: 'var(--color-text-info)' },
          { label: 'Berjalan', value: countBy('IN_PROGRESS'), color: 'var(--color-text-warning)' },
          { label: 'Hasil Dikirim', value: countBy('RESULT_SENT'), color: 'var(--color-text-success)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="metric-card">
            <div className="metric-value" style={{ color }}>{value}</div>
            <div className="metric-label">{label}</div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>Memuat...</div>
      ) : orders.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🏭</div>
          <p style={{ margin: 0, fontWeight: 600 }}>Tidak ada order aktif</p>
          <p style={{ margin: '4px 0 0', fontSize: '12px' }}>Tunggu gudang mengirim material</p>
        </div>
      ) : orders.map(order => (
        <OrderCard key={order.id} order={order} onRefresh={() => qc.invalidateQueries({ queryKey: ['orders-kirim'] })} />
      ))}
    </div>
  )
}
