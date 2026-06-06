import * as Dialog from '@radix-ui/react-dialog'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'default'
  loading?: boolean
  onConfirm: () => void
}

const VARIANT = {
  danger:  { btn: '#dc2626', hover: '#b91c1c', icon: '🗑️' },
  warning: { btn: '#d97706', hover: '#b45309', icon: '⚠️' },
  default: { btn: '#2563eb', hover: '#1d4ed8', icon: '✔️' },
}

export function ConfirmDialog({
  open, onOpenChange,
  title, description,
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  variant = 'default',
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const v = VARIANT[variant]

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(2px)',
            zIndex: 1000,
          }}
        />
        <Dialog.Content
          style={{
            position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            background: '#fff',
            borderRadius: '14px',
            padding: '28px',
            width: '100%',
            maxWidth: '400px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            zIndex: 1001,
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>{v.icon}</div>
            <Dialog.Title style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>
              {title}
            </Dialog.Title>
            {description && (
              <Dialog.Description style={{ fontSize: '13px', color: '#6b7280', margin: 0, lineHeight: 1.6 }}>
                {description}
              </Dialog.Description>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <Dialog.Close asChild>
              <button
                disabled={loading}
                style={{
                  flex: 1, padding: '10px',
                  background: '#f3f4f6', border: '1px solid #e5e7eb',
                  borderRadius: '8px', cursor: 'pointer',
                  fontSize: '13px', fontWeight: 500, color: '#374151',
                }}
              >
                {cancelLabel}
              </button>
            </Dialog.Close>
            <button
              onClick={onConfirm}
              disabled={loading}
              style={{
                flex: 1, padding: '10px',
                background: loading ? '#9ca3af' : v.btn,
                border: 'none', borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '13px', fontWeight: 600, color: '#fff',
              }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = v.hover }}
              onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = v.btn }}
            >
              {loading ? 'Memproses...' : confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
