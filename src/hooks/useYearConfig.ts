import { useState, useCallback } from 'react'
import { getYearConfig, setYearConfig, type YearConfig } from '../lib/yearConfig'

export function useYearConfig() {
  const [config, setConfig] = useState<YearConfig>(getYearConfig)

  const update = useCallback((changes: Partial<YearConfig>) => {
    setYearConfig(changes)
    setConfig(getYearConfig())
  }, [])

  return { newYear: config.newYear, oldYear: config.oldYear, update }
}
