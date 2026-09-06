import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileSpreadsheet, FileText, Printer } from 'lucide-react'
import { getProdStock } from '@/api/production'
import { SkeletonTable } from '@/components/ui/Skeleton'
import type { ProdStockItem } from '@/types'

// Versi cetak/ekspor dari data yang sama dengan StokProdPage.tsx (rumus
// status disamakan persis) — lihat komentar lebih lengkap di ReportStokPage.tsx
// (halaman kembarannya untuk stok gudang), pola & alasan desainnya sama.
// `received`/`used`/`balance` datang langsung dari backend (action `prod_stock`
// di production/views.py) — sudah dihitung server, di sini cuma menentukan
// LABEL status-nya dari angka tersebut.

function formatNum(n: number, d = 2) {
  return n.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d })
}

type ProdStatus = 'TERSEDIA' | 'RENDAH' | 'KRITIS' | 'HABIS' | 'MINUS' | 'KOSONG'

function statusOf(r: ProdStockItem): ProdStatus {
  if (r.received === 0) return 'KOSONG'
  if (r.balance < 0) return 'MINUS'
  if (r.balance === 0) return 'HABIS'
  if (r.safety_stock > 0 && r.balance <= r.safety_stock * 0.5) return 'KRITIS'
  if (r.safety_stock > 0 && r.balance <= r.safety_stock) return 'RENDAH'
  return 'TERSEDIA'
}

const STATUS_CHIP: Record<ProdStatus, string> = {
  TERSEDIA: 'chip-success',
  RENDAH:   'chip-warning',
  KRITIS:   'chip-danger',
  HABIS:    'chip-neutral',
  MINUS:    'chip-danger',
  KOSONG:   'chip-neutral',
}
const STATUSES: ProdStatus[] = ['TERSEDIA', 'RENDAH', 'KRITIS', 'HABIS', 'MINUS', 'KOSONG']

export function ReportStokProdPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data = [], isLoading } = useQuery({
    queryKey: ['prod-stock-report'],
    queryFn: getProdStock,
  })

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return data
      .map(r => ({ r, status: statusOf(r) }))
      .filter(({ r }) => !q || r.kode.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))
      .filter(({ status }) => !statusFilter || status === statusFilter)
  }, [data, search, statusFilter])

  const printedAt = new Date().toLocaleString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  const fileStamp = new Date().toISOString().slice(0, 10)

  const exportExcel = async () => {
    const XLSX = await import('xlsx')
    const sheetData = rows.map(({ r, status }) => ({
      Kode: r.kode,
      'Nama Material': r.name,
      Unit: r.unit,
      Diterima: r.received,
      Terpakai: r.used,
      'Sisa Stok': r.balance,
      'Safety Stock': r.safety_stock,
      Status: status,
    }))
    const ws = XLSX.utils.json_to_sheet(sheetData)
    ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Stok Produksi')
    XLSX.writeFile(wb, `laporan-stok-produksi-${fileStamp}.xlsx`)
  }

  const exportPDF = async () => {
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(14)
    doc.text('Laporan Stok Produksi — TyreProd', 14, 14)
    doc.setFontSize(9)
    doc.setTextColor(100)
    doc.text(`Dicetak: ${printedAt}`, 14, 20)
    autoTable(doc, {
      startY: 26,
      head: [['Kode', 'Nama Material', 'Unit', 'Diterima', 'Terpakai', 'Sisa Stok', 'Safety Stock', 'Status']],
      body: rows.map(({ r, status }) => [
        r.kode, r.name, r.unit,
        formatNum(r.received), formatNum(r.used), formatNum(r.balance), formatNum(r.safety_stock), status,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
    })
    doc.save(`laporan-stok-produksi-${fileStamp}.pdf`)
  }

  const handlePrint = () => window.print()

  return (
    <div>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 2px' }}>Report Stok Produksi</h1>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>
            Laporan sisa material di lini produksi — ekspor atau cetak sesuai kebutuhan
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-g btn-sm" onClick={exportExcel} disabled={rows.length === 0}>
            <FileSpreadsheet size={13} /> Export Excel
          </button>
          <button className="btn btn-d btn-sm" onClick={exportPDF} disabled={rows.length === 0}>
            <FileText size={13} /> Export PDF
          </button>
          <button className="btn btn-b btn-sm" onClick={handlePrint} disabled={rows.length === 0}>
            <Printer size={13} /> Print
          </button>
        </div>
      </div>

      <div className="no-print" style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          className="form-input" style={{ width: 220 }}
          placeholder="Cari kode/nama material..."
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <select className="form-input" style={{ width: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Semua status</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="print-only" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: '0 0 4px' }}>Laporan Stok Produksi — TyreProd</h2>
        <div style={{ fontSize: 12, color: '#555' }}>Dicetak: {printedAt} · {rows.length} material</div>
      </div>

      {isLoading ? (
        <SkeletonTable rows={8} cols={8} />
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--color-border-primary)', borderRadius: 10 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama Material</th>
                <th>Unit</th>
                <th style={{ textAlign: 'right' }}>Diterima</th>
                <th style={{ textAlign: 'right' }}>Terpakai</th>
                <th style={{ textAlign: 'right' }}>Sisa Stok</th>
                <th style={{ textAlign: 'right' }}>Safety Stock</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>Tidak ada data</td></tr>
              )}
              {rows.map(({ r, status }) => (
                <tr key={r.material_id}>
                  <td style={{ fontWeight: 600 }}>{r.kode}</td>
                  <td style={{ color: 'var(--color-text-secondary)' }}>{r.name}</td>
                  <td><span className="chip chip-neutral">{r.unit}</span></td>
                  <td style={{ textAlign: 'right' }}>{formatNum(r.received)}</td>
                  <td style={{ textAlign: 'right', color: r.used > r.received ? 'var(--color-text-danger)' : undefined }}>
                    {formatNum(r.used)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color:
                    r.balance < 0 ? 'var(--color-text-danger)'
                    : r.safety_stock > 0 && r.balance <= r.safety_stock ? 'var(--color-text-warning)'
                    : r.balance === 0 ? 'var(--color-text-secondary)'
                    : 'var(--color-text-success)'
                  }}>
                    {formatNum(r.balance)}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--color-text-secondary)' }}>
                    {r.safety_stock > 0 ? formatNum(r.safety_stock) : '—'}
                  </td>
                  <td><span className={`chip ${STATUS_CHIP[status]}`}>{status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
