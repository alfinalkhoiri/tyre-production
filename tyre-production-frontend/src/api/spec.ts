import api from './client'
import type { PaginatedResponse, Material, TyreSpec, BOMItem } from '@/types'

export const getMaterials = (params?: Record<string, string>) =>
  api.get<PaginatedResponse<Material>>('/spec/materials/', { params }).then(r => r.data)

export const getTyreSpecs = (params?: Record<string, string>) =>
  api.get<PaginatedResponse<TyreSpec>>('/spec/tyre-specs/', { params }).then(r => r.data)

export const getTyreSpec = (id: number) =>
  api.get<TyreSpec>(`/spec/tyre-specs/${id}/`).then(r => r.data)

export const createTyreSpec = (data: Partial<TyreSpec>) =>
  api.post<TyreSpec>('/spec/tyre-specs/', data).then(r => r.data)

export const deactivateTyreSpec = (id: number) =>
  api.patch<TyreSpec>(`/spec/tyre-specs/${id}/`, { is_active: false })

export const deactivateMaterial = (id: number) =>
  api.patch<Material>(`/spec/materials/${id}/`, { is_active: false })

export const createBOMItem = (data: { tyre_spec: number; material: number; qty: string; unit: string }) =>
  api.post<BOMItem>('/spec/bom-items/', data).then(r => r.data)

export const updateMaterial = (id: number, data: Partial<Material>) =>
  api.patch<Material>(`/spec/materials/${id}/`, data).then(r => r.data)
