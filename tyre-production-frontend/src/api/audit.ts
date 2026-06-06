import api from './client'

export interface AuditLogEntry {
  id: number
  username: string
  action: string
  model_name: string
  object_id: string
  object_repr: string
  detail: Record<string, unknown>
  ip_address: string | null
  created_at: string
}

export interface PaginatedAuditLog {
  count: number
  next: string | null
  previous: string | null
  results: AuditLogEntry[]
}

export async function getAuditLogs(params?: {
  page?: number
  action?: string
  model_name?: string
  search?: string
}): Promise<PaginatedAuditLog> {
  const { data } = await api.get('/auth/audit-logs/', { params })
  return data
}
