import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ChevronDown, ChevronRight, AlertTriangle, Truck, Package, CheckCircle } from 'lucide-react'
import {
  getOrders, createOrder, confirmOrder, completeOrder,
  getShipments, addShipment, getDeliveries, getOrderProgress,
  getRequirements, getOrderYield,
} from '@/api/production'
import { getTyreSpecs } from '@/api/spec'
import { useToast } from '@/context/ToastContext'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/ui/Pagination'
import type {
  ProductionOrder, TyreSpec, MatProgress, TyreProgress,
  OrderStatus, MaterialRequirement, MaterialShipment, OrderYield,
} from '@/types'

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmt(n: number) { return n % 1 === 0 ? String(n) : n.toFixed(2) }

const STATUS_STEPS = ['Dibuat', 'Mat. Dikirim', 'Mat. Diterima', 'Diproduksi', 'Hasil Dikirim', 'Selesai']
function getStepIndex(s: OrderStatus) {
  return { DRAFT: 0, CONFIRMED: 1, MAT_SENT: 2, IN_PROGRESS: 3, RESULT_SENT: 4, DONE: 5 }[s] ?? 0
}

const STATUS_CHIP: Record<string, { cls: string; label: string }> = {
  DRAFT:       { cls: 'chip-neutral',  label: 'Draft' },
  CONFIRMED:   { cls: 'chip-info',     label: 'Dikonfirmasi' },
  MAT_SENT:    { cls: 'chip-warning',  label: 'Mat. Diterima' },
  IN_PROGRESS: { cls: 'chip-warning',  label: 'Diproduksi' },
  RESULT_SENT: { cls: 'chip-info',     label: 'Hasil Dikirim' },
  DONE:        { cls: 'chip-success',  label: 'Selesai' },
}

// ── Shared UI ─────────────────────────────────────────────────────────────────

function StepFlow({ activeIndex }: { activeIndex: number }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {STATUS_STEPS.map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < STATUS_STEPS.length - 1 ? 1 : undefined }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
              background: i < activeIndex ? 'var(--color-accent-success)' : i === activeIndex ? 'var(--color-accent-primary)' : 'var(--color-background-tertiary)',
              color: i <= activeIndex ? '#fff' : 'var(--color-text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700,
            }}>
              {i < activeIndex ? '✓' : i + 1}
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div style={{ flex: 1, height: 2, background: i < activeIndex ? 'var(--color-accent-success)' : 'var(--color-border-primary)', minWidth: 6 }} />
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', marginTop: 3 }}>
        {STATUS_STEPS.map((label, i) => (
          <div key={i} style={{
            flex: i < STATUS_STEPS.length - 1 ? 1 : undefined,
            fontSize: 8, color: i <= activeIndex ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            fontWeight: i === activeIndex ? 700 : 400, minWidth: 22, textAlign: 'center',
          }}>{label}</div>
        ))}
      </div>
    </div>
  )
}

function ProgressBar({ value, max, color = 'var(--color-accent-primary)' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div style={{ position: 'relative', height: 6, background: 'var(--color-background-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.3s' }} />
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card" style={{ width: 540, maxWidth: '95vw', maxHeight: '88vh', overflow: 'auto', padding: 22, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{title}</h3>
          <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }} onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Client-side requirements computation (for create form) ────────────────────

interface ReqRow { name: string; kode: string; unit: string; qty_needed: number }
interface ItemRow { tyre_spec: string; qty_plan: string }

function computeRequirements(items: ItemRow[], tyreSpecs: TyreSpec[]): ReqRow[] {
  const agg: Record<number, ReqRow> = {}
  for (const item of items) {
    const ts = tyreSpecs.find(s => s.id === parseInt(item.tyre_spec))
    if (!ts || !item.qty_plan) continue
    const qty_plan = parseInt(item.qty_plan)
    for (const bom of (ts.bom_items ?? [])) {
      const mat = bom.material_detail
      const rl = mat.roll_length ? parseFloat(mat.roll_length) : null
      let qty: number, unit: string
      if (rl && bom.unit === 'm') {
        qty = Math.ceil(parseFloat(bom.qty) * qty_plan / rl)
        unit = 'ROLL'
      } else {
        qty = parseFloat(bom.qty) * qty_plan
        unit = mat.unit
      }
      if (!agg[mat.id]) agg[mat.id] = { name: mat.name, kode: mat.kode, unit, qty_needed: 0 }
      agg[mat.id].qty_needed += qty
    }
  }
  return Object.values(agg)
}

// ── Material Shipment Section ─────────────────────────────────────────────────

function ShipmentModal({ order, progress, onDone }: {
  order: ProductionOrder
  progress: MatProgress[]
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

  const save = async () => {
    const matIdMap: Record<string, number> = {}
    for (const item of orderDetail?.items ?? []) {
      for (const bom of item.tyre_spec_detail?.bom_items ?? []) {
        matIdMap[bom.material_detail.kode] = bom.material_detail.id
      }
    }
    const entries = progress
      .map(p => ({ material: matIdMap[p.kode], qty: parseFloat(qtyMap[p.kode] || '0') }))
      .filter(e => e.material && e.qty > 0)

    if (!entries.length) { setError('Isi minimal 1 qty material'); return }
    setSaving(true); setError('')
    try {
      const res = await addShipment(order.id, { date, note, entries })
      onDone(res.order_status)
    } catch { setError('Gagal menyimpan pengiriman') }
    finally { setSaving(false) }
  }

  return (
    <Modal title="Kirim Material ke Produksi" onClose={() => onDone(order.status)}>
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
      <table className="tbl" style={{ marginBottom: 12 }}>
        <thead><tr><th>Material</th><th style={{ textAlign: 'right' }}>Sisa Butuh</th><th style={{ width: 110 }}>Qty Kirim</th></tr></thead>
        <tbody>
          {progress.map(p => {
            const sisa = Math.max(0, p.required - p.received)
            return (
              <tr key={p.kode} style={{ background: sisa === 0 ? 'var(--color-background-success)' : undefined }}>
                <td><strong>{p.name}</strong> <span style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{p.kode}</span></td>
                <td style={{ textAlign: 'right', color: sisa > 0 ? 'var(--color-text-warning)' : 'var(--color-text-success)', fontWeight: 600 }}>{fmt(sisa)} {p.unit}</td>
                <td>
                  <input className="form-input" type="number" min="0" step="0.01" style={{ width: 100 }}
                    value={qtyMap[p.kode] ?? ''} placeholder="0"
                    onChange={e => setQtyMap(m => ({ ...m, [p.kode]: e.target.value }))} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {error && <div className="alert alert-danger" style={{ marginBottom: 10, fontSize: 12 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-p btn-sm" onClick={save} disabled={saving}>{saving ? 'Menyimpan...' : 'Kirim Material'}</button>
        <button className="btn btn-ghost btn-sm" onClick={() => onDone(order.status)}>Batal</button>
      </div>
    </Modal>
  )
}

function MaterialShipmentSection({ order, progress, onRefresh }: {
  order: ProductionOrder
  progress: MatProgress[]
  onRefresh: (newStatus?: string) => void
}) {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)

  const { data: shipments = [], refetch: refetchShipments } = useQuery({
    queryKey: ['shipments', order.id],
    queryFn: () => getShipments(order.id),
  })

  const handleShipmentDone = (newStatus: string) => {
    setShowModal(false)
    refetchShipments()
    qc.invalidateQueries({ queryKey: ['order-progress', order.id] })
    if (newStatus !== order.status) onRefresh(newStatus)
  }

  const allReceived = progress.every(p => p.received >= p.required)

  return (
    <div style={{ marginTop: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Truck size={12} /> Pengiriman Material
        </div>
        {['CONFIRMED', 'MAT_SENT', 'IN_PROGRESS'].includes(order.status) && !allReceived && (
          <button className="btn btn-b btn-sm" onClick={() => setShowModal(true)}>
            <Plus size={11} /> Kirim Material
          </button>
        )}
      </div>

      {/* Progress per material */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {progress.map(p => {
          const done = p.received >= p.required
          return (
            <div key={p.kode}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                <span style={{ fontWeight: 600 }}>{p.name} <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)', fontSize: 10 }}>{p.kode}</span></span>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Kirim: {fmt(p.shipped)}</span>
                  <span style={{ color: done ? 'var(--color-text-success)' : 'var(--color-text-warning)', fontWeight: 700 }}>
                    Terima: {fmt(p.received)} / {fmt(p.required)} {p.unit} {done ? '✓' : ''}
                  </span>
                </span>
              </div>
              <ProgressBar value={p.received} max={p.required} color={done ? 'var(--color-accent-success)' : 'var(--color-accent-warning)'} />
            </div>
          )
        })}
      </div>

      {/* Shipment list */}
      {shipments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Riwayat Pengiriman</div>
          {shipments.map((s: MaterialShipment) => (
            <div key={s.id} style={{
              border: `1px solid ${s.confirmed ? 'var(--color-border-success)' : 'var(--color-border-primary)'}`,
              borderRadius: 6, padding: '8px 12px', fontSize: 12,
              background: s.confirmed ? 'var(--color-background-success)' : undefined,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>
                  {formatDate(s.date)}
                  {s.note && <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}> — {s.note}</span>}
                </span>
                {s.confirmed
                  ? <span className="chip chip-success" style={{ fontSize: 10 }}><CheckCircle size={10} style={{ marginRight: 3 }} />Diterima Produksi</span>
                  : <span className="chip chip-warning" style={{ fontSize: 10 }}>Menunggu Konfirmasi</span>
                }
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {s.entries.map(e => (
                  <span key={e.id} className="chip chip-neutral" style={{ fontSize: 10 }}>
                    {e.material_detail.name}: +{e.qty} {e.material_detail.unit}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ShipmentModal order={order} progress={progress} onDone={handleShipmentDone} />
      )}
    </div>
  )
}

// ── Tyre Delivery Section (read-only for GUDANG) ─────────────────────────────

function TyreDeliverySection({ order, progress }: {
  order: ProductionOrder
  progress: TyreProgress[]
}) {
  const { data: deliveries = [] } = useQuery({
    queryKey: ['deliveries', order.id],
    queryFn: () => getDeliveries(order.id),
  })

  const allDone = progress.every(p => p.delivered >= p.planned)

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Package size={12} /> Pengiriman Hasil Tyre
        </div>
        {/* Kirim Hasil dilakukan oleh PRODUKSI di halaman Kirim Hasil */}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {progress.map(p => {
          const key = `${p.size}|${p.model}|${p.variant}`
          const done = p.delivered >= p.planned
          return (
            <div key={key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                <span style={{ fontWeight: 600 }}>{p.size} <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>{p.model} {p.variant}</span></span>
                <span style={{ color: done ? 'var(--color-text-success)' : 'var(--color-text-warning)', fontWeight: 700 }}>
                  {p.delivered} / {p.planned} ban {done ? '✓' : ''}
                </span>
              </div>
              <ProgressBar value={p.delivered} max={p.planned} color={done ? 'var(--color-accent-success)' : 'var(--color-accent-primary)'} />
            </div>
          )
        })}
      </div>

      {deliveries.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Riwayat Kirim Hasil</div>
          {deliveries.map(d => (
            <div key={d.id} style={{ border: '1px solid var(--color-border-primary)', borderRadius: 6, padding: '7px 12px', fontSize: 12 }}>
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

    </div>
  )
}

// ── Yield Analysis Section ────────────────────────────────────────────────────

function YieldSection({ orderId }: { orderId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['order-yield', orderId],
    queryFn: () => getOrderYield(orderId),
  })

  if (isLoading) return (
    <div style={{ padding: '10px 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>Memuat analisis yield...</div>
  )
  if (!data) return null

  const yieldColor = (pct: number) =>
    pct >= 95 ? 'var(--color-text-success)' : pct >= 80 ? 'var(--color-text-warning)' : 'var(--color-text-danger)'
  const yieldChip = (pct: number) =>
    pct >= 95 ? 'chip-success' : pct >= 80 ? 'chip-warning' : 'chip-danger'

  return (
    <div style={{ marginTop: 14 }}>
      {/* Header + overall score */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
          📊 Analisis Efisiensi Material
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
            Tyre: {data.total_delivered}/{data.total_planned} ({data.delivery_rate}%)
          </span>
          {data.has_usage_data ? (
            <span className={`chip ${yieldChip(data.overall_yield)}`} style={{ fontSize: 11, fontWeight: 700 }}>
              Yield {data.overall_yield}%
            </span>
          ) : (
            <span className="chip chip-neutral" style={{ fontSize: 10 }}>Tidak ada data pemakaian</span>
          )}
        </div>
      </div>

      {!data.has_usage_data && (
        <div className="alert alert-warning" style={{ fontSize: 11, marginBottom: 10 }}>
          ⚠️ Pemakaian harian tidak ditautkan ke order ini. Catat pemakaian dengan memilih referensi izin agar yield terhitung.
        </div>
      )}

      <table className="tbl">
        <thead>
          <tr>
            <th>Material</th>
            <th style={{ textAlign: 'right' }}>BOM (expected)</th>
            <th style={{ textAlign: 'right' }}>Aktual Pakai</th>
            <th style={{ textAlign: 'right' }}>Waste</th>
            <th>Yield</th>
          </tr>
        </thead>
        <tbody>
          {data.materials.map(m => (
            <tr key={m.material_id} style={{ background: !m.has_data ? 'var(--color-background-tertiary)' : m.waste > 0 ? 'var(--color-background-warning)' : undefined }}>
              <td>
                <span style={{ fontWeight: 600 }}>{m.kode}</span>
                <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginLeft: 4 }}>{m.name}</span>
              </td>
              <td style={{ textAlign: 'right' }}>{m.expected} {m.unit}</td>
              <td style={{ textAlign: 'right', color: !m.has_data ? 'var(--color-text-secondary)' : undefined }}>
                {m.has_data ? `${m.actual} ${m.unit}` : '—'}
              </td>
              <td style={{ textAlign: 'right', fontWeight: 600, color: m.waste > 0 ? 'var(--color-text-danger)' : m.waste < 0 ? 'var(--color-text-success)' : undefined }}>
                {m.has_data ? (m.waste > 0 ? `+${m.waste}` : String(m.waste)) : '—'}
              </td>
              <td>
                {m.has_data ? (
                  <span className={`chip ${yieldChip(m.yield_pct)}`} style={{ fontSize: 10 }}>
                    {m.yield_pct}%
                  </span>
                ) : (
                  <span className="chip chip-neutral" style={{ fontSize: 10 }}>N/A</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {data.has_usage_data && (
        <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11, color: 'var(--color-text-secondary)' }}>
          <span>✅ Yield ≥95% = efisien</span>
          <span>⚠️ 80–94% = ada pemborosan</span>
          <span>🔴 &lt;80% = perlu investigasi</span>
        </div>
      )}
    </div>
  )
}

// ── Permit Card ───────────────────────────────────────────────────────────────

interface Shortage { kode: string; name: string; unit: string; required: number; available: number; shortage: number }

function PermitCard({ order }: { order: ProductionOrder }) {
  const [expanded, setExpanded] = useState(false)
  const [shortages, setShortages] = useState<Shortage[]>([])
  const [confirmComplete, setConfirmComplete] = useState(false)
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['orders'] })
    qc.invalidateQueries({ queryKey: ['order-progress', order.id] })
    setShortages([])
  }

  const confirmMut = useMutation({
    mutationFn: () => confirmOrder(order.id),
    onSuccess: () => { invalidate(); success('Order dikonfirmasi', `${order.number} siap kirim material`) },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: { shortages?: Shortage[] } } })?.response?.data
      if (data?.shortages) setShortages(data.shortages)
      else toastError('Konfirmasi gagal', 'Periksa stok material')
    },
  })
  const completeMut = useMutation({
    mutationFn: () => completeOrder(order.id),
    onSuccess: () => { invalidate(); success('Order selesai', `${order.number} telah diselesaikan`) },
    onError: () => toastError('Gagal menyelesaikan order'),
  })

  const { data: progress } = useQuery({
    queryKey: ['order-progress', order.id],
    queryFn: () => getOrderProgress(order.id),
    enabled: expanded && ['CONFIRMED', 'MAT_SENT', 'IN_PROGRESS', 'RESULT_SENT'].includes(order.status),
  })

  const { data: requirementsData } = useQuery({
    queryKey: ['order-requirements', order.id],
    queryFn: () => getRequirements(order.id),
    enabled: expanded && order.status === 'DRAFT',
  })

  const sc = STATUS_CHIP[order.status] ?? STATUS_CHIP.DRAFT
  const items = order.items ?? []
  const totalQty = items.reduce((s, it) => s + it.qty_plan, 0)
  const requirements: MaterialRequirement[] = requirementsData?.requirements ?? []

  const handleRefresh = (newStatus?: string) => {
    if (newStatus && newStatus !== order.status) invalidate()
    else {
      qc.invalidateQueries({ queryKey: ['order-progress', order.id] })
      qc.invalidateQueries({ queryKey: ['shipments', order.id] })
    }
  }

  return (
    <div className="card" style={{ padding: '14px 16px', marginBottom: '8px' }}>
      {/* Header */}
      <div className="collapsible-header" onClick={() => setExpanded(e => !e)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
          <span style={{ fontWeight: 700, fontSize: '14px' }}>{order.number}</span>
          <span className={`chip ${sc.cls}`} style={{ fontSize: 11 }}>{sc.label}</span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            {formatDate(order.date)} · {order.shift_display} · {order.pic}
          </span>
          {totalQty > 0 && <span className="chip chip-neutral" style={{ fontSize: 10 }}>{totalQty} unit</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {order.status === 'DRAFT' && (
            <button className="btn btn-b btn-sm" onClick={e => { e.stopPropagation(); setShortages([]); confirmMut.mutate() }} disabled={confirmMut.isLoading}>
              {confirmMut.isLoading ? '...' : 'Konfirmasi'}
            </button>
          )}
          {order.status === 'RESULT_SENT' && (
            <>
              <ConfirmDialog
                open={confirmComplete}
                onOpenChange={setConfirmComplete}
                title="Tandai Order Selesai?"
                description={`Order ${order.number} akan ditutup. Aksi ini tidak dapat dibatalkan.`}
                confirmLabel="Ya, Selesaikan"
                variant="default"
                loading={completeMut.isLoading}
                onConfirm={() => completeMut.mutate()}
              />
              <button className="btn btn-g btn-sm" onClick={e => { e.stopPropagation(); setConfirmComplete(true) }} disabled={completeMut.isLoading}>
                {completeMut.isLoading ? '...' : 'Tandai Selesai'}
              </button>
            </>
          )}
          {expanded ? <ChevronDown size={15} color="#9ca3af" /> : <ChevronRight size={15} color="#9ca3af" />}
        </div>
      </div>

      {/* Step Flow */}
      <div style={{ marginTop: '10px' }}>
        <StepFlow activeIndex={getStepIndex(order.status)} />
      </div>

      {/* Shortage alert */}
      {shortages.length > 0 && (
        <div className="alert alert-danger" style={{ marginTop: '10px' }}>
          <AlertTriangle size={13} />
          <div style={{ flex: 1 }}>
            <strong>Stok tidak cukup!</strong> {shortages.length} material kekurangan:
            <table className="tbl" style={{ marginTop: 8 }}>
              <thead><tr><th>Material</th><th style={{ textAlign: 'right' }}>Dibutuhkan</th><th style={{ textAlign: 'right' }}>Tersedia</th><th style={{ textAlign: 'right' }}>Kurang</th></tr></thead>
              <tbody>
                {shortages.map(s => (
                  <tr key={s.kode} style={{ background: 'var(--color-background-danger)' }}>
                    <td><strong>{s.name}</strong> <span style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{s.kode}</span></td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(s.required)} {s.unit}</td>
                    <td style={{ textAlign: 'right', color: 'var(--color-text-danger)' }}>{fmt(s.available)} {s.unit}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-text-danger)' }}>-{fmt(s.shortage)} {s.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Expanded */}
      {expanded && (
        <div style={{ marginTop: 10, borderTop: '1px solid var(--color-border-tertiary)', paddingTop: 12 }}>
          {items.length > 0 ? (
            <>
              {/* Target */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 600 }}>Target:</span>
                {items.map(item => (
                  <span key={item.id} className="chip chip-info" style={{ fontSize: 11 }}>
                    {item.tyre_spec_detail.size} × {item.qty_plan}
                  </span>
                ))}
              </div>

              {/* Kebutuhan Material (DRAFT only, from requirements API) */}
              {order.status === 'DRAFT' && requirements.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 6, textTransform: 'uppercase' }}>Kebutuhan Material</div>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Material</th>
                        <th style={{ textAlign: 'right' }}>Butuh</th>
                        <th style={{ textAlign: 'right' }}>Stok Gudang</th>
                        <th style={{ textAlign: 'right' }}>Dikunci</th>
                        <th style={{ textAlign: 'right' }}>Tersedia</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requirements.map(r => (
                        <tr key={r.material_id}>
                          <td><strong>{r.name}</strong> <span style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{r.kode}</span></td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(r.qty_needed)} {r.unit}</td>
                          <td style={{ textAlign: 'right', color: 'var(--color-text-secondary)' }}>{fmt(r.stock)}</td>
                          <td style={{ textAlign: 'right', color: (r.locked ?? 0) > 0 ? 'var(--color-text-warning)' : 'var(--color-text-secondary)' }}>
                            {(r.locked ?? 0) > 0 ? `🔒 ${fmt(r.locked)}` : '—'}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: r.is_short ? 'var(--color-text-danger)' : 'var(--color-text-success)' }}>
                            {fmt(r.available ?? r.stock)}
                          </td>
                          <td>{r.is_short ? <span className="chip chip-danger" style={{ fontSize: 10 }}>Kurang {fmt(Math.abs(r.shortage))}</span> : <span className="chip chip-success" style={{ fontSize: 10 }}>Cukup</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Material Shipment */}
              {['CONFIRMED', 'MAT_SENT', 'IN_PROGRESS'].includes(order.status) && progress && (
                <MaterialShipmentSection order={order} progress={progress.material_progress} onRefresh={handleRefresh} />
              )}

              {/* Tyre Delivery (read-only — pengiriman dilakukan oleh PRODUKSI) */}
              {['IN_PROGRESS', 'RESULT_SENT'].includes(order.status) && progress && (
                <TyreDeliverySection order={order} progress={progress.tyre_progress} />
              )}

              {/* Done + Yield */}
              {order.status === 'DONE' && (
                <>
                  <div className="alert alert-success" style={{ marginTop: 4, fontSize: 12 }}>
                    ✅ Selesai. {(progress?.tyre_progress ?? []).reduce((s, p) => s + p.delivered, 0)} ban dikirim ke gudang.
                  </div>
                  <YieldSection orderId={order.id} />
                </>
              )}
            </>
          ) : (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', margin: 0 }}>Belum ada item produksi</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Add Izin Form ─────────────────────────────────────────────────────────────

function AddIzinForm({ tyreSpecs, onClose }: { tyreSpecs: TyreSpec[]; onClose: () => void }) {
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const today = new Date().toISOString().slice(0, 10)
  const [number, setNumber] = useState('')
  const [date, setDate]     = useState(today)
  const [shift, setShift]   = useState('1')
  const [pic, setPic]       = useState('')
  const [items, setItems]   = useState<ItemRow[]>([{ tyre_spec: '', qty_plan: '' }])
  const [error, setError]   = useState('')

  const mutation = useMutation({
    mutationFn: () => createOrder({
      number, date, shift, pic,
      items: items.filter(it => it.tyre_spec && it.qty_plan)
        .map(it => ({ tyre_spec: parseInt(it.tyre_spec), qty_plan: parseInt(it.qty_plan) })),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] })
      success('Izin produksi dibuat', `Order ${number} berhasil disimpan`)
      onClose()
    },
    onError: () => {
      setError('Gagal membuat izin. Periksa data.')
      toastError('Gagal membuat izin produksi')
    },
  })

  const totalQty = items.reduce((s, it) => s + (parseInt(it.qty_plan) || 0), 0)

  // Live material requirements calculation
  const matReqs = useMemo(() => computeRequirements(items, tyreSpecs), [items, tyreSpecs])

  return (
    <div className="card" style={{ padding: '18px', marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Buat Izin Produksi</h3>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Batal</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 110px 1fr', gap: '10px', marginBottom: '14px' }}>
        {[
          { label: 'No. Izin *', el: <input className="form-input" value={number} onChange={e => setNumber(e.target.value)} placeholder="IZN-001" /> },
          { label: 'Tanggal',    el: <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} /> },
          { label: 'Shift',      el: <select className="form-input" value={shift} onChange={e => setShift(e.target.value)}><option value="1">Shift 1</option><option value="2">Shift 2</option><option value="3">Shift 3</option></select> },
          { label: 'PIC',        el: <input className="form-input" value={pic} onChange={e => setPic(e.target.value)} placeholder="Nama PIC" /> },
        ].map(({ label, el }) => (
          <div key={label} className="form-group"><label className="form-label">{label}</label>{el}</div>
        ))}
      </div>

      {/* Items */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600 }}>Target Produksi {totalQty > 0 && <span className="chip chip-info" style={{ marginLeft: 6 }}>{totalQty} unit</span>}</span>
        <button className="btn btn-b btn-sm" onClick={() => setItems(p => [...p, { tyre_spec: '', qty_plan: '' }])}>
          <Plus size={11} /> Tambah
        </button>
      </div>
      {items.map((row, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 28px', gap: '6px', marginBottom: '5px', alignItems: 'end' }}>
          <select className="form-input" value={row.tyre_spec} onChange={e => setItems(p => p.map((r, idx) => idx === i ? { ...r, tyre_spec: e.target.value } : r))}>
            <option value="">Pilih ukuran ban...</option>
            {tyreSpecs.map(ts => <option key={ts.id} value={ts.id}>{ts.size} — {ts.model}</option>)}
          </select>
          <input className="form-input" type="number" min="1" value={row.qty_plan}
            onChange={e => setItems(p => p.map((r, idx) => idx === i ? { ...r, qty_plan: e.target.value } : r))}
            placeholder="Qty" />
          <button className="btn btn-d btn-sm" style={{ padding: '7px' }} onClick={() => setItems(p => p.filter((_, idx) => idx !== i))}>✕</button>
        </div>
      ))}

      {/* Material requirements preview */}
      {matReqs.length > 0 && (
        <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--color-background-tertiary)', borderRadius: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', marginBottom: 6 }}>KEBUTUHAN MATERIAL</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {matReqs.map(r => (
              <span key={r.kode} className="chip chip-neutral" style={{ fontSize: 11 }}>
                {r.name}: <strong>{fmt(r.qty_needed)} {r.unit}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {error && <div className="alert alert-danger" style={{ margin: '10px 0', fontSize: 12 }}>{error}</div>}
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <button className="btn btn-p btn-sm" onClick={() => mutation.mutate()} disabled={mutation.isLoading || !number}>
          {mutation.isLoading ? 'Menyimpan...' : 'Buat Izin'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Batal</button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function IzinPage() {
  const [showForm,    setShowForm]    = useState(false)
  const [filterStatus, setFilterStatus] = useState('SEMUA')
  const [page, setPage] = useState(1)

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['orders', page],
    queryFn: () => getOrders({ page: String(page), page_size: '15' }),
  })
  const { data: specsData } = useQuery({
    queryKey: ['tyre-specs-list'],
    queryFn: () => getTyreSpecs({ page_size: '200' }),
  })

  const orders    = ordersData?.results ?? []
  const tyreSpecs = specsData?.results ?? []
  const filtered  = filterStatus === 'SEMUA' ? orders : orders.filter(o => o.status === filterStatus)
  const countBy   = (s: string) => orders.filter(o => o.status === s).length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 2px' }}>Izin Produksi</h1>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>Buat dan pantau izin produksi ban</p>
        </div>
        <button className="btn btn-p btn-sm" onClick={() => setShowForm(s => !s)}>
          <Plus size={13} /> {showForm ? 'Tutup' : 'Buat Izin'}
        </button>
      </div>

      {showForm && <AddIzinForm tyreSpecs={tyreSpecs} onClose={() => setShowForm(false)} />}

      <div className="metrics-grid" style={{ marginBottom: '14px' }}>
        {[
          { label: 'Total',   value: ordersData?.count ?? '—' },
          { label: 'Aktif',   value: countBy('IN_PROGRESS'),    color: 'var(--color-text-warning)' },
          { label: 'Pending', value: countBy('DRAFT') + countBy('CONFIRMED') + countBy('MAT_SENT'), color: 'var(--color-text-info)' },
          { label: 'Selesai', value: countBy('DONE'),            color: 'var(--color-text-success)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="metric-card">
            <div className="metric-value" style={{ color }}>{value}</div>
            <div className="metric-label">{label}</div>
          </div>
        ))}
      </div>

      <div className="filter-pills" style={{ marginBottom: '12px' }}>
        {(['SEMUA', 'DRAFT', 'CONFIRMED', 'MAT_SENT', 'IN_PROGRESS', 'RESULT_SENT', 'DONE'] as const).map(s => (
          <button key={s} className={`filter-pill ${filterStatus === s ? 'active' : ''}`} onClick={() => { setFilterStatus(s); setPage(1) }}>
            {s === 'SEMUA' ? 'Semua' : (STATUS_CHIP[s]?.label ?? s)}
            {s !== 'SEMUA' && <span style={{ marginLeft: 4, opacity: 0.7 }}>({countBy(s)})</span>}
          </button>
        ))}
      </div>

      {isLoading ? (
        <SkeletonTable rows={5} cols={5} />
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          Tidak ada izin produksi
        </div>
      ) : filtered.map(order => <PermitCard key={order.id} order={order} />)}

      <Pagination page={page} pageSize={15} total={ordersData?.count ?? 0} onPageChange={setPage} />
    </div>
  )
}
