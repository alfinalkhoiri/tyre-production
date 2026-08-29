import api from './client'
import type { Role } from '@/context/AuthContext'

export interface ManagedUser {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  is_staff: boolean
  role: Role
}

export interface PaginatedUsers {
  count: number
  next: string | null
  previous: string | null
  results: ManagedUser[]
}

export const getUsers = (params?: { page?: number }) =>
  api.get<PaginatedUsers>('/auth/users/', { params }).then(r => r.data)

export const createUser = (data: {
  username: string
  email?: string
  password: string
  first_name?: string
  last_name?: string
  role: Role
}) => api.post<ManagedUser>('/auth/register/', data).then(r => r.data)

export const updateUser = (id: number, data: Partial<{
  username: string
  email: string
  first_name: string
  last_name: string
  role: Role
}>) => api.patch<ManagedUser>(`/auth/users/${id}/`, data).then(r => r.data)

export const deleteUser = (id: number) =>
  api.delete(`/auth/users/${id}/`).then(r => r.data)

export const adminSetPassword = (id: number, new_password: string) =>
  api.post(`/auth/users/${id}/set-password/`, { new_password }).then(r => r.data)
