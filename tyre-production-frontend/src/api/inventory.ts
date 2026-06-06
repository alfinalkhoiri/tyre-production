import api from './client'
import type { PaginatedResponse, StockTransaction } from '@/types'

export const getTransactions = (params?: Record<string, string>) =>
  api.get<PaginatedResponse<StockTransaction>>('/inventory/transactions/', { params }).then(r => r.data)

export const createTransaction = (data: {
  material: number; type: string; qty: number; reference?: string; date: string
}) => api.post<StockTransaction>('/inventory/transactions/', data).then(r => r.data)
