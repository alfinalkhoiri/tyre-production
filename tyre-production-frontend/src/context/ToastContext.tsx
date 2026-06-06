import React, { createContext, useContext, useState, useCallback } from 'react'
import * as Toast from '@radix-ui/react-toast'

type ToastVariant = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: string
  title: string
  description?: string
  variant: ToastVariant
}

interface ToastContextType {
  toast: (title: string, options?: { description?: string; variant?: ToastVariant }) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  warning: (title: string, description?: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

const VARIANT_STYLES: Record<ToastVariant, { bg: string; border: string; icon: string; titleColor: string }> = {
  success: { bg: '#f0fdf4', border: '#86efac', icon: '✅', titleColor: '#15803d' },
  error:   { bg: '#fef2f2', border: '#fca5a5', icon: '❌', titleColor: '#dc2626' },
  warning: { bg: '#fffbeb', border: '#fcd34d', icon: '⚠️', titleColor: '#d97706' },
  info:    { bg: '#eff6ff', border: '#93c5fd', icon: 'ℹ️', titleColor: '#2563eb' },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = useCallback((
    title: string,
    { description, variant = 'info' }: { description?: string; variant?: ToastVariant } = {}
  ) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, title, description, variant }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const ctx: ToastContextType = {
    toast: addToast,
    success: (title, description) => addToast(title, { description, variant: 'success' }),
    error:   (title, description) => addToast(title, { description, variant: 'error' }),
    warning: (title, description) => addToast(title, { description, variant: 'warning' }),
  }

  return (
    <ToastContext.Provider value={ctx}>
      <Toast.Provider swipeDirection="right">
        {children}

        {toasts.map(t => {
          const s = VARIANT_STYLES[t.variant]
          return (
            <Toast.Root
              key={t.id}
              open
              onOpenChange={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              style={{
                background: s.bg,
                border: `1px solid ${s.border}`,
                borderRadius: '10px',
                padding: '12px 16px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                minWidth: '280px',
                maxWidth: '380px',
              }}
            >
              <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>{s.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Toast.Title style={{ fontWeight: 600, fontSize: '13px', color: s.titleColor, margin: 0 }}>
                  {t.title}
                </Toast.Title>
                {t.description && (
                  <Toast.Description style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>
                    {t.description}
                  </Toast.Description>
                )}
              </div>
              <Toast.Close
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#9ca3af', fontSize: '16px', padding: '0', lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                ×
              </Toast.Close>
            </Toast.Root>
          )
        })}

        <Toast.Viewport
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            zIndex: 9999,
            listStyle: 'none',
            margin: 0,
            padding: 0,
          }}
        />
      </Toast.Provider>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be inside ToastProvider')
  return ctx
}
