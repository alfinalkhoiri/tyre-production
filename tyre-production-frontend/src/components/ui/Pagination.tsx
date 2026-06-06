interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null

  const pages: (number | '...')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }

  const btnStyle = (active: boolean, disabled = false): React.CSSProperties => ({
    padding: '6px 12px',
    border: `1px solid ${active ? '#2563eb' : '#e5e7eb'}`,
    borderRadius: '6px',
    background: active ? '#2563eb' : disabled ? '#f9fafb' : '#fff',
    color: active ? '#fff' : disabled ? '#d1d5db' : '#374151',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '13px',
    fontWeight: active ? 600 : 400,
    minWidth: '36px',
    textAlign: 'center' as const,
  })

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 0', marginTop: '8px',
    }}>
      <span style={{ fontSize: '12px', color: '#6b7280' }}>
        {total} data · halaman {page} dari {totalPages}
      </span>
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        <button
          style={btnStyle(false, page === 1)}
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        >
          ←
        </button>
        {pages.map((p, i) =>
          p === '...'
            ? <span key={`dots-${i}`} style={{ padding: '0 4px', color: '#9ca3af' }}>…</span>
            : <button key={p} style={btnStyle(p === page)} onClick={() => onPageChange(p as number)}>{p}</button>
        )}
        <button
          style={btnStyle(false, page === totalPages)}
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          →
        </button>
      </div>
    </div>
  )
}
