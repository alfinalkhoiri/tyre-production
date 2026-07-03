import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Plus, EyeOff, Info } from 'lucide-react'
import { getTyreSpecs, getMaterials, createTyreSpec, deactivateTyreSpec, createBOMItem } from '@/api/spec'
import type { TyreSpec, BOMItem, Material } from '@/types'

const VARIANTS = ['PERFORMANCE', 'RAPID ROB', 'DD GG', 'ROAD CRUISER', 'CUSTOM', '']
const VARIANT_BADGE: Record<string, string> = {
  'PERFORMANCE':   'badge-orange',
  'RAPID ROB':     'badge-blue',
  'DD GG':         'badge-purple',
  'ROAD CRUISER':  'badge-green',
  'CUSTOM':        'badge-green',
  '':              'badge-gray',
}
const FILTER_OPTIONS = ['Semua', 'PERFORMANCE', 'RAPID ROB', 'DD GG', 'ROAD CRUISER', 'CUSTOM']

function RollSummaryCard({ item }: { item: BOMItem }) {
  const mat = item.material_detail
  return (
    <div style={{
      border: '1px solid var(--color-border-primary)',
      borderRadius: '8px', padding: '10px 14px', minWidth: '130px',
      background: 'var(--color-background-secondary)',
    }}>
      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 600, marginBottom: '2px' }}>
        {mat.name}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
        {mat.roll_length ? parseFloat(mat.roll_length).toFixed(0) : '?'}m ÷ {item.qty}m/ban
      </div>
      <div style={{ display: 'flex', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-accent-primary)', lineHeight: 1 }}>
            {item.tyre_per_roll != null ? Math.round(item.tyre_per_roll) : '—'}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>tyre/roll</div>
        </div>
        <div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-accent-warning)', lineHeight: 1 }}>
            {item.roll_per_100_tyre != null ? item.roll_per_100_tyre.toFixed(1) : '—'}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>roll/100ban</div>
        </div>
      </div>
    </div>
  )
}

function BOMTable({ items }: { items: BOMItem[] }) {
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--color-border-tertiary)', borderRadius: '8px' }}>
      <table className="tbl" style={{ marginBottom: 0 }}>
        <thead>
          <tr>
            <th style={{ width: 32 }}>#</th>
            <th>Material</th>
            <th>Unit</th>
            <th>Qty/Tyre</th>
            <th>1 ROLL = ? Tyre</th>
            <th>Per 100 Ban</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const isRoll = item.unit === 'm'
            const qty = parseFloat(item.qty)
            return (
              <tr key={item.id}>
                <td style={{ color: 'var(--color-text-secondary)' }}>{i + 1}</td>
                <td>
                  <span style={{ fontWeight: 600 }}>{item.material_detail.kode}</span>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '11px', marginLeft: 6 }}>
                    {item.material_detail.name}
                  </span>
                </td>
                <td>
                  <span className="chip chip-neutral">{item.unit}</span>
                </td>
                <td style={{ fontWeight: 500 }}>
                  {qty} {item.unit}/ban
                </td>
                <td>
                  {isRoll && item.tyre_per_roll != null ? (
                    <span style={{ fontWeight: 600, color: 'var(--color-accent-primary)' }}>
                      {Math.round(item.tyre_per_roll)} tyre
                    </span>
                  ) : <span style={{ color: 'var(--color-text-secondary)' }}>—</span>}
                </td>
                <td>
                  {isRoll && item.roll_per_100_tyre != null ? (
                    <span style={{ fontWeight: 600, color: 'var(--color-accent-warning)' }}>
                      {item.roll_per_100_tyre.toFixed(1)} ROLL
                    </span>
                  ) : (
                    <span>{(qty * 100).toFixed(0)} {item.unit?.toUpperCase()}</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TyreCard({ spec, onDeactivate }: { spec: TyreSpec; onDeactivate: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const bom = spec.bom_items ?? []
  const rollItems = bom.filter(b => b.unit === 'm')
  const firstRoll = rollItems[0]

  return (
    <div className="card" style={{ padding: '16px', marginBottom: '8px' }}>
      {/* Header */}
      <div className="collapsible-header" onClick={() => setExpanded(e => !e)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '18px', fontWeight: 800 }}>{spec.size}</span>
          {spec.variant && (
            <span className={`badge ${VARIANT_BADGE[spec.variant] ?? 'badge-gray'}`}>{spec.variant}</span>
          )}
          {spec.is_custom && <span className="badge badge-green">Custom</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="btn btn-ghost btn-xs"
            style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border-secondary)' }}
            onClick={e => { e.stopPropagation(); if (confirm(`Non-aktifkan ${spec.size}? Spesifikasi tidak akan muncul lagi di daftar.`)) onDeactivate() }}
          >
            <EyeOff size={12} /> Non-Aktif
          </button>
          {expanded ? <ChevronDown size={16} color="#9ca3af" /> : <ChevronRight size={16} color="#9ca3af" />}
        </div>
      </div>

      {/* Subheader */}
      <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{spec.model}</span>
        {firstRoll && (
          <span style={{
            fontSize: '11px', background: 'var(--color-background-info)',
            color: 'var(--color-text-info)', padding: '2px 8px', borderRadius: '4px', fontWeight: 500,
          }}>
            🔄 1 {firstRoll.material_detail.name} ROLL = {firstRoll.tyre_per_roll != null ? Math.round(firstRoll.tyre_per_roll) : '?'} tyre
          </span>
        )}
      </div>

      {/* Expanded content */}
      {expanded && bom.length > 0 && (
        <div style={{ marginTop: '14px' }}>
          <BOMTable items={bom} />

          {rollItems.length > 0 && (
            <div style={{
              marginTop: '12px', paddingTop: '12px',
              borderTop: '1px solid var(--color-border-tertiary)',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                ROLL SUMMARY
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {rollItems.map(item => <RollSummaryCard key={item.id} item={item} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {expanded && bom.length === 0 && (
        <div style={{ marginTop: '12px', color: 'var(--color-text-secondary)', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>
          Belum ada BOM item
        </div>
      )}
    </div>
  )
}

interface BOMRow { material: string; qty: string; unit: string }

function AddTyreForm({ materials, onClose }: { materials: Material[]; onClose: () => void }) {
  const qc = useQueryClient()
  const [size, setSize] = useState('')
  const [model, setModel] = useState('')
  const [variant, setVariant] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const [boms, setBoms] = useState<BOMRow[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const addBomRow = () => setBoms(b => [...b, { material: '', qty: '', unit: 'm' }])
  const removeBomRow = (i: number) => setBoms(b => b.filter((_, idx) => idx !== i))
  const updateBomRow = (i: number, field: keyof BOMRow, val: string) =>
    setBoms(b => b.map((row, idx) => idx === i ? { ...row, [field]: val } : row))

  const handleSubmit = async () => {
    if (!size || !model) { setError('Ukuran dan model wajib diisi'); return }
    setSaving(true); setError('')
    try {
      const spec = await createTyreSpec({ size, model, variant, is_custom: isCustom })
      for (const row of boms) {
        if (row.material && row.qty) {
          await createBOMItem({ tyre_spec: spec.id, material: parseInt(row.material), qty: row.qty, unit: row.unit })
        }
      }
      qc.invalidateQueries({ queryKey: ['tyre-specs'] })
      onClose()
    } catch (e: unknown) {
      setError('Gagal menyimpan. Periksa data dan coba lagi.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card" style={{ padding: '20px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Tambah Spesifikasi Tyre</h3>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Batal</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <div className="form-group">
          <label className="form-label">Ukuran/Size *</label>
          <input className="form-input" value={size} onChange={e => setSize(e.target.value)} placeholder="700×35C" />
        </div>
        <div className="form-group">
          <label className="form-label">Nama Model *</label>
          <input className="form-input" value={model} onChange={e => setModel(e.target.value)} placeholder="Smart Sam Plus" />
        </div>
        <div className="form-group">
          <label className="form-label">Variant</label>
          <select className="form-input" value={variant} onChange={e => setVariant(e.target.value)}>
            <option value="">— Pilih Variant —</option>
            {VARIANTS.filter(v => v).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginBottom: '16px' }}>
        <input type="checkbox" checked={isCustom} onChange={e => setIsCustom(e.target.checked)} />
        Tandai sebagai Custom
      </label>

      <div className="alert alert-info" style={{ marginBottom: '12px' }}>
        <Info size={14} />
        Untuk roll material, masukkan qty dalam <strong>meter per ban</strong> (m/ban). Sistem akan otomatis menghitung tyre/roll dari panjang roll.
      </div>

      <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', fontWeight: 600 }}>Bill of Material</span>
        <button className="btn btn-b btn-sm" onClick={addBomRow}>
          <Plus size={12} /> Tambah Material
        </button>
      </div>

      {boms.map((row, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 32px', gap: '8px', marginBottom: '6px', alignItems: 'end' }}>
          <div className="form-group">
            {i === 0 && <label className="form-label">Material</label>}
            <select className="form-input" value={row.material} onChange={e => updateBomRow(i, 'material', e.target.value)}>
              <option value="">Pilih material...</option>
              {materials.map(m => <option key={m.id} value={m.id}>{m.kode} — {m.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            {i === 0 && <label className="form-label">Qty</label>}
            <input className="form-input" type="number" step="0.0001" min="0" value={row.qty} onChange={e => updateBomRow(i, 'qty', e.target.value)} placeholder="2" />
          </div>
          <div className="form-group">
            {i === 0 && <label className="form-label">Unit</label>}
            <select className="form-input" value={row.unit} onChange={e => updateBomRow(i, 'unit', e.target.value)}>
              <option value="m">m (roll)</option>
              <option value="pce">pce</option>
              <option value="set">set</option>
            </select>
          </div>
          <button
            className="btn btn-d btn-sm"
            style={{ padding: '7px', marginTop: i === 0 ? '20px' : 0 }}
            onClick={() => removeBomRow(i)}
          >✕</button>
        </div>
      ))}

      {error && <div className="alert alert-danger" style={{ marginBottom: '12px' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <button className="btn btn-p" onClick={handleSubmit} disabled={saving}>
          {saving ? 'Menyimpan...' : 'Simpan Spesifikasi'}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Batal</button>
      </div>
    </div>
  )
}

export function SpecPage() {
  const qc = useQueryClient()
  const [activeFilter, setActiveFilter] = useState('Semua')
  const [showAddForm, setShowAddForm] = useState(false)

  const { data: specsData, isLoading } = useQuery({
    queryKey: ['tyre-specs'],
    queryFn: () => getTyreSpecs({ page_size: '200' }),
  })
  const { data: materialsData } = useQuery({
    queryKey: ['materials'],
    queryFn: () => getMaterials({ page_size: '100' }),
  })

  const deactivateSpec = useMutation({
    mutationFn: deactivateTyreSpec,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tyre-specs'] }),
  })

  const specs = specsData?.results ?? []
  const materials = materialsData?.results ?? []

  const filtered = specs.filter(s => {
    if (activeFilter === 'Semua') return true
    if (activeFilter === 'CUSTOM') return s.is_custom
    return s.variant === activeFilter
  })

  const customCount = specs.filter(s => s.is_custom).length
  const allMaterialIds = new Set(specs.flatMap(s => (s.bom_items ?? []).map(b => b.material)))

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }}>Spesifikasi Tyre</h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
            Bill of Material dan kalkulasi roll per ukuran ban
          </p>
        </div>
        <button className="btn btn-p" onClick={() => setShowAddForm(s => !s)}>
          <Plus size={14} />
          {showAddForm ? 'Tutup Form' : 'Tambah Ukuran Baru'}
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <AddTyreForm materials={materials} onClose={() => setShowAddForm(false)} />
      )}

      {/* Filter Pills */}
      <div className="filter-pills" style={{ marginBottom: '14px' }}>
        {FILTER_OPTIONS.map(f => (
          <button
            key={f}
            className={`filter-pill ${activeFilter === f ? 'active' : ''}`}
            onClick={() => setActiveFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Summary Metrics */}
      <div className="metrics-grid" style={{ marginBottom: '16px' }}>
        <div className="metric-card">
          <div className="metric-value">{specs.length}</div>
          <div className="metric-label">Total Ukuran</div>
        </div>
        <div className="metric-card">
          <div className="metric-value" style={{ color: 'var(--color-accent-success)' }}>{customCount}</div>
          <div className="metric-label">Custom</div>
        </div>
        <div className="metric-card">
          <div className="metric-value" style={{ color: 'var(--color-text-info)' }}>{filtered.length}</div>
          <div className="metric-label">Tampil</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{allMaterialIds.size}</div>
          <div className="metric-label">Total Material</div>
        </div>
      </div>

      {/* Tyre Cards */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>
          Memuat spesifikasi...
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          Tidak ada spesifikasi untuk filter ini
        </div>
      ) : (
        filtered.map(spec => (
          <TyreCard
            key={spec.id}
            spec={spec}
            onDeactivate={() => deactivateSpec.mutate(spec.id)}
          />
        ))
      )}
    </div>
  )
}
