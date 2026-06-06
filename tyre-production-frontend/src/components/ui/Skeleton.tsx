interface SkeletonProps {
  width?: string | number
  height?: string | number
  borderRadius?: string | number
  style?: React.CSSProperties
}

export function Skeleton({ width = '100%', height = '16px', borderRadius = '6px', style }: SkeletonProps) {
  return (
    <div style={{
      width,
      height,
      borderRadius,
      background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
      ...style,
    }} />
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
      <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
        <div style={{ background: '#f9fafb', padding: '10px 16px', display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '16px' }}>
          {Array.from({ length: cols }).map((_, i) => <Skeleton key={i} height="14px" />)}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '16px', borderTop: '1px solid #f3f4f6' }}>
            {Array.from({ length: cols }).map((_, c) => <Skeleton key={c} height="14px" width={c === 0 ? '60%' : '80%'} />)}
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div style={{ background: '#fff', borderRadius: '10px', padding: '16px', border: '1px solid #e5e7eb' }}>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
      <Skeleton height="12px" width="40%" style={{ marginBottom: '8px' }} />
      <Skeleton height="28px" width="60%" style={{ marginBottom: '4px' }} />
      <Skeleton height="12px" width="30%" />
    </div>
  )
}
