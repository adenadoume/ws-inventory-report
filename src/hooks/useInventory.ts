import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { InventoryItem } from '../types'

export function useInventory(refreshKey = 0) {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      // Supabase returns max 1000 rows per request — paginate
      const all: InventoryItem[] = []
      let from = 0
      const PAGE = 1000
      while (true) {
        const { data, error: err } = await supabase
          .from('ws_inventory_items')
          .select('*')
          .range(from, from + PAGE - 1)
          .order('code', { ascending: true })
        if (err) {
          if (!cancelled) { setError(err.message); setItems([]); setLoading(false) }
          return
        }
        if (!data || data.length === 0) break
        all.push(...(data as InventoryItem[]))
        if (data.length < PAGE) break
        from += PAGE
      }
      if (!cancelled) { setItems(all); setError(null); setLoading(false) }
    }
    load().catch(e => {
      if (!cancelled) { setError(String(e)); setItems([]); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [refreshKey])

  return { items, loading, error }
}
