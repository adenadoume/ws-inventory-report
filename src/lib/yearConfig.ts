const STORAGE_KEY = 'ws_year_config'

export interface YearConfig {
  newYear: number
  oldYear: number
}

const DEFAULTS: YearConfig = { newYear: 2025, oldYear: 2024 }

export function getYearConfig(): YearConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {}
  return { ...DEFAULTS }
}

export function setYearConfig(config: Partial<YearConfig>): void {
  const current = getYearConfig()
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...config }))
}

export function getNewYearTableName(base: 'sales' | 'buys'): string {
  return `ws_${base}_${getYearConfig().newYear}`
}
