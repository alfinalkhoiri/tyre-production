import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { getMaterials, updateMaterial } from '@/api/spec'
import { getTransactions, createTransaction } from '@/api/inventory'
import { getSafetySuggestions } from '@/api/production'
import { useToast } from '@/context/ToastContext'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/ui/Pagination'
import type { Material, SafetySuggestion } from '@/types'

function formatNum(n: number, d = 2) {
  return n.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function formatDate(s: string) {
  return new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const CATEGORY_ORDER = ['Tread', 'Carcass', 'Chaffer', 'Bead Wire', 'Label', 'Aksesori', 'Umum']
const CATEGORY_ICON: Record<string, string> = {
  Tread: '🔵', Carcass: '🟣', Chaffer: '🟤', 'Bead Wire': '⚙️', Label: '🏷️', Aksesori: '✨', Umum: '📦',
}

function groupByCategory(materials: Material[]) {
  const groups: Record<string, Material[]> = {}
  for (const m of materials) {
    const cat = m.category || 'Umum'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(m)
  }
  return CATEGORY_ORDER
    .filter(c => groups[c]?.length)
    .concat(Object.keys(groups).filter(c => !CATEGORY_ORDER.includes(c)))
    .map(cat => ({ cat, items: groups[cat] ?? [] }))
}

// ── Tab 1: Stok Saat Ini ──────────────────────────────────────

function CategoryStokSection({ cat, icon, materials }: { cat: string; icon: string; materials: Material[] }) {
  const [open, setOpen] = useState(true)

  const lowCount = materials.filter(m => parseFloat(m.stock) < parseFloat(m.safety_stock)).length

  return (
    <div style={{ border: '1px solid var(--color-border-primary)', borderRadius: '8px', marginBottom: '8px', overflow: 'hidden' }}>
      <div
        className="collapsible-header"
        style={{ padding: '10px 14px', background: 'var(--color-background-secondary)', cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
          <span>{icon}</span>
          {cat}
          <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--color-text-secondary)' }}>
            ({materials.length} material)
          </span>
          {lowCount > 0 && (
            <span className="chip chip-warning" style={{ fontSize: '10px' }}>{lowCount} rendah</span>
          )}
        </div>
        {open ? <ChevronDown size={15} color="#9ca3af" /> : <ChevronRight size={15} color="#9ca3af" />}
      </div>

      {open && (
        <table className="tbl">
          <thead>
            <tr>
              <th>Kode</th>
              <th>Nama Material</th>
              <th>Unit</th>
              <th style={{ textAlign: 'right' }}>Stok</th>
              <th style={{ textAlign: 'right' }}>Safety</th>
              <th>Status</th>
              <th style={{ minWidth: '110px' }}>Level</th>
            </tr>
          </thead>
          <tbody>
            {materials.map(m => {
              const stock = parseFloat(m.stock)
              const safety = parseFloat(m.safety_stock)
              const pct = safety > 0 ? Math.min(100, (stock / safety) * 100) : 100
              const status = stock >= safety ? 'AMAN' : stock >= safety * 0.5 ? 'RENDAH' : 'KRITIS'
              const chipCls = status === 'AMAN' ? 'chip-success' : status === 'RENDAH' ? 'chip-warning' : 'chip-danger'
              const barColor = status === 'AMAN' ? 'var(--color-accent-success)' : status === 'RENDAH' ? 'var(--color-accent-warning)' : 'var(--color-accent-danger)'
              return (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{m.kode}</td>
                  <td style={{ color: 'var(--color-text-secondary)' }}>{m.name}</td>
                  <td><span className="chip chip-neutral">{m.unit}</span></td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: stock < 0 ? 'var(--color-text-danger)' : undefined }}>
                    {formatNum(stock)}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--color-text-secondary)' }}>{formatNum(safety)}</td>
                  <td><span className={`chip ${chipCls}`}>{status}</span></td>
                  <td>
                    <div className="progress-track">
                      <div style={{ background: barColor, height: '100%', borderRadius: '3px', width: `${pct}%`, transition: 'width 0.3s' }} />
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{pct.toFixed(0)}%</div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

function StokSaatIni({ materials }: { materials: Material[] }) {
  const lowStock = materials.filter(m => parseFloat(m.stock) < parseFloat(m.safety_stock))
  const groups = groupByCategory(materials)

  return (
    <div>
      {lowStock.length > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: '14px' }}>
          ⚠️ {lowStock.length} material di bawah safety stock: {lowStock.map(m => m.name).join(', ')}
        </div>
      )}
      {groups.map(({ cat, items }) => (
        <CategoryStokSection
          key={cat}
          cat={cat}
          icon={CATEGORY_ICON[cat] ?? '📦'}
          materials={items}
        />
      ))}
    </div>
  )
}

// ── Tab 2: Penerimaan PO ──────────────────────────────────────

interface POForm { noPO: string; tanggal: string; supplier: string; keterangan: string }

function MatGroupSection({
  cat, icon, materials, qtyMap, onQtyChange, expanded, onToggle
}: {
  cat: string; icon: string; materials: Material[]
  qtyMap: Record<number, string>
  onQtyChange: (id: number, v: string) => void
  expanded: boolean; onToggle: () => void
}) {
  const filledCount = materials.filter(m => parseFloat(qtyMap[m.id] ?? '0') > 0).length
  return (
    <div style={{ border: '1px solid var(--color-border-primary)', borderRadius: '8px', marginBottom: '8px', overflow: 'hidden' }}>
      <div
        className="collapsible-header"
        style={{ padding: '10px 14px', background: 'var(--color-background-secondary)', cursor: 'pointer' }}
        onClick={onToggle}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}>
          <span>{icon}</span> {cat}
          <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--color-text-secondary)' }}>
            ({materials.length})
          </span>
          {filledCount > 0 && <span className="chip chip-success">{filledCount} diisi</span>}
        </div>
        {expanded ? <ChevronDown size={15} color="#9ca3af" /> : <ChevronRight size={15} color="#9ca3af" />}
      </div>
      {expanded && (
        <table className="tbl">
          <thead>
            <tr>
              <th>Material</th>
              <th style={{ textAlign: 'right' }}>Stok Saat Ini</th>
              <th>Unit</th>
              <th style={{ width: '130px' }}>Qty Terima</th>
            </tr>
          </thead>
          <tbody>
            {materials.map(m => {
              const qty = parseFloat(qtyMap[m.id] ?? '0')
              return (
                <tr key={m.id} style={{ background: qty > 0 ? 'var(--color-background-success)' : undefined }}>
                  <td>
                    <span style={{ fontWeight: 600 }}>{m.kode}</span>
                    <span style={{ color: 'var(--color-text-secondary)', fontSize: '11px', marginLeft: 6 }}>{m.name}</span>
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--color-text-secondary)' }}>{formatNum(parseFloat(m.stock))}</td>
                  <td><span className="chip chip-neutral">{m.unit}</span></td>
                  <td>
                    <input
                      className="form-input"
                      type="number" min="0" step="0.01"
                      value={qtyMap[m.id] ?? ''}
                      onChange={e => onQtyChange(m.id, e.target.value)}
                      style={{ width: '120px' }}
                      placeholder="0"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

function PenerimaanPO({ materials, onSaved }: { materials: Material[]; onSaved: () => void }) {
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState<POForm>({ noPO: '', tanggal: today, supplier: '', keterangan: '' })
  const [qtyMap, setQtyMap] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const groups = groupByCategory(materials)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    Object.fromEntries(groups.map(({ cat }, i) => [cat, i === 0]))
  )

  const filledItems = materials.filter(m => parseFloat(qtyMap[m.id] ?? '0') > 0)

  const handleSave = async () => {
    if (!form.noPO) { setError('No.PO wajib diisi'); return }
    if (filledItems.length === 0) { setError('Isi minimal 1 qty material'); return }
    setSaving(true); setError('')
    try {
      for (const m of filledItems) {
        await createTransaction({
          material: m.id, type: 'IN',
          qty: parseFloat(qtyMap[m.id]),
          reference: form.noPO,
          date: form.tanggal,
        })
      }
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['materials'] })
      setQtyMap({})
      setForm({ noPO: '', tanggal: today, supplier: '', keterangan: '' })
      success('Penerimaan disimpan', `${filledItems.length} material berhasil di-update`)
      onSaved()
    } catch {
      setError('Gagal menyimpan. Coba lagi.')
      toastError('Gagal menyimpan penerimaan', 'Periksa koneksi dan coba lagi.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="card" style={{ padding: '16px', marginBottom: '14px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>Header Penerimaan</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
          {[
            { label: 'No. PO *', el: <input className="form-input" value={form.noPO} onChange={e => setForm(f => ({ ...f, noPO: e.target.value }))} placeholder="PO-2025-001" /> },
            { label: 'Tanggal',  el: <input className="form-input" type="date" value={form.tanggal} onChange={e => setForm(f => ({ ...f, tanggal: e.target.value }))} /> },
            { label: 'Supplier', el: <input className="form-input" value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} placeholder="PT. Supplier" /> },
            { label: 'Keterangan', el: <input className="form-input" value={form.keterangan} onChange={e => setForm(f => ({ ...f, keterangan: e.target.value }))} placeholder="Opsional" /> },
          ].map(({ label, el }) => (
            <div key={label} className="form-group"><label className="form-label">{label}</label>{el}</div>
          ))}
        </div>
      </div>

      {groups.map(({ cat, items }) => (
        <MatGroupSection
          key={cat}
          cat={cat}
          icon={CATEGORY_ICON[cat] ?? '📦'}
          materials={items}
          qtyMap={qtyMap}
          onQtyChange={(id, v) => setQtyMap(prev => ({ ...prev, [id]: v }))}
          expanded={!!expandedGroups[cat]}
          onToggle={() => setExpandedGroups(e => ({ ...e, [cat]: !e[cat] }))}
        />
      ))}

      {filledItems.length > 0 && (
        <div className="card" style={{ padding: '12px 16px', marginBottom: '12px', background: 'var(--color-background-info)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-info)', marginBottom: '6px' }}>
            {filledItems.length} material diisi
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {filledItems.map(m => (
              <span key={m.id} className="chip chip-info">{m.kode} +{qtyMap[m.id]}</span>
            ))}
          </div>
        </div>
      )}

      {error && <div className="alert alert-danger" style={{ marginBottom: '10px' }}>{error}</div>}
      <button className="btn btn-p" onClick={handleSave} disabled={saving || filledItems.length === 0}>
        {saving ? 'Menyimpan...' : `Simpan Penerimaan (${filledItems.length} material)`}
      </button>
    </div>
  )
}

// ── Tab 3: Riwayat ────────────────────────────────────────────

function Riwayat() {
  const [page, setPage] = useState(1)
  const { data } = useQuery({
    queryKey: ['transactions', page],
    queryFn: () => getTransactions({ page: String(page), page_size: '20' }),
  })
  const TX_CHIP: Record<string, string> = { IN: 'chip-success', AUTO: 'chip-neutral', ADJ: 'chip-warning' }

  return (
    <div>
      <div className="card" style={{ overflow: 'hidden', marginBottom: '12px' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Tanggal</th><th>Material</th><th>Tipe</th>
              <th style={{ textAlign: 'right' }}>Qty</th>
              <th style={{ textAlign: 'right' }}>Stok Sebelum</th>
              <th style={{ textAlign: 'right' }}>Stok Sesudah</th>
              <th>Referensi</th>
            </tr>
          </thead>
          <tbody>
            {data?.results.map(tx => (
              <tr key={tx.id}>
                <td style={{ color: 'var(--color-text-secondary)' }}>{formatDate(tx.date)}</td>
                <td style={{ fontWeight: 600 }}>{tx.material_kode ?? `#${tx.material}`}</td>
                <td><span className={`chip ${TX_CHIP[tx.type] ?? 'chip-neutral'}`}>{tx.type}</span></td>
                <td style={{ textAlign: 'right', fontWeight: 500 }}>{formatNum(parseFloat(tx.qty))}</td>
                <td style={{ textAlign: 'right', color: 'var(--color-text-secondary)' }}>{formatNum(parseFloat(tx.stock_before))}</td>
                <td style={{ textAlign: 'right' }}>{formatNum(parseFloat(tx.stock_after))}</td>
                <td style={{ color: 'var(--color-text-secondary)' }}>{tx.reference || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={20} total={data?.count ?? 0} onPageChange={setPage} />
    </div>
  )
}

// ── Tab 4: Safety Stock ───────────────────────────────────────

function SafetyStockTab() {
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [days, setDays] = useState(30)
  const [leadTime, setLeadTime] = useState(7)
  const [applying, setApplying] = useState<number | null>(null)
  const [applyAll, setApplyAll] = useState(false)
  const [confirmApplyAll, setConfirmApplyAll] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['safety-suggestions', days, leadTime],
    queryFn: () => getSafetySuggestions({ days, lead_time: leadTime }),
  })

  const suggestions = data?.suggestions ?? []
  const withData = suggestions.filter(s => s.has_data)
  const needsIncrease = suggestions.filter(s => s.diff > 0)
  const needsDecrease = suggestions.filter(s => s.diff < 0)

  const applyOne = async (s: SafetySuggestion) => {
    setApplying(s.material_id)
    try {
      await updateMaterial(s.material_id, { safety_stock: String(s.suggested_safety_stock) })
      qc.invalidateQueries({ queryKey: ['materials'] })
      refetch()
      success('Safety stock diperbarui', `${s.kode}: ${s.suggested_safety_stock} ${s.unit}`)
    } catch {
      toastError('Gagal memperbarui safety stock')
    } finally {
      setApplying(null)
    }
  }

  const applyAllSuggestions = async () => {
    setApplyAll(true)
    setConfirmApplyAll(false)
    const targets = suggestions.filter(s => s.has_data && s.diff !== 0)
    try {
      for (const s of targets) {
        await updateMaterial(s.material_id, { safety_stock: String(s.suggested_safety_stock) })
      }
      qc.invalidateQueries({ queryKey: ['materials'] })
      refetch()
      success('Semua safety stock diperbarui', `${targets.length} material berhasil diupdate`)
    } catch {
      toastError('Gagal memperbarui beberapa safety stock')
    } finally {
      setApplyAll(false)
    }
  }

  return (
    <div>
      {/* Info box */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: '14px', background: 'var(--color-background-info)', border: '1px solid var(--color-border-info)' }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-info)', marginBottom: 4 }}>
          📐 Formula Safety Stock Dinamis
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
          Safety Stock = (Rata-rata harian × Lead Time) + (Z × Standar Deviasi × √Lead Time)
          <span style={{ marginLeft: 8, color: 'var(--color-text-info)' }}>Z=1.65 (95% service level)</span>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', marginBottom: '14px', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Periode Historis</label>
          <div className="filter-pills">
            {[14, 30, 60, 90].map(d => (
              <button key={d} className={`filter-pill ${days === d ? 'active' : ''}`} onClick={() => setDays(d)}>
                {d} hari
              </button>
            ))}
          </div>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Lead Time Supplier</label>
          <div className="filter-pills">
            {[3, 7, 14].map(d => (
              <button key={d} className={`filter-pill ${leadTime === d ? 'active' : ''}`} onClick={() => setLeadTime(d)}>
                {d} hari
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary metrics */}
      {!isLoading && (
        <div className="metrics-grid" style={{ marginBottom: '14px' }}>
          {[
            { label: 'Punya Data', value: withData.length, color: undefined },
            { label: 'Perlu Naik', value: needsIncrease.length, color: 'var(--color-text-danger)' },
            { label: 'Bisa Turun', value: needsDecrease.length, color: 'var(--color-text-success)' },
            { label: 'Sudah Optimal', value: suggestions.filter(s => s.diff === 0).length, color: 'var(--color-text-secondary)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="metric-card">
              <div className="metric-value" style={{ color }}>{value}</div>
              <div className="metric-label">{label}</div>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>Menghitung...</div>
      ) : (
        <>
          <ConfirmDialog
            open={confirmApplyAll}
            onOpenChange={setConfirmApplyAll}
            title="Terapkan Semua Saran?"
            description={`Safety stock untuk ${suggestions.filter(s => s.has_data && s.diff !== 0).length} material akan diperbarui sesuai saran sistem.`}
            confirmLabel="Ya, Terapkan Semua"
            variant="warning"
            loading={applyAll}
            onConfirm={applyAllSuggestions}
          />
          {withData.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
              <button
                className="btn btn-p btn-sm"
                onClick={() => setConfirmApplyAll(true)}
                disabled={applyAll || suggestions.filter(s => s.has_data && s.diff !== 0).length === 0}
              >
                {applyAll ? 'Menerapkan...' : `Terapkan Semua (${suggestions.filter(s => s.has_data && s.diff !== 0).length} material)`}
              </button>
            </div>
          )}

          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Material</th>
                  <th style={{ textAlign: 'right' }}>Avg/Hari</th>
                  <th style={{ textAlign: 'right' }}>Safety Saat Ini</th>
                  <th style={{ textAlign: 'right' }}>Saran Baru</th>
                  <th style={{ textAlign: 'right' }}>Selisih</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map(s => {
                  const diffAbs = Math.abs(s.diff)
                  const isIncrease = s.diff > 0
                  const isDecrease = s.diff < 0
                  const isOptimal = s.diff === 0
                  return (
                    <tr key={s.material_id} style={{
                      background: !s.has_data ? 'var(--color-background-tertiary)'
                        : isIncrease ? 'var(--color-background-danger)'
                        : isDecrease ? 'var(--color-background-success)'
                        : undefined,
                      opacity: !s.has_data ? 0.6 : 1,
                    }}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{s.kode}</div>
                        <div style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{s.name}</div>
                        <div style={{ fontSize: 9, color: 'var(--color-text-secondary)' }}>{s.category}</div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {s.has_data ? (
                          <span>{formatNum(s.avg_daily)}<span style={{ fontSize: 9, color: 'var(--color-text-secondary)', marginLeft: 2 }}>{s.unit}</span></span>
                        ) : (
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>No data</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatNum(s.current_safety_stock, 0)} {s.unit}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: isIncrease ? 'var(--color-text-danger)' : isDecrease ? 'var(--color-text-success)' : 'var(--color-text-secondary)' }}>
                        {s.has_data ? `${formatNum(s.suggested_safety_stock, 0)} ${s.unit}` : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {s.has_data && !isOptimal ? (
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, fontWeight: 700, color: isIncrease ? 'var(--color-text-danger)' : 'var(--color-text-success)', fontSize: 12 }}>
                            {isIncrease ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {isIncrease ? '+' : '-'}{formatNum(diffAbs, 0)}
                          </span>
                        ) : s.has_data ? (
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, color: 'var(--color-text-success)', fontSize: 11 }}>
                            <Minus size={11} /> Optimal
                          </span>
                        ) : null}
                      </td>
                      <td>
                        {s.has_data && !isOptimal ? (
                          <button
                            className={`btn btn-sm ${isIncrease ? 'btn-d' : 'btn-g'}`}
                            onClick={() => applyOne(s)}
                            disabled={applying === s.material_id}
                            style={{ fontSize: 11 }}
                          >
                            {applying === s.material_id ? '...' : 'Terapkan'}
                          </button>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                            {s.has_data ? '✓' : '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 10 }}>
            * Analisis berdasarkan {data?.days_analyzed} hari terakhir · Lead time {data?.lead_time_days} hari · Service level {data?.service_level}
          </div>
        </>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────

export function StokPage() {
  const [tab, setTab] = useState<'stok' | 'po' | 'riwayat' | 'safety'>('stok')

  const { data: matData, isLoading } = useQuery({
    queryKey: ['materials'],
    queryFn: () => getMaterials({ page_size: '100' }),
  })
  const materials = matData?.results ?? []

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }}>Stok Material</h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
          Kelola stok material dan penerimaan dari supplier
        </p>
      </div>

      <div className="sub-tabs">
        {([
          ['stok', 'Stok Saat Ini'],
          ['po', 'Penerimaan Material (PO)'],
          ['riwayat', 'Riwayat'],
          ['safety', '📐 Safety Stock'],
        ] as const).map(([key, label]) => (
          <button key={key} className={`sub-tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {isLoading && tab !== 'safety' && tab !== 'riwayat' ? (
        <SkeletonTable rows={6} cols={7} />
      ) : tab === 'stok' ? (
        <StokSaatIni materials={materials} />
      ) : tab === 'po' ? (
        <PenerimaanPO materials={materials} onSaved={() => setTab('stok')} />
      ) : tab === 'safety' ? (
        <SafetyStockTab />
      ) : (
        <Riwayat />
      )}
    </div>
  )
}
