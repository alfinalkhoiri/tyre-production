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
  roll_length: string
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
  received: number
  used: number
  balance: number
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

export interface ForecastPrediction {
  date: string
  shift: 1 | 2 | 3
  predicted_qty: number
  lower_bound: number
  upper_bound: number
}

export interface ForecastResponse {
  material_id: number
  material_kode: string
  material_name: string
  unit: string
  forecast_days: number
  predictions: ForecastPrediction[]
}

export interface ModelStatus {
  trained_materials: number[]
  feature_cols: string[]
  metrics: Record<string, {
    material_id: number
    material_kode: string
    n_samples: number
    mae_cv: number
    mae_train: number
    r2_train: number
  }>
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
