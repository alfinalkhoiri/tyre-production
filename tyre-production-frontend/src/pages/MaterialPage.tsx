import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { getMaterials } from '@/api/spec'
import { getDailyUsages, createDailyUsage, getOrders, getOrder, getShipments, getPendingShipments, receiveMaterial } from '@/api/production'
import type { Material } from '@/types'

function formatNum(n: number, d = 2) {
  return n.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function formatDate(s: string) {
  return new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Tab 1: Terima Material ─────────────────────────────────────

function TerimaMaterial() {
  const qc = useQueryClient()

  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ['pending-shipments'],
    queryFn: getPendingShipments,
    refetchInterval: 30000,
  })

  const confirmMut = useMutation({
    mutationFn: ({ orderId, shipmentId }: { orderId: number; shipmentId: number }) =>
      receiveMaterial(orderId, shipmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-shipments'] })
      qc.invalidateQueries({ queryKey: ['prod-stock'] })
    },
  })

  if (isLoading) return (
    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>Memuat...</div>
  )

  return (
    <div>
      <div className="alert alert-info" style={{ marginBottom: '14px' }}>
        ℹ️ Konfirmasi penerimaan material yang dikirim oleh gudang. Klik <strong>Konfirmasi Terima</strong> setelah material benar-benar diterima.
      </div>

      {shipments.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>📦</div>
          <p style={{ margin: 0, fontWeight: 600 }}>Tidak ada pengiriman material pending</p>
          <p style={{ margin: '4px 0 0', fontSize: '12px' }}>Semua kiriman sudah dikonfirmasi</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {shipments.map(s => (
            <div key={s.id} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>
                    {s.order_number ?? `Order #${s.order}`}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    {formatDate(s.date)}{s.note && ` — ${s.note}`}
                  </div>
                </div>
                <button
                  className="btn btn-g btn-sm"
                  onClick={() => confirmMut.mutate({ orderId: s.order, shipmentId: s.id })}
                  disabled={confirmMut.isLoading}
                  style={{ flexShrink: 0 }}
                >
                  <CheckCircle size={13} />
                  {confirmMut.isLoading ? 'Menyimpan...' : 'Konfirmasi Terima'}
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {s.entries.map(e => (
                  <span key={e.id} className="chip chip-neutral" style={{ fontSize: '11px' }}>
                    <strong>{e.material_detail.name}</strong>
                    <span style={{ marginLeft: '4px', color: 'var(--color-text-secondary)' }}>
                      +{e.qty} {e.material_detail.unit}
                    </span>
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

// ── Tab 2: Pemakaian Harian ────────────────────────────────────

interface UsageEntry { material: number; qty: string }
interface BomSuggestion { material: Material; suggestedQty: number; unit: string; fromShipment?: boolean }

function MatCard({
  m, qty, suggestedQty, alreadyUsed, unit, fromShipment, onUpdate,
}: {
  m: Material; qty: string; suggestedQty?: number; alreadyUsed?: number; unit?: string; fromShipment?: boolean
  onUpdate: (id: number, v: string) => void
}) {
  const filled = parseFloat(qty) > 0
  const remaining = (suggestedQty !== undefined && alreadyUsed !== undefined)
    ? Math.max(0, suggestedQty - alreadyUsed) : suggestedQty
  const pct = (suggestedQty && suggestedQty > 0 && alreadyUsed !== undefined)
    ? Math.min(100, (alreadyUsed / suggestedQty) * 100) : 0
  const isFulfilled = suggestedQty !== undefined && alreadyUsed !== undefined && alreadyUsed >= suggestedQty

  const fmt = (n: number) => n % 1 === 0 ? String(n) : n.toFixed(2)

  return (
    <div style={{
      border: `1px solid ${isFulfilled ? 'var(--color-accent-success)' : filled ? 'var(--color-accent-primary)' : 'var(--color-border-primary)'}`,
      borderRadius: '8px', padding: '10px 12px',
      background: isFulfilled ? 'var(--color-background-success)' : filled ? 'var(--color-background-info)' : undefined,
      transition: 'all 0.15s',
    }}>
      <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '1px' }}>{m.kode}</div>
      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{m.name}</div>

      {suggestedQty !== undefined && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '3px' }}>
            <span style={{ color: fromShipment ? 'var(--color-text-success)' : 'var(--color-text-secondary)' }}>
              {fromShipment ? '📦 Dikirim' : 'BOM'}: {fmt(suggestedQty)} {unit}
            </span>
            {alreadyUsed !== undefined && alreadyUsed > 0 && (
              <span style={{ color: isFulfilled ? 'var(--color-text-success)' : 'var(--color-text-warning)', fontWeight: 600 }}>
                +{fmt(alreadyUsed)} terpakai
              </span>
            )}
          </div>
          {alreadyUsed !== undefined && suggestedQty > 0 && (
            <div style={{ height: 4, background: 'var(--color-background-tertiary)', borderRadius: 2, marginBottom: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${pct}%`, borderRadius: 2, transition: 'width 0.3s',
                background: pct >= 100 ? 'var(--color-accent-success)' : pct >= 50 ? 'var(--color-accent-warning)' : 'var(--color-accent-primary)',
              }} />
            </div>
          )}
          {isFulfilled ? (
            <div style={{ fontSize: '10px', color: 'var(--color-text-success)', fontWeight: 700, marginBottom: '4px' }}>✓ Terpenuhi</div>
          ) : remaining !== undefined && (
            <div style={{ fontSize: '10px', color: 'var(--color-text-info)', fontWeight: 600, marginBottom: '4px' }}>
              Sisa: {fmt(remaining)} {unit}
            </div>
          )}
        </>
      )}

      <input
        className="form-input"
        type="number" min="0" step="0.01"
        value={qty}
        onChange={e => onUpdate(m.id, e.target.value)}
        placeholder={remaining !== undefined ? fmt(remaining) : '0'}
        style={{ fontSize: '13px' }}
        disabled={isFulfilled}
      />
    </div>
  )
}

// Shared helper — compute estimated tyre output per item from total material usage
function computeTyreEstimate(
  item: import('@/types').ProductionOrderItem,
  totalUsed: Record<number, number>
): { estimated: number; bottleneck: string | null } {
  const rows: { kode: string; coverage: number }[] = []
  for (const bom of item.tyre_spec_detail?.bom_items ?? []) {
    const mat = bom.material_detail
    let needed: number
    if (mat.roll_length && bom.unit === 'm') {
      needed = parseFloat(bom.qty) * item.qty_plan / parseFloat(mat.roll_length)
    } else {
      needed = parseFloat(bom.qty) * item.qty_plan
    }
    const used = totalUsed[mat.id] ?? 0
    if (used > 0) rows.push({ kode: mat.kode, coverage: needed > 0 ? used / needed : 0 })
  }
  if (!rows.length) return { estimated: 0, bottleneck: null }
  const minCov = Math.min(...rows.map(r => r.coverage))
  return {
    estimated: Math.floor(minCov * item.qty_plan),
    bottleneck: rows.find(r => r.coverage === minCov)?.kode ?? null,
  }
}

function TyreEstimatePanel({
  orderDetail, totalUsedMap,
}: {
  orderDetail: import('@/types').ProductionOrder
  totalUsedMap: Record<number, number>
}) {
  const items = orderDetail.items ?? []
  const estimates = items.map(item => ({
    size: item.tyre_spec_detail.size,
    model: item.tyre_spec_detail.model,
    planned: item.qty_plan,
    ...computeTyreEstimate(item, totalUsedMap),
  }))
  if (!estimates.some(e => e.estimated > 0)) return null

  return (
    <div style={{ marginBottom: 12, border: '1px solid var(--color-border-info)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '7px 12px', background: 'var(--color-background-info)', fontSize: 11, fontWeight: 700, color: 'var(--color-text-info)' }}>
        📦 Estimasi Output Tyre (dari total pemakaian)
      </div>
      {estimates.map((e, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 12px', borderTop: i > 0 ? '1px solid var(--color-border-tertiary)' : undefined }}>
          <div>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{e.size}</span>
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginLeft: 5 }}>{e.model}</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{
              fontWeight: 700, fontSize: 14,
              color: e.estimated >= e.planned ? 'var(--color-text-success)' : e.estimated > 0 ? 'var(--color-text-warning)' : 'var(--color-text-secondary)',
            }}>
              {e.estimated} tyre
            </span>
            <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', marginLeft: 4 }}>/ {e.planned} target</span>
            {e.bottleneck && e.estimated < e.planned && (
              <div style={{ fontSize: 10, color: 'var(--color-text-danger)' }}>bottleneck: {e.bottleneck}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function PakaiHarian({ materials }: { materials: Material[] }) {
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)
  const [showForm, setShowForm]   = useState(false)
  const [formDate, setFormDate]   = useState(today)
  const [formShift, setFormShift] = useState('1')
  const [formNote, setFormNote]   = useState('')
  const [formOrder, setFormOrder] = useState('')
  const [entries, setEntries]     = useState<UsageEntry[]>([])
  const [error, setError]         = useState('')
  const [showOther, setShowOther] = useState(false)
  const [expandedLog, setExpandedLog] = useState<number | null>(null)

  const { data: usageData } = useQuery({
    queryKey: ['daily-usages'],
    queryFn: () => getDailyUsages({ page_size: '50' }),
  })
  const { data: ordersData } = useQuery({
    queryKey: ['orders-active'],
    queryFn: () => getOrders({ page_size: '50' }),
  })
  const { data: orderDetail, isLoading: orderLoading } = useQuery({
    queryKey: ['order-detail-usage', formOrder],
    queryFn: () => getOrder(parseInt(formOrder)),
    enabled: !!formOrder,
  })
  const { data: existingUsageData } = useQuery({
    queryKey: ['daily-usages-for-order', formOrder],
    queryFn: () => getDailyUsages({ order: formOrder, page_size: '200' }),
    enabled: !!formOrder,
  })
  const { data: shipmentsData } = useQuery({
    queryKey: ['order-shipments', formOrder],
    queryFn: () => getShipments(parseInt(formOrder)),
    enabled: !!formOrder,
  })

  const usages = usageData?.results ?? []
  const orders = ordersData?.results ?? []

  // Cumulative usage already saved for this order (from DB)
  const alreadyUsedMap = useMemo(() => {
    const map: Record<number, number> = {}
    for (const u of existingUsageData?.results ?? []) {
      for (const e of u.entries ?? []) {
        map[e.material] = (map[e.material] ?? 0) + parseFloat(e.qty)
      }
    }
    return map
  }, [existingUsageData])

  // Live total = already saved + current form inputs (for TyreEstimatePanel)
  const totalUsedMap = useMemo(() => {
    const map: Record<number, number> = { ...alreadyUsedMap }
    for (const entry of entries) {
      const q = parseFloat(entry.qty)
      if (q > 0) map[entry.material] = (map[entry.material] ?? 0) + q
    }
    return map
  }, [alreadyUsedMap, entries])

  // Total confirmed shipped qty per material for this order
  const shippedQtyMap = useMemo(() => {
    const map: Record<number, number> = {}
    for (const s of shipmentsData ?? []) {
      if (!s.confirmed) continue
      for (const e of s.entries) {
        map[e.material] = (map[e.material] ?? 0) + parseFloat(e.qty)
      }
    }
    return map
  }, [shipmentsData])

  // Build BOM suggestions: material list from BOM, qty from actual shipped
  const bomSuggestions: BomSuggestion[] = useMemo(() => {
    if (!orderDetail?.items) return []
    const agg: Record<number, BomSuggestion> = {}
    for (const item of orderDetail.items) {
      for (const bom of item.tyre_spec_detail?.bom_items ?? []) {
        const mat = bom.material_detail
        const mid = mat.id
        const unit = (mat.roll_length && bom.unit === 'm') ? 'ROLL' : mat.unit
        if (!agg[mid]) {
          agg[mid] = { material: mat, suggestedQty: 0, unit }
        }
      }
    }
    // Set suggestedQty from actual shipped; fall back to BOM calc if not shipped yet
    for (const item of orderDetail.items) {
      for (const bom of item.tyre_spec_detail?.bom_items ?? []) {
        const mat = bom.material_detail
        const mid = mat.id
        if (!(mid in agg)) continue
        if (shippedQtyMap[mid] !== undefined) {
          agg[mid].suggestedQty = shippedQtyMap[mid]
          agg[mid].fromShipment = true
        } else {
          let qty: number
          if (mat.roll_length && bom.unit === 'm') {
            qty = Math.ceil(parseFloat(bom.qty) * item.qty_plan / parseFloat(mat.roll_length))
          } else {
            qty = parseFloat(bom.qty) * item.qty_plan
          }
          agg[mid].suggestedQty += qty
        }
      }
    }
    return Object.values(agg)
  }, [orderDetail, shippedQtyMap])

  const bomMatIds = new Set(bomSuggestions.map(s => s.material.id))
  const otherMaterials = materials.filter(m => !bomMatIds.has(m.id))

  const updateEntry = (matId: number, qty: string) => {
    setEntries(prev => {
      const existing = prev.find(e => e.material === matId)
      if (existing) return prev.map(e => e.material === matId ? { ...e, qty } : e)
      return [...prev, { material: matId, qty }]
    })
  }
  const getQty = (matId: number) => entries.find(e => e.material === matId)?.qty ?? ''

  const handleOrderChange = (val: string) => {
    setFormOrder(val)
    setEntries([])   // reset qty saat ganti order
    setShowOther(false)
  }

  const mutation = useMutation({
    mutationFn: () => createDailyUsage({
      date: formDate, shift: formShift,
      order: formOrder ? parseInt(formOrder) : undefined,
      note: formNote,
      entries: entries.filter(e => parseFloat(e.qty) > 0).map(e => ({ material: e.material, qty: parseFloat(e.qty) })),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily-usages'] })
      qc.invalidateQueries({ queryKey: ['materials'] })
      if (formOrder) qc.invalidateQueries({ queryKey: ['daily-usages-for-order', formOrder] })
      setEntries([])
      setFormNote('')
      setShowForm(false)
      setFormOrder('')
    },
    onError: () => setError('Gagal menyimpan. Shift ini mungkin sudah ada entri.'),
  })

  const filledCount = entries.filter(e => parseFloat(e.qty) > 0).length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600 }}>Catat pemakaian material per shift</span>
        <button className="btn btn-p btn-sm" onClick={() => { setShowForm(s => !s); setEntries([]); setFormOrder('') }}>
          <Plus size={13} /> {showForm ? 'Tutup' : 'Input Pemakaian'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
          {/* Header fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr', gap: '10px', marginBottom: '14px' }}>
            <div className="form-group">
              <label className="form-label">Tanggal</label>
              <input className="form-input" type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Shift</label>
              <select className="form-input" value={formShift} onChange={e => setFormShift(e.target.value)}>
                <option value="1">Shift 1</option>
                <option value="2">Shift 2</option>
                <option value="3">Shift 3</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Ref. Izin</label>
              <select className="form-input" value={formOrder} onChange={e => handleOrderChange(e.target.value)}>
                <option value="">— Pilih —</option>
                {orders.filter(o => o.status !== 'DONE').map(o => (
                  <option key={o.id} value={o.id}>{o.number} ({o.status})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Catatan</label>
              <input className="form-input" value={formNote} onChange={e => setFormNote(e.target.value)} placeholder="Opsional" />
            </div>
          </div>

          {/* ── Mode: Order dipilih → tampil material BOM ── */}
          {formOrder ? (
            orderLoading ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-secondary)', fontSize: 12 }}>
                Memuat BOM order...
              </div>
            ) : (
              <>
                {/* Info banner */}
                <div className="alert alert-info" style={{ marginBottom: '12px', fontSize: 11 }}>
                  ℹ️ Material berikut diambil dari BOM izin <strong>{orderDetail?.number}</strong>.
                  Kolom <em>BOM</em> menunjukkan perkiraan kebutuhan teoritis.
                </div>

                {/* BOM materials */}
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Material dari Izin ({bomSuggestions.length} jenis)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                  {bomSuggestions.map(({ material: m, suggestedQty, unit, fromShipment }) => (
                    <MatCard
                      key={m.id} m={m} qty={getQty(m.id)}
                      suggestedQty={suggestedQty} unit={unit}
                      alreadyUsed={alreadyUsedMap[m.id] ?? 0}
                      fromShipment={fromShipment}
                      onUpdate={updateEntry}
                    />
                  ))}
                </div>

                {orderDetail && (
                  <TyreEstimatePanel orderDetail={orderDetail} totalUsedMap={totalUsedMap} />
                )}

                {/* Other materials — collapsible */}
                {otherMaterials.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <div
                      className="collapsible-header"
                      style={{ padding: '8px 12px', background: 'var(--color-background-secondary)', borderRadius: '6px', cursor: 'pointer', marginBottom: showOther ? '8px' : 0 }}
                      onClick={() => setShowOther(o => !o)}
                    >
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                        Material Lainnya ({otherMaterials.length})
                      </span>
                      {showOther ? <ChevronDown size={14} color="#9ca3af" /> : <ChevronRight size={14} color="#9ca3af" />}
                    </div>
                    {showOther && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                        {otherMaterials.map(m => (
                          <MatCard key={m.id} m={m} qty={getQty(m.id)} onUpdate={updateEntry} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )
          ) : (
            /* ── Mode: tanpa order → tampil semua material ── */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', marginBottom: '14px' }}>
              {materials.map(m => (
                <MatCard key={m.id} m={m} qty={getQty(m.id)} onUpdate={updateEntry} />
              ))}
            </div>
          )}

          {error && <div className="alert alert-danger" style={{ marginBottom: '10px' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="btn btn-p" onClick={() => mutation.mutate()} disabled={mutation.isLoading || filledCount === 0}>
              {mutation.isLoading ? 'Menyimpan...' : `Simpan Pemakaian (${filledCount} material)`}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowForm(false); setEntries([]); setFormOrder('') }}>
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Log Riwayat */}
      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>
        Riwayat Pemakaian ({usages.length} entri)
      </div>
      {usages.length === 0 ? (
        <div className="card" style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          Belum ada data pemakaian
        </div>
      ) : usages.map(u => {
        const isOpen = expandedLog === u.id
        const total = (u.entries ?? []).reduce((s, e) => s + parseFloat(e.qty), 0)
        return (
          <div key={u.id} className="card" style={{ padding: '12px 16px', marginBottom: '6px' }}>
            <div className="collapsible-header" onClick={() => setExpandedLog(isOpen ? null : u.id)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>{formatDate(u.date)}</span>
                <span className="chip chip-neutral">{u.shift_display}</span>
                {u.order_number && <span className="chip chip-info">{u.order_number}</span>}
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  {(u.entries ?? []).length} material · total {formatNum(total)}
                </span>
              </div>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{isOpen ? '▲' : '▼'}</span>
            </div>
            {isOpen && (u.entries ?? []).length > 0 && (
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--color-border-tertiary)' }}>
                <table className="tbl">
                  <thead>
                    <tr><th>Material</th><th style={{ textAlign: 'right' }}>Qty</th><th>Unit</th></tr>
                  </thead>
                  <tbody>
                    {(u.entries ?? []).map(e => (
                      <tr key={e.id}>
                        <td style={{ fontWeight: 600 }}>{e.material_detail?.kode ?? `#${e.material}`}</td>
                        <td style={{ textAlign: 'right' }}>{formatNum(parseFloat(e.qty))}</td>
                        <td style={{ color: 'var(--color-text-secondary)' }}>{e.material_detail?.unit ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {u.note && <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '8px 0 0' }}>📝 {u.note}</p>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Tab 3: Prediksi ────────────────────────────────────────────

function Prediksi({ materials }: { materials: Material[] }) {
  const [days, setDays] = useState<7 | 14 | 30>(7)

  const { data: usageData } = useQuery({
    queryKey: ['daily-usages-pred'],
    queryFn: () => getDailyUsages({ page_size: '2000' }),
  })

  const usages = usageData?.results ?? []

  // Average daily usage per material over last N days
  const rows = materials.map(m => {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const recent = usages.filter(u => new Date(u.date) >= cutoff)
    const totalQty = recent.flatMap(u => u.entries ?? []).filter(e => e.material === m.id).reduce((s, e) => s + parseFloat(e.qty), 0)
    const avgPerDay = totalQty / Math.max(days, 1)
    const currentStock = parseFloat(m.stock)
    const daysLeft = avgPerDay > 0 ? currentStock / avgPerDay : Infinity
    const need1 = avgPerDay * 1
    const need3 = avgPerDay * 3
    const need7 = avgPerDay * 7
    return { ...m, avgPerDay, currentStock, daysLeft, need1, need3, need7 }
  })

  const atRisk = rows.filter(r => r.daysLeft < 3 && r.avgPerDay > 0)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600 }}>Periode historis:</span>
        <div className="filter-pills">
          {([7, 14, 30] as const).map(d => (
            <button key={d} className={`filter-pill ${days === d ? 'active' : ''}`} onClick={() => setDays(d)}>
              {d} hari
            </button>
          ))}
        </div>
      </div>

      {atRisk.length > 0 && (
        <div className="alert alert-danger" style={{ marginBottom: '14px' }}>
          ⚠️ {atRisk.length} material tidak cukup untuk 3 hari ke depan: {atRisk.map(r => r.kode).join(', ')}
        </div>
      )}

      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Material</th>
              <th style={{ textAlign: 'right' }}>Rata-rata/hr</th>
              <th style={{ textAlign: 'right' }}>Stok Produksi</th>
              <th style={{ textAlign: 'right' }}>Hari Tersisa</th>
              <th style={{ textAlign: 'right', color: 'var(--color-text-danger)' }}>Perlu 1 Hari</th>
              <th style={{ textAlign: 'right', color: 'var(--color-accent-warning)' }}>Perlu 3 Hari</th>
              <th style={{ textAlign: 'right', color: 'var(--color-accent-primary)' }}>Perlu 7 Hari</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const daysLeftNum = isFinite(row.daysLeft) ? row.daysLeft : null
              const daysChipCls = daysLeftNum === null ? 'chip-neutral' : daysLeftNum > 7 ? 'chip-success' : daysLeftNum >= 3 ? 'chip-warning' : 'chip-danger'
              return (
                <tr key={row.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{row.kode}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{row.name}</div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {row.avgPerDay > 0 ? formatNum(row.avgPerDay) : <span style={{ color: 'var(--color-text-secondary)' }}>—</span>}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatNum(row.currentStock)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={`chip ${daysChipCls} ${daysLeftNum !== null && daysLeftNum <= 3 ? 'blink' : ''}`}>
                      {daysLeftNum !== null ? `${daysLeftNum.toFixed(1)} hr` : '∞'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--color-text-danger)' }}>
                    {row.avgPerDay > 0 ? formatNum(row.need1) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--color-accent-warning)' }}>
                    {row.avgPerDay > 0 ? formatNum(row.need3) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--color-accent-primary)' }}>
                    {row.avgPerDay > 0 ? formatNum(row.need7) : '—'}
                  </td>
                  <td>
                    {row.avgPerDay === 0 ? (
                      <span className="chip chip-neutral">No Data</span>
                    ) : daysLeftNum !== null && daysLeftNum <= 3 ? (
                      <span className="chip chip-danger blink">KRITIS</span>
                    ) : daysLeftNum !== null && daysLeftNum <= 7 ? (
                      <span className="chip chip-warning">RENDAH</span>
                    ) : (
                      <span className="chip chip-success">AMAN</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────

export function MaterialPage() {
  const [tab, setTab] = useState<'terima' | 'pakai' | 'prediksi'>('pakai')

  const { data: matData } = useQuery({
    queryKey: ['materials'],
    queryFn: () => getMaterials({ page_size: '100' }),
  })
  const materials = matData?.results ?? []

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }}>Material</h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
          Terima material, catat pemakaian, dan pantau prediksi kebutuhan
        </p>
      </div>

      <div className="sub-tabs">
        {([
          ['terima', 'Terima Material'],
          ['pakai', 'Pemakaian Harian'],
          ['prediksi', 'Prediksi Kebutuhan'],
        ] as const).map(([key, label]) => (
          <button key={key} className={`sub-tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'terima'  && <TerimaMaterial />}
      {tab === 'pakai'   && <PakaiHarian materials={materials} />}
      {tab === 'prediksi' && <Prediksi materials={materials} />}
    </div>
  )
}
