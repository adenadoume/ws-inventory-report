import { supabase } from './supabase'
import type { InventoryItem } from '../types'
import type { ParsedInventoryRow } from './parseInventoryExcel'

function computeStatus(row: {
  q_2024: number | null
  cost_2024: number | null
  q_2025: number | null
  cost_2025: number | null
}): { status: InventoryItem['status']; qty_changed: 0 | 1; cost_changed: 0 | 1 } {
  const has24 = row.q_2024 != null
  const has25 = row.q_2025 != null
  if (!has24 && has25) return { status: 'new', qty_changed: 0, cost_changed: 0 }
  if (has24 && !has25) return { status: 'missing', qty_changed: 0, cost_changed: 0 }
  if (!has24 && !has25) return { status: 'same', qty_changed: 0, cost_changed: 0 }
  const qtyCh = row.q_2024 !== row.q_2025 ? 1 : 0
  const costCh = Number(row.cost_2024) !== Number(row.cost_2025) ? 1 : 0
  const status: InventoryItem['status'] = qtyCh || costCh ? 'changed' : 'same'
  return { status, qty_changed: qtyCh as 0 | 1, cost_changed: costCh as 0 | 1 }
}

const PAGE = 1000
const BATCH = 200
const statusBatch = 50

export async function applyInventoryYear(
  year: '2024' | '2025',
  parsed: ParsedInventoryRow[],
  filename?: string
): Promise<void> {
  const existing: InventoryItem[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('ws_inventory_items')
      .select('*')
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data?.length) break
    existing.push(...(data as InventoryItem[]))
    if (data.length < PAGE) break
    from += PAGE
  }

  const byCode = new Map<string, InventoryItem>()
  existing.forEach(i => byCode.set(i.code, i))

  const toUpdate: Partial<InventoryItem>[] = []
  const toInsert: Omit<InventoryItem, 'id'>[] = []

  for (const r of parsed) {
    const current = byCode.get(r.code)
    if (current) {
      const upd: Partial<InventoryItem> = {
        id: current.id,
        code: current.code,
        description: r.description || current.description,
        supplier: r.supplier || current.supplier,
        qty_changed: 0,
        cost_changed: 0,
        status: current.status,
      }
      if (year === '2024') {
        upd.q_2024 = r.qty
        upd.cost_2024 = r.value
        upd.q_2025 = current.q_2025
        upd.cost_2025 = current.cost_2025
      } else {
        upd.q_2024 = current.q_2024
        upd.cost_2024 = current.cost_2024
        upd.q_2025 = r.qty
        upd.cost_2025 = r.value
      }
      toUpdate.push(upd)
    } else {
      toInsert.push({
        code: r.code,
        description: r.description,
        supplier: r.supplier,
        q_2024: year === '2024' ? r.qty : null,
        cost_2024: year === '2024' ? r.value : null,
        q_2025: year === '2025' ? r.qty : null,
        cost_2025: year === '2025' ? r.value : null,
        status: year === '2024' ? 'missing' : 'new',
        qty_changed: 0,
        cost_changed: 0,
      })
    }
  }

  for (let i = 0; i < toInsert.length; i += BATCH) {
    const { error } = await supabase.from('ws_inventory_items').insert(toInsert.slice(i, i + BATCH))
    if (error) throw error
  }

  for (let i = 0; i < toUpdate.length; i += BATCH) {
    const batch = toUpdate.slice(i, i + BATCH)
    await Promise.all(batch.map(row => supabase.from('ws_inventory_items').update({
      description: row.description,
      supplier: row.supplier,
      q_2024: row.q_2024,
      cost_2024: row.cost_2024,
      q_2025: row.q_2025,
      cost_2025: row.cost_2025,
    }).eq('id', row.id)))
  }

  const all: InventoryItem[] = []
  from = 0
  while (true) {
    const { data, error } = await supabase
      .from('ws_inventory_items')
      .select('*')
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data?.length) break
    all.push(...(data as InventoryItem[]))
    if (data.length < PAGE) break
    from += PAGE
  }

  for (let i = 0; i < all.length; i += statusBatch) {
    const chunk = all.slice(i, i + statusBatch)
    await Promise.all(chunk.map(row => {
      const { status, qty_changed, cost_changed } = computeStatus(row)
      return supabase.from('ws_inventory_items').update({ status, qty_changed, cost_changed }).eq('id', row.id)
    }))
  }

  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('ws_upload_history').insert({
    table_name: 'ws_inventory_items',
    filename: filename ?? `${year}_import`,
    row_count: parsed.length,
    uploaded_by: user?.email ?? 'unknown',
    data_payload: parsed, // Save the exact uploaded snapshot
  })
}

/**
 * Apply both 2024 and 2025 data in one pass: merge by code, then upsert once.
 * Avoids "stuck" after first pass and ensures both panels get data.
 */
export async function applyInventoryMerge(
  parsed2024: ParsedInventoryRow[],
  parsed2025: ParsedInventoryRow[],
  filenameLabel?: string
): Promise<void> {
  const byCode24 = new Map(parsed2024.map(r => [r.code, r]))
  const byCode25 = new Map(parsed2025.map(r => [r.code, r]))
  const allCodes = [...new Set([...byCode24.keys(), ...byCode25.keys()])]

  // 1. Wipe existing table unconditionally. Inventory import is a complete snapshot update.
  await supabase.from('ws_inventory_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  const toInsert: Omit<InventoryItem, 'id'>[] = []

  for (const code of allCodes) {
    const r24 = byCode24.get(code)
    const r25 = byCode25.get(code)
    const desc = (r25 ?? r24)?.description ?? ''
    const supplier = (r25 ?? r24)?.supplier ?? ''
    const q_2024 = r24 ? r24.qty : null
    const cost_2024 = r24 ? r24.value : null
    const q_2025 = r25 ? r25.qty : null
    const cost_2025 = r25 ? r25.value : null

    let status: InventoryItem['status'] = 'same'
    if (q_2024 == null && q_2025 != null) status = 'new'
    else if (q_2024 != null && q_2025 == null) status = 'missing'
    else if (q_2024 != null && q_2025 != null && (Math.abs(q_2024 - q_2025) > 0.001 || Math.abs(Number(cost_2024) - Number(cost_2025)) > 0.001)) status = 'changed'

    // Check if the values actually changed
    let qty_changed: 0 | 1 = 0
    let cost_changed: 0 | 1 = 0
    if (q_2024 != null && q_2025 != null) {
      if (Math.abs(q_2024 - q_2025) > 0.001) qty_changed = 1
      if (Math.abs(Number(cost_2024) - Number(cost_2025)) > 0.001) cost_changed = 1
    }

    toInsert.push({
      code,
      description: desc,
      supplier: supplier,
      q_2024,
      cost_2024,
      q_2025,
      cost_2025,
      status,
      qty_changed,
      cost_changed,
    })
  }

  // 2. Batch insert the new snapshot entirely
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const { error } = await supabase.from('ws_inventory_items').insert(toInsert.slice(i, i + BATCH))
    if (error) throw error
  }

  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('ws_upload_history').insert({
    table_name: 'ws_inventory_items',
    filename: filenameLabel ?? 'import_2024_2025',
    row_count: allCodes.length,
    uploaded_by: user?.email ?? 'unknown',
    data_payload: toInsert, // Save the snapshot of merged data
  })
}
