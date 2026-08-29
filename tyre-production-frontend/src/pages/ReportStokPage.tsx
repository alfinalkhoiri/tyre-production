import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileSpreadsheet, FileText, Printer } from 'lucide-react'
import { getMaterials } from '@/api/spec'
import { SkeletonTable } from '@/components/ui/Skeleton'
import type { Material } from '@/types'

function formatNum(n: number, d = 2) {
  return n.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d })
}

function computeRow(m: Material) {
  const stock     = parseFloat(m.stock)
  const locked    = parseFloat(m.locked_qty ?? '0')
  const available = stock - locked
  const safety    = parseFloat(m.safety_stock)
  const status    = available >= safety ? 'AMAN' : available >= safety * 0.5 ? 'RENDAH' : 'KRITIS'
  return { stock, locked, available, safety, status }
}

const STATUS_CHIP: Record<string, string> = { AMAN: 'chip-success', RENDAH: 'chip-warning', KRITIS: 'chip-danger' }

export function ReportStokPage() {
  const [search, setSearch]   = useState('')
  const [category, setCategory] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['materials-report'],
    queryFn: () => getMaterials({ page_size: '500' }),
  })

  const materials = data?.results ?? []
  const categories = useMemo(
    () => Array.from(new Set(materials.map(m => m.category || 'Umum'))).sort(),
    [materials]
  )

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return materials
      .map(m => ({ m, ...computeRow(m) }))
      .filter(({ m }) => !q || m.kode.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
      .filter(({ m }) => !category || (m.category || 'Umum') === category)
      .filter(({ status }) => !statusFilter || status === statusFilter)
  }, [materials, search, category, statusFilter])

  const printedAt = new Date().toLocaleString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  const fileStamp = new Date().toISOString().slice(0, 10)

  const exportExcel = async () => {
    const XLSX = await import('xlsx')
    const sheetData = rows.map(({ m, stock, locked, available, safety, status }) => ({
      Kode: m.kode,
      'Nama Material': m.name,
      Kategori: m.category || 'Umum',
      Unit: m.unit,
      'Stok Gudang': stock,
      Dikunci: locked,
      Tersedia: available,
      Safety: safety,
      Status: status,
    }))
    const ws = XLSX.utils.json_to_sheet(sheetData)
    ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Stok Material')
    XLSX.writeFile(wb, `laporan-stok-material-${fileStamp}.xlsx`)
  }

  const exportPDF = async () => {
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(14)
    doc.text('Laporan Stok Material — TyreProd', 14, 14)
    doc.setFontSize(9)
    doc.setTextColor(100)
    doc.text(`Dicetak: ${printedAt}`, 14, 20)
    autoTable(doc, {
      startY: 26,
      head: [['Kode', 'Nama Material', 'Kategori', 'Unit', 'Stok Gudang', 'Dikunci', 'Tersedia', 'Safety', 'Status']],
      body: rows.map(({ m, stock, locked, available, safety, status }) => [
        m.kode, m.name, m.category || 'Umum', m.unit,
        formatNum(stock), formatNum(locked), formatNum(available), formatNum(safety), status,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
    })
    doc.save(`laporan-stok-material-${fileStamp}.pdf`)
  }

  const handlePrint = () => window.print()

  return (
    <div>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 2px' }}>Report Stok Material</h1>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>
            Laporan stok gudang — ekspor atau cetak sesuai kebutuhan
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
        <select className="form-input" style={{ width: 170 }} value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">Semua kategori</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="form-input" style={{ width: 150 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Semua status</option>
          <option value="AMAN">Aman</option>
          <option value="RENDAH">Rendah</option>
          <option value="KRITIS">Kritis</option>
        </select>
      </div>

      <div className="print-only" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: '0 0 4px' }}>Laporan Stok Material — TyreProd</h2>
        <div style={{ fontSize: 12, color: '#555' }}>Dicetak: {printedAt} · {rows.length} material</div>
      </div>

      {isLoading ? (
        <SkeletonTable rows={8} cols={9} />
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--color-border-primary)', borderRadius: 10 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama Material</th>
                <th>Kategori</th>
                <th>Unit</th>
                <th style={{ textAlign: 'right' }}>Stok Gudang</th>
                <th style={{ textAlign: 'right' }}>Dikunci</th>
                <th style={{ textAlign: 'right' }}>Tersedia</th>
                <th style={{ textAlign: 'right' }}>Safety</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>Tidak ada data</td></tr>
              )}
              {rows.map(({ m, stock, locked, available, safety, status }) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{m.kode}</td>
                  <td style={{ color: 'var(--color-text-secondary)' }}>{m.name}</td>
                  <td>{m.category || 'Umum'}</td>
                  <td><span className="chip chip-neutral">{m.unit}</span></td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatNum(stock)}</td>
                  <td style={{ textAlign: 'right', color: locked > 0 ? 'var(--color-text-warning)' : 'var(--color-text-secondary)' }}>
                    {locked > 0 ? formatNum(locked) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: available < 0 ? 'var(--color-text-danger)' : 'var(--color-text-success)' }}>
                    {formatNum(available)}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--color-text-secondary)' }}>{formatNum(safety)}</td>
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
