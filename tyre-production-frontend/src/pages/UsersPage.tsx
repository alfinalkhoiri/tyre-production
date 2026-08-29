import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, KeyRound, Trash2, Pencil } from 'lucide-react'
import { getUsers, createUser, updateUser, deleteUser, adminSetPassword, type ManagedUser } from '@/api/users'
import { useAuth, ROLE_LABEL, ROLE_COLOR, type Role } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/ui/Pagination'

const ROLES: Role[] = ['admin', 'purchasing', 'operator', 'viewer']

function RoleBadge({ role }: { role: Role }) {
  const c = ROLE_COLOR[role]
  return (
    <span style={{
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap',
    }}>
      {ROLE_LABEL[role]}
    </span>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card" style={{ width: 420, maxWidth: '95vw', padding: 22, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{title}</h3>
          <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }} onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function extractErrorDetail(err: unknown): string | undefined {
  const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data
  if (!data) return undefined
  if (typeof data.detail === 'string') return data.detail
  const flat = Object.values(data).flat().filter(Boolean)
  return flat.length ? flat.join(' ') : undefined
}

function extractErrorMessage(err: unknown, fallback: string): string {
  return extractErrorDetail(err) ?? fallback
}

// ── User Form Modal (create/edit) ──────────────────────────────────────────

function UserFormModal({ user, onClose, onSaved }: {
  user: ManagedUser | null // null = mode tambah
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!user
  const { success, error: toastError } = useToast()
  const [username, setUsername]   = useState(user?.username ?? '')
  const [email, setEmail]         = useState(user?.email ?? '')
  const [firstName, setFirstName] = useState(user?.first_name ?? '')
  const [lastName, setLastName]   = useState(user?.last_name ?? '')
  const [password, setPassword]   = useState('')
  const [role, setRole]           = useState<Role>(user?.role ?? 'viewer')
  const [error, setError]         = useState('')
  const [saving, setSaving]       = useState(false)

  const save = async () => {
    if (!username) { setError('Username wajib diisi'); return }
    if (!isEdit && password.length < 8) { setError('Password minimal 8 karakter'); return }
    setSaving(true); setError('')
    try {
      if (isEdit) {
        await updateUser(user!.id, { username, email, first_name: firstName, last_name: lastName, role })
        success('User diperbarui', `${username} berhasil diperbarui`)
      } else {
        await createUser({ username, email, password, first_name: firstName, last_name: lastName, role })
        success('User dibuat', `${username} berhasil ditambahkan`)
      }
      onSaved()
    } catch (err) {
      const msg = extractErrorMessage(err, isEdit ? 'Gagal memperbarui user' : 'Gagal membuat user')
      setError(msg)
      toastError(isEdit ? 'Gagal memperbarui user' : 'Gagal membuat user')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={isEdit ? `Edit User — ${user!.username}` : 'Tambah User'} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="form-group">
          <label className="form-label">Username *</label>
          <input className="form-input" value={username} onChange={e => setUsername(e.target.value)} disabled={isEdit} />
        </div>
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="form-group">
            <label className="form-label">Nama Depan</label>
            <input className="form-input" value={firstName} onChange={e => setFirstName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Nama Belakang</label>
            <input className="form-input" value={lastName} onChange={e => setLastName(e.target.value)} />
          </div>
        </div>
        {!isEdit && (
          <div className="form-group">
            <label className="form-label">Password *</label>
            <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimal 8 karakter" />
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Role *</label>
          <select className="form-input" value={role} onChange={e => setRole(e.target.value as Role)}>
            {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </div>
      </div>
      {error && <div className="alert alert-danger" style={{ marginTop: 10, fontSize: 12 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="btn btn-p btn-sm" onClick={save} disabled={saving}>
          {saving ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Tambah User'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Batal</button>
      </div>
    </Modal>
  )
}

// ── Reset Password Modal ────────────────────────────────────────────────────

function ResetPasswordModal({ user, onClose }: { user: ManagedUser; onClose: () => void }) {
  const { success, error: toastError } = useToast()
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [saving, setSaving]     = useState(false)

  const save = async () => {
    if (password.length < 8) { setError('Password minimal 8 karakter'); return }
    setSaving(true); setError('')
    try {
      await adminSetPassword(user.id, password)
      success('Password diubah', `Password ${user.username} berhasil direset`)
      onClose()
    } catch (err) {
      setError(extractErrorMessage(err, 'Gagal mengubah password'))
      toastError('Gagal mereset password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Reset Password — ${user.username}`} onClose={onClose}>
      <div className="form-group">
        <label className="form-label">Password Baru *</label>
        <input
          className="form-input" type="password" value={password} autoFocus
          onChange={e => setPassword(e.target.value)} placeholder="Minimal 8 karakter"
        />
      </div>
      {error && <div className="alert alert-danger" style={{ marginTop: 10, fontSize: 12 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="btn btn-p btn-sm" onClick={save} disabled={saving}>
          {saving ? 'Menyimpan...' : 'Reset Password'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Batal</button>
      </div>
    </Modal>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function UsersPage() {
  const { user: me } = useAuth()
  const qc = useQueryClient()
  const { success, error: toastError } = useToast()
  const [page, setPage]         = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing]   = useState<ManagedUser | null>(null)
  const [resetting, setResetting] = useState<ManagedUser | null>(null)
  const [deleting, setDeleting] = useState<ManagedUser | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['users', page],
    queryFn: () => getUsers({ page }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      success('User dihapus')
      setDeleting(null)
    },
    onError: (err: unknown) => {
      toastError('Gagal menghapus user', extractErrorDetail(err))
      setDeleting(null)
    },
  })

  const users = data?.results ?? []

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 2px' }}>Kelola User</h1>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0 }}>
            Buat user baru, ubah role, dan reset password
          </p>
        </div>
        <button className="btn btn-p btn-sm" onClick={() => setShowCreate(true)}>
          <Plus size={13} /> Tambah User
        </button>
      </div>

      {isLoading ? (
        <SkeletonTable rows={5} cols={5} />
      ) : (
        <>
          <div style={{ overflowX: 'auto', border: '1px solid var(--color-border-primary)', borderRadius: 10 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Nama</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th style={{ width: 160 }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>Tidak ada user</td></tr>
                )}
                {users.map(u => {
                  const isMe = u.id === me?.id
                  return (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>
                        {u.username}
                        {isMe && <span className="chip chip-neutral" style={{ fontSize: 10, marginLeft: 6 }}>Kamu</span>}
                      </td>
                      <td>{[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}</td>
                      <td style={{ color: 'var(--color-text-secondary)' }}>{u.email || '—'}</td>
                      <td><RoleBadge role={u.role} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" title="Edit" onClick={() => setEditing(u)}>
                            <Pencil size={13} />
                          </button>
                          <button className="btn btn-ghost btn-sm" title="Reset Password" onClick={() => setResetting(u)}>
                            <KeyRound size={13} />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            title={isMe ? 'Tidak bisa menghapus akun sendiri' : 'Hapus'}
                            disabled={isMe}
                            onClick={() => setDeleting(u)}
                          >
                            <Trash2 size={13} color={isMe ? '#d1d5db' : '#dc2626'} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {data && <Pagination page={page} pageSize={20} total={data.count} onPageChange={setPage} />}
        </>
      )}

      {showCreate && (
        <UserFormModal
          user={null}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['users'] }) }}
        />
      )}
      {editing && (
        <UserFormModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ['users'] }) }}
        />
      )}
      {resetting && (
        <ResetPasswordModal user={resetting} onClose={() => setResetting(null)} />
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={open => { if (!open) setDeleting(null) }}
        title={`Hapus user ${deleting?.username}?`}
        description="Aksi ini tidak dapat dibatalkan."
        confirmLabel="Ya, Hapus"
        variant="danger"
        loading={deleteMut.isLoading}
        onConfirm={() => deleting && deleteMut.mutate(deleting.id)}
      />
    </div>
  )
}
