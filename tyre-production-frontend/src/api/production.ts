import api from './client'
import type { PaginatedResponse, ProductionOrder, MaterialShipment, TyreDelivery, MatProgress, TyreProgress, MaterialRequirement, ProdStockItem } from '@/types'

export const getOrders = (params?: Record<string, string>) =>
  api.get<PaginatedResponse<ProductionOrder>>('/production/orders/', { params }).then(r => r.data)

export const getOrder = (id: number) =>
  api.get<ProductionOrder>(`/production/orders/${id}/`).then(r => r.data)

export const createOrder = (data: {
  number: string; date: string; shift: string; pic: string; items?: { tyre_spec: number; qty_plan: number }[]
}) => api.post<ProductionOrder>('/production/orders/', data).then(r => r.data)

export const confirmOrder  = (id: number) => api.post(`/production/orders/${id}/confirm/`).then(r => r.data)
export const startOrder    = (id: number) => api.post(`/production/orders/${id}/start/`).then(r => r.data)
export const completeOrder = (id: number) => api.post(`/production/orders/${id}/done/`).then(r => r.data)

// Material shipments
export const getShipments = (orderId: number) =>
  api.get<MaterialShipment[]>(`/production/orders/${orderId}/shipments/`).then(r => r.data)

export const addShipment = (orderId: number, data: {
  date: string; note?: string; entries: { material: number; qty: number }[]
}) => api.post<{ shipment: MaterialShipment; order_status: string }>(
  `/production/orders/${orderId}/shipments/`, data
).then(r => r.data)

// Tyre deliveries
export const getDeliveries = (orderId: number) =>
  api.get<TyreDelivery[]>(`/production/orders/${orderId}/deliveries/`).then(r => r.data)

export const addDelivery = (orderId: number, data: {
  date: string; note?: string; entries: { tyre_spec: number; qty_actual: number }[]
}) => api.post<{ delivery: TyreDelivery; order_status: string }>(
  `/production/orders/${orderId}/deliveries/`, data
).then(r => r.data)

// Progress
export const getOrderProgress = (orderId: number) =>
  api.get<{ material_progress: MatProgress[]; tyre_progress: TyreProgress[] }>(
    `/production/orders/${orderId}/progress/`
  ).then(r => r.data)

// Requirements (ROLL/PCE units with stock check)
export const getRequirements = (orderId: number) =>
  api.get<{ requirements: MaterialRequirement[] }>(
    `/production/orders/${orderId}/requirements/`
  ).then(r => r.data)

// Production confirms receipt of a shipment
export const receiveMaterial = (orderId: number, shipmentId: number) =>
  api.post<{ order_status: string; shipment: import('@/types').MaterialShipment }>(
    `/production/orders/${orderId}/receive-material/`, { shipment_id: shipmentId }
  ).then(r => r.data)

export const getPendingShipments = () =>
  api.get<MaterialShipment[]>('/production/orders/pending-shipments/').then(r => r.data)

export const getProdStock = () =>
  api.get<ProdStockItem[]>('/production/orders/prod-stock/').then(r => r.data)

export const getDailyUsages = (params?: Record<string, string>) =>
  api.get<PaginatedResponse<import('@/types').DailyUsage>>('/production/daily-usages/', { params }).then(r => r.data)

export const createDailyUsage = (data: {
  date: string; shift: string; order?: number; note?: string;
  entries: { material: number; qty: number }[]
}) => api.post('/production/daily-usages/', data).then(r => r.data)

export const getOrderYield = (orderId: number) =>
  api.get<import('@/types').OrderYield>(`/production/orders/${orderId}/yield/`).then(r => r.data)

export const getSafetySuggestions = (params?: { days?: number; lead_time?: number }) =>
  api.get<import('@/types').SafetySuggestionsResponse>('/production/orders/safety-suggestions/', { params }).then(r => r.data)

export const getPendingCounts = () =>
  api.get<import('@/types').PendingCounts>('/production/orders/pending-counts/').then(r => r.data)
