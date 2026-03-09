import { supabase } from './supabase'
import type { InventoryItem, SalesItem, BuysItem } from '../types'

export interface MasterSnapshotPayload {
    inventory: InventoryItem[]
    sales: SalesItem[]
    buys: BuysItem[]
}

export async function createMasterSnapshot(name: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()

    // 1. Fetch all Inventory
    const inventory: InventoryItem[] = []
    let from = 0
    while (true) {
        const { data } = await supabase.from('ws_inventory_items').select('*').range(from, from + 999)
        if (!data || data.length === 0) break
        inventory.push(...(data as InventoryItem[]))
        if (data.length < 1000) break
        from += 1000
    }

    // 2. Fetch all Sales
    const sales: SalesItem[] = []
    from = 0
    while (true) {
        const { data } = await supabase.from('ws_sales_2025').select('*').range(from, from + 999)
        if (!data || data.length === 0) break
        sales.push(...(data as SalesItem[]))
        if (data.length < 1000) break
        from += 1000
    }

    // 3. Fetch all Buys
    const buys: BuysItem[] = []
    from = 0
    while (true) {
        const { data } = await supabase.from('ws_buys_2025').select('*').range(from, from + 999)
        if (!data || data.length === 0) break
        buys.push(...(data as BuysItem[]))
        if (data.length < 1000) break
        from += 1000
    }

    const payload: MasterSnapshotPayload = { inventory, sales, buys }
    const totalRows = inventory.length + sales.length + buys.length

    const { error } = await supabase.from('ws_upload_history').insert({
        table_name: 'master_snapshot',
        filename: name,
        row_count: totalRows,
        uploaded_by: user?.email ?? 'unknown',
        data_payload: payload,
    })

    if (error) throw error
}

export async function restoreMasterSnapshot(payload: MasterSnapshotPayload): Promise<void> {
    // Wipe all tables
    await Promise.all([
        supabase.from('ws_inventory_items').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('ws_sales_2025').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        supabase.from('ws_buys_2025').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    ])

    // Insert batches
    const BATCH = 500

    // Insert Inventory
    for (let i = 0; i < payload.inventory.length; i += BATCH) {
        const chunk = payload.inventory.slice(i, i + BATCH).map(({ id, ...rest }) => rest)
        if (chunk.length > 0) {
            const { error } = await supabase.from('ws_inventory_items').insert(chunk)
            if (error) throw error
        }
    }

    // Insert Sales
    for (let i = 0; i < payload.sales.length; i += BATCH) {
        const chunk = payload.sales.slice(i, i + BATCH).map(({ id, ...rest }) => rest)
        if (chunk.length > 0) {
            const { error } = await supabase.from('ws_sales_2025').insert(chunk)
            if (error) throw error
        }
    }

    // Insert Buys
    for (let i = 0; i < payload.buys.length; i += BATCH) {
        const chunk = payload.buys.slice(i, i + BATCH).map(({ id, ...rest }) => rest)
        if (chunk.length > 0) {
            const { error } = await supabase.from('ws_buys_2025').insert(chunk)
            if (error) throw error
        }
    }
}
