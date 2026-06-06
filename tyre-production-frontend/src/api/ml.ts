import api from './client'
import type { ForecastResponse, ModelStatus } from '@/types'

export const getForecast = (material_id: number, forecast_days: number) =>
  api.post<ForecastResponse>('/ml/forecast/', { material_id, forecast_days }).then(r => r.data)

export const getModelStatus = () =>
  api.get<ModelStatus>('/ml/model-status/').then(r => r.data)
