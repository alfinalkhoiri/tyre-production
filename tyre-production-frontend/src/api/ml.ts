import api from './client'
import type { EstimateResponse, EstimateItem } from '@/types'

export const getEstimates = (horizon = 7) =>
  api.get<EstimateResponse>('/ml/forecast/', { params: { horizon } }).then(r => r.data)

export const getMaterialEstimate = (materialId: number, horizon = 7) =>
  api.get<EstimateItem>(`/ml/forecast/${materialId}/`, { params: { horizon } }).then(r => r.data)
