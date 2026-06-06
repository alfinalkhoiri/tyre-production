import React from 'react'

interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  State
> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return this.props.fallback

    return (
      <div style={{
        minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '12px', padding: '32px',
      }}>
        <div style={{ fontSize: '40px' }}>⚠️</div>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', margin: 0 }}>
          Terjadi Kesalahan
        </h3>
        <p style={{ fontSize: '13px', color: '#6b7280', margin: 0, textAlign: 'center', maxWidth: '400px' }}>
          {this.state.error?.message ?? 'Komponen mengalami error tak terduga.'}
        </p>
        <button
          onClick={() => this.setState({ hasError: false, error: null })}
          style={{
            padding: '8px 20px', background: '#2563eb', color: '#fff',
            border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
          }}
        >
          Coba Lagi
        </button>
      </div>
    )
  }
}
