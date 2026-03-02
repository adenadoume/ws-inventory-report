import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { BuysItem } from '../types'

export function useBuys(refreshKey = 0) {
  const [items, setItems] = useState<BuysItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const all: BuysItem[] = []
      let from = 0
      while (true) {
        const { data } = await supabase
          .from('buys_2025')
          .select('*')
          .range(from, from + 999)
          .order('code', { ascending: true })
        if (!data || data.length === 0) break
        all.push(...(data as BuysItem[]))
        if (data.length < 1000) break
        from += 1000
      }
      if (!cancelled) { setItems(all); setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [refreshKey])

  return { items, loading }
}
