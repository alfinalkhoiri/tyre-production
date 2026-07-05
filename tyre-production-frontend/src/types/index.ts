export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface Material {
  id: number
  kode: string
  name: string
  category: string
  unit: string
  stock: string
  safety_stock: string
  locked_qty: string
  roll_length: string
  is_active: boolean
}

export interface StockTransaction {
  id: number
  material: number
  material_kode?: string
  type: 'IN' | 'AUTO' | 'ADJ'
  qty: string
  stock_before: string
  stock_after: string
  reference: string
  date: string
  created_at: string
}

export interface BOMItem {
  id: number
  material: number
  material_detail: Material
  qty: string
  unit: string
  tyre_per_roll: number | null
  roll_per_100_tyre: number | null
}

export interface TyreSpec {
  id: number
  size: string
  model: string
  variant: string
  is_custom: boolean
  is_active: boolean
  bom_items?: BOMItem[]
}

export interface ProductionOrderItem {
  id: number
  tyre_spec: number
  tyre_spec_detail: TyreSpec
  qty_plan: number
}

export type OrderStatus = 'DRAFT' | 'CONFIRMED' | 'MAT_SENT' | 'IN_PROGRESS' | 'RESULT_SENT' | 'DONE'

export interface ProductionOrder {
  id: number
  number: string
  date: string
  shift: '1' | '2' | '3'
  shift_display: string
  pic: string
  status: OrderStatus
  status_display: string
  items?: ProductionOrderItem[]
}

export interface MaterialShipmentEntry {
  id: number
  material: number
  material_detail: Material
  qty: string
}

export interface MaterialShipment {
  id: number
  order: number
  order_number?: string
  date: string
  note: string
  confirmed: boolean
  confirmed_at: string | null
  entries: MaterialShipmentEntry[]
}

export interface ProdStockItem {
  material_id: number
  kode: string
  name: string
  unit: string
  safety_stock: number
  received: number
  used: number
  balance: number
}

export interface StockAlertItem {
  id: number
  kode: string
  name: string
  unit: string
  stock?: number
  balance?: number
  safety_stock: number
  pct?: number
  level: 'low' | 'critical'
}

export interface PurchasingAlerts {
  low_warehouse_stock: StockAlertItem[]
  low_prod_stock: StockAlertItem[]
  active_orders_count: number
  draft_orders_count: number
}

export interface TyreDeliveryEntry {
  id: number
  tyre_spec: number
  tyre_spec_detail: TyreSpec
  qty_actual: number
}

export interface TyreDelivery {
  id: number
  order: number
  date: string
  note: string
  entries: TyreDeliveryEntry[]
}

export interface MatProgress {
  kode: string
  name: string
  unit: string
  required: number
  shipped: number
  received: number
}

export interface MaterialRequirement {
  material_id: number
  kode: string
  name: string
  unit: string
  qty_needed: number
  stock: number
  locked: number
  available: number
  shortage: number
  is_short: boolean
}

export interface TyreProgress {
  size: string
  model: string
  variant: string
  planned: number
  delivered: number
}

export interface DailyUsageEntry {
  id: number
  material: number
  material_detail: Material
  qty: string
}

export interface DailyUsage {
  id: number
  date: string
  shift: string
  shift_display: string
  order: number | null
  order_number: string | null
  note: string
  entries: DailyUsageEntry[]
}

export interface UsageSummary {
  material_id: number
  material_kode: string
  total_qty: number
  avg_qty: number
  entry_count: number
}

export interface DailyTrend {
  period: string
  total_qty: number
  entry_count: number
}

export interface EstimateItem {
  material_id: number
  kode: string
  name: string
  unit: string
  current_stock: number
  safety_stock: number
  adc: number
  adc_7: number
  adc_14: number
  adc_30: number
  predicted_daily: number
  predicted_total: number
  days_remaining: number | null
  projected_stock: number
  status: 'aman' | 'perlu_pesan'
  suggested_order: number
}

export interface EstimateResponse {
  horizon: number
  total: number
  perlu_pesan: number
  estimates: EstimateItem[]
}

export interface YieldMaterial {
  material_id: number
  kode: string
  name: string
  unit: string
  expected: number
  actual: number
  waste: number
  yield_pct: number
  has_data: boolean
}

export interface OrderYield {
  order_id: number
  order_number: string
  total_planned: number
  total_delivered: number
  delivery_rate: number
  overall_yield: number
  has_usage_data: boolean
  materials: YieldMaterial[]
}

export interface SafetySuggestion {
  material_id: number
  kode: string
  name: string
  unit: string
  category: string
  current_safety_stock: number
  avg_daily: number
  std_daily: number
  suggested_safety_stock: number
  has_data: boolean
  diff: number
}

export interface SafetySuggestionsResponse {
  days_analyzed: number
  lead_time_days: number
  service_level: string
  suggestions: SafetySuggestion[]
}

export interface PendingCounts {
  pending_shipments: number
  result_sent: number
}

export interface AnalyticsWeekly {
  label: string
  week_start: string
  total_qty: number
}

export interface AnalyticsMonthly {
  label: string
  year: number
  month: number
  total_tyre: number
}

export interface AnalyticsTopMaterial {
  kode: string
  name: string
  unit: string
  total_qty: number
}

export interface AnalyticsOrderSummary {
  status: string
  label: string
  count: number
  pct: number
}

export interface AnalyticsData {
  usage_weekly: AnalyticsWeekly[]
  production_monthly: AnalyticsMonthly[]
  top_materials: AnalyticsTopMaterial[]
  order_summary: AnalyticsOrderSummary[]
  total_orders: number
  total_tyre_produced: number
  total_mat_shipments: number
  mat_pct: number
  total_tyre_delivered: number
  tyre_pct: number
  period_days: number
}
