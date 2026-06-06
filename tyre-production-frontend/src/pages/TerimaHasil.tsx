import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, CheckCircle } from 'lucide-react'
import { getOrders, completeOrder, getDeliveries, getOrderProgress } from '@/api/production'
import type { ProductionOrder } from '@/types'

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function ProgressBar({ value, max, color = 'var(--color-accent-success)' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div style={{ height: 6, background: 'var(--color-background-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.3s' }} />
    </div>
  )
}

function ResultCard({ order, onRefresh }: { order: ProductionOrder; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const qc = useQueryClient()

  const completeMut = useMutation({
    mutationFn: () => completeOrder(order.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders-terima'] })
      onRefresh()
    },
  })

  const { data: progress } = useQuery({
    queryKey: ['order-progress-terima', order.id],
    queryFn: () => getOrderProgress(order.id),
    enabled: expanded,
  })

  const { data: deliveries = [] } = useQuery({
    queryKey: ['deliveries-terima', order.id],
    queryFn: () => getDeliveries(order.id),
    enabled: expanded,
  })

  const tyreProgress = progress?.tyre_progress ?? []
  const totalDelivered = tyreProgress.reduce((s, p) => s + p.delivered, 0)
  const totalPlanned = tyreProgress.reduce((s, p) => s + p.planned, 0)
  const items = order.items ?? []

  const statusLabel = order.status === 'RESULT_SENT' ? 'Hasil Dikirim' : 'Selesai'
  const statusCls = order.status === 'RESULT_SENT' ? 'chip-info' : 'chip-success'

  return (
    <div className="card" style={{ padding: '14px 16px', marginBottom: '8px' }}>
      <div className="collapsible-header" onClick={() => setExpanded(e => !e)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
          <span style={{ fontWeight: 700, fontSize: '14px' }}>{order.number}</span>
          <span className={`chip ${statusCls}`} style={{ fontSize: 11 }}>{statusLabel}</span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            {formatDate(order.date)} · {order.shift_display} · {order.pic}
          </span>
          {totalPlanned > 0 && (
            <span className="chip chip-neutral" style={{ fontSize: 10 }}>
              {totalDelivered}/{totalPlanned} ban
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {order.status === 'RESULT_SENT' && (
            <button
              className="btn btn-g btn-sm"
              onClick={e => { e.stopPropagation(); completeMut.mutate() }}
              disabled={completeMut.isLoading}
            >
              <CheckCircle size={13} />
              {completeMut.isLoading ? '...' : 'Tandai Selesai'}
            </button>
          )}
          {expanded ? <ChevronDown size={15} color="#9ca3af" /> : <ChevronRight size={15} color="#9ca3af" />}
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--color-border-tertiary)', paddingTop: 12 }}>
          {/* Target items */}
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

          {/* Tyre delivery progress */}
          {tyreProgress.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>
                Hasil Produksi
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tyreProgress.map(p => {
                  const done = p.delivered >= p.planned
                  return (
                    <div key={`${p.size}|${p.model}`}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                        <span style={{ fontWeight: 600 }}>{p.size} <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>{p.model} {p.variant}</span></span>
                        <span style={{ color: done ? 'var(--color-text-success)' : 'var(--color-text-secondary)', fontWeight: 700 }}>
                          {p.delivered} / {p.planned} ban {done ? '✓' : ''}
                        </span>
                      </div>
                      <ProgressBar value={p.delivered} max={p.planned} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Delivery records */}
          {deliveries.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>Detail Kiriman</div>
              {deliveries.map(d => (
                <div key={d.id} style={{ border: '1px solid var(--color-border-success)', background: 'var(--color-background-success)', borderRadius: 6, padding: '8px 12px', fontSize: 12, marginBottom: 4 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    {formatDate(d.date)}
                    {d.note && <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}> — {d.note}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
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

          {order.status === 'DONE' && (
            <div className="alert alert-success" style={{ fontSize: 12 }}>
              Order selesai. Total {totalDelivered} ban diterima dari produksi.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function TerimaHasil() {
  const [tab, setTab] = useState<'pending' | 'done'>('pending')

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['orders-terima'],
    queryFn: () => getOrders({ page_size: '100' }),
  })

  const allOrders = ordersData?.results ?? []
  const pendingOrders = allOrders.filter(o => o.status === 'RESULT_SENT')
  const doneOrders = allOrders.filter(o => o.status === 'DONE')
  const qc = useQueryClient()

  const displayOrders = tab === 'pending' ? pendingOrders : doneOrders

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 2px' }}>Terima Hasil Produksi</h1>
        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: 0 }}>
          Terima dan konfirmasi hasil tyre dari produksi
        </p>
      </div>

      <div className="metrics-grid" style={{ marginBottom: '14px' }}>
        {[
          { label: 'Menunggu Terima', value: pendingOrders.length, color: 'var(--color-text-info)' },
          { label: 'Selesai', value: doneOrders.length, color: 'var(--color-text-success)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="metric-card">
            <div className="metric-value" style={{ color }}>{value}</div>
            <div className="metric-label">{label}</div>
          </div>
        ))}
      </div>

      <div className="sub-tabs" style={{ marginBottom: '14px' }}>
        <button className={`sub-tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>
          Menunggu Terima {pendingOrders.length > 0 && <span className="chip chip-info" style={{ marginLeft: 4, fontSize: 10 }}>{pendingOrders.length}</span>}
        </button>
        <button className={`sub-tab ${tab === 'done' ? 'active' : ''}`} onClick={() => setTab('done')}>
          Riwayat Selesai ({doneOrders.length})
        </button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>Memuat...</div>
      ) : displayOrders.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>{tab === 'pending' ? '⏳' : '✅'}</div>
          <p style={{ margin: 0, fontWeight: 600 }}>
            {tab === 'pending' ? 'Tidak ada hasil yang menunggu' : 'Belum ada order selesai'}
          </p>
        </div>
      ) : displayOrders.map(order => (
        <ResultCard
          key={order.id}
          order={order}
          onRefresh={() => qc.invalidateQueries({ queryKey: ['orders-terima'] })}
        />
      ))}
    </div>
  )
}
