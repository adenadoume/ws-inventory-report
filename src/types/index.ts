export interface InventoryItem {
  id: string
  code: string
  description: string
  supplier: string
  q_2024: number | null
  cost_2024: number | null
  q_2025: number | null
  cost_2025: number | null
  status: 'same' | 'changed' | 'missing' | 'new'
  qty_changed: 0 | 1
  cost_changed: 0 | 1
}

export interface SalesItem {
  id: string
  code: string
  description: string
  supplier: string
  qty_sold: number
  value_sold: number
  uploaded_at: string
}

export interface BuysItem {
  id: string
  code: string
  description: string
  supplier: string
  qty_bought: number
  value_bought: number
  uploaded_at: string
}

export interface UploadHistory {
  id: string
  table_name: string
  filename: string
  row_count: number
  uploaded_at: string
  uploaded_by: string
}

export type TabView = 'apografi' | 'formula' | 'agores' | 'poliseis'

export type FilterStatus = 'all' | 'missing' | 'new' | 'changed' | 'same'

export type SortMode = 'code' | 'cost' | 'diff-desc' | 'diff-asc'
