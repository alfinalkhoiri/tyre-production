import api from './client'
import type { UsageSummary, DailyTrend } from '@/types'

export const getUsageSummary = (params: Record<string, string>) =>
  api.get<{ count: number; results: UsageSummary[] }>('/production/analytics/material-usage/', { params }).then(r => r.data)

export const getDailyTrend = (params: Record<string, string>) =>
  api.get<{ results: DailyTrend[] }>('/production/analytics/daily-trend/', { params }).then(r => r.data)
