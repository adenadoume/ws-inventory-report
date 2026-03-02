import { useMemo, useState } from 'react'
import type { InventoryItem, SalesItem, BuysItem, FilterStatus, SortMode } from '../types'
import StatCard from '../components/StatCard'
import FiltersBar from '../components/FiltersBar'

interface Props {
  items: InventoryItem[]
  sales: SalesItem[]
  buys: BuysItem[]
  loading: boolean
}

function fmt(n: number | null | undefined, dec = 2) {
  if (n == null) return '—'
  return n.toLocaleString('el-GR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function fmtEur(n: number) {
  return '€' + n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtQty(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toLocaleString('el-GR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export default function StokFormula({ items, sales, buys, loading }: Props) {
  const [supplier, setSupplier] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [sort, setSort] = useState<SortMode>('code')

  // Build lookup maps
  const salesMap = useMemo(() => {
    const m = new Map<string, SalesItem>()
    sales.forEach(s => m.set(s.code, s))
    return m
  }, [sales])

  const buysMap = useMemo(() => {
    const m = new Map<string, BuysItem>()
    buys.forEach(b => m.set(b.code, b))
    return m
  }, [buys])

  // Merged rows with formula
  const merged = useMemo(() => {
    return items.map(inv => {
      const s = salesMap.get(inv.code)
      const b = buysMap.get(inv.code)
      const qtySold = s?.qty_sold ?? 0
      const qtyBought = b?.qty_bought ?? 0
      const q24 = inv.q_2024 ?? 0
      const expectedQ25 = q24 + qtyBought - qtySold
      const actualQ25 = inv.q_2025 ?? null
      const hasDiff = actualQ25 != null && Math.abs(actualQ25 - expectedQ25) > 0.001
      return { ...inv, qtySold, qtyBought, expectedQ25, actualQ25, hasDiff }
    })
  }, [items, salesMap, buysMap])

  const suppliers = useMemo(() =>
    [...new Set(items.map(i => i.supplier).filter(Boolean))].sort()
  , [items])

  // Aggregate stats
  const totalSalesQty = useMemo(() => sales.reduce((s, i) => s + i.qty_sold, 0), [sales])
  const totalSalesEur = useMemo(() => sales.reduce((s, i) => s + i.value_sold, 0), [sales])
  const totalBuysQty = useMemo(() => buys.reduce((s, i) => s + i.qty_bought, 0), [buys])
  const totalBuysEur = useMemo(() => buys.reduce((s, i) => s + i.value_bought, 0), [buys])

  // Expected Αξία 2025: use unit cost from 2025 where possible, else 2024
  const expectedAxia = useMemo(() => {
    return merged.reduce((sum, r) => {
      let unitCost = 0
      if (r.q_2025 && r.q_2025 > 0 && r.cost_2025) {
        unitCost = r.cost_2025 / r.q_2025
      } else if (r.q_2024 && r.q_2024 > 0 && r.cost_2024) {
        unitCost = r.cost_2024 / r.q_2024
      }
      return sum + unitCost * r.expectedQ25
    }, 0)
  }, [merged])

  const filtered = useMemo(() => {
    let rows = merged
    if (supplier) rows = rows.filter(i => i.supplier === supplier)
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(i => i.code.toLowerCase().includes(q) || i.description.toLowerCase().includes(q))
    }
    if (filter === 'changed') rows = rows.filter(i => i.hasDiff)
    else if (filter === 'same') rows = rows.filter(i => !i.hasDiff)
    else if (filter === 'missing') rows = rows.filter(i => i.status === 'missing')
    else if (filter === 'new') rows = rows.filter(i => i.status === 'new')

    if (sort === 'code') {
      rows = [...rows].sort((a, b) => a.code.localeCompare(b.code))
    } else {
      // Sort by absolute diff descending (biggest discrepancies first)
      rows = [...rows].sort((a, b) => {
        const da = a.actualQ25 != null ? Math.abs(a.actualQ25 - a.expectedQ25) : 0
        const db = b.actualQ25 != null ? Math.abs(b.actualQ25 - b.expectedQ25) : 0
        return db - da
      })
    }
    return rows
  }, [merged, supplier, search, filter, sort])

  if (loading) return <div style={{ padding: 40, color: '#7FA8C9' }}>Φόρτωση δεδομένων…</div>

  return (
    <>
      {/* Stat cards */}
      <div className="cards">
        <StatCard value={fmtQty(totalSalesQty)} label="Σύνολο Πωλήσεων Q" color="red" />
        <StatCard value={fmtEur(totalSalesEur)} label="Σύνολο Πωλήσεων €" color="red" />
        <StatCard value={fmtQty(totalBuysQty)} label="Σύνολο Αγορών Q" color="green" />
        <StatCard value={fmtEur(totalBuysEur)} label="Σύνολο Αγορών €" color="green" />
        <StatCard value={fmtEur(expectedAxia)} label="Expected Αξία Αποθ. 2025" color="violet" />
      </div>

      {/* Filters — reuse filter buttons: here "changed" means formula mismatch */}
      <FiltersBar
        suppliers={suppliers}
        supplier={supplier} onSupplier={setSupplier}
        search={search} onSearch={setSearch}
        filter={filter} onFilter={setFilter}
        sort={sort} onSort={v => setSort(v === 'cost' ? 'cost' : 'code')}
        countLabel={`${filtered.length.toLocaleString('el-GR')} κωδικοί`}
        showStatusFilters
      />

      {/* Single panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="tbl-wrap single-tbl-wrap" style={{ flex: 1, overflowY: 'scroll', overflowX: 'auto' }}>
          <table style={{ tableLayout: 'fixed', width: '100%' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr style={{ background: '#1A3060' }}>
                <th className="c-code" style={{ color: '#C8DEFF', padding: '7px 6px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '2px solid rgba(0,0,0,.3)' }}>ΚΩΔΙΚΟΣ</th>
                <th className="c-sup" style={{ color: '#C8DEFF', padding: '7px 6px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '2px solid rgba(0,0,0,.3)' }}>ΠΡ.</th>
                <th className="c-desc" style={{ color: '#C8DEFF', padding: '7px 6px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '2px solid rgba(0,0,0,.3)' }}>ΠΕΡΙΓΡΑΦΗ</th>
                <th className="c-num" style={{ color: '#C8DEFF', padding: '7px 6px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '2px solid rgba(0,0,0,.3)' }}>STOCK 24</th>
                <th className="c-num" style={{ color: '#FFAABB', padding: '7px 6px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '2px solid rgba(0,0,0,.3)' }}>Q ΠΩΛΗΣΕΙΣ</th>
                <th className="c-num" style={{ color: '#AAFFBB', padding: '7px 6px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '2px solid rgba(0,0,0,.3)' }}>Q ΑΓΟΡΕΣ</th>
                <th className="c-num" style={{ color: '#DDA0DD', padding: '7px 6px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '2px solid rgba(0,0,0,.3)' }}>EXPECTED STOCK 25</th>
                <th className="c-num" style={{ color: '#C8DEFF', padding: '7px 6px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '2px solid rgba(0,0,0,.3)' }}>STOCK 25</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const diff = r.actualQ25 != null ? (r.actualQ25 - r.expectedQ25) : null
                const rowBg = r.hasDiff
                  ? (diff != null && diff < 0 ? '#3D0A0A' : '#3D2000')
                  : (r.actualQ25 != null ? '#0A1A0A' : '#131E2A')
                return (
                  <tr key={r.code} style={{ height: 27, background: rowBg }}>
                    <td className="c-code" style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 11 }}>{r.code}</td>
                    <td className="c-sup" style={{ fontFamily: 'monospace', fontSize: 10, textAlign: 'center', color: '#A8C8E8' }}>{r.supplier}</td>
                    <td className="c-desc" style={{ fontSize: 11 }}>{r.description}</td>
                    <td className="c-num" style={{ color: '#7DD3FC' }}>{fmtQty(r.q_2024)}</td>
                    <td className="c-num" style={{ color: r.qtySold > 0 ? '#FCA5A5' : '#556' }}>{fmtQty(r.qtySold || null)}</td>
                    <td className="c-num" style={{ color: r.qtyBought > 0 ? '#86EFAC' : '#556' }}>{fmtQty(r.qtyBought || null)}</td>
                    <td className="c-num" style={{ color: '#DDA0DD', fontWeight: 700 }}>{fmtQty(r.expectedQ25)}</td>
                    <td className="c-num" style={{ color: r.hasDiff ? '#FFD700' : '#86EFAC', fontWeight: r.hasDiff ? 700 : 400 }}>
                      {fmtQty(r.actualQ25)}
                      {r.hasDiff && diff != null && (
                        <span style={{ fontSize: 10, marginLeft: 4, color: diff < 0 ? '#FCA5A5' : '#86EFAC' }}>
                          ({diff > 0 ? '+' : ''}{fmt(diff, 1)})
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Formula explanation bar */}
        <div style={{ flexShrink: 0, background: '#0D1B2A', borderTop: '1px solid #1B2A3B', padding: '6px 20px', fontSize: 11, color: '#7FA8C9' }}>
          <strong style={{ color: '#DDA0DD' }}>Τύπος:</strong>&nbsp;
          Expected Stock 25 = Stock 24 + Q Αγορές − Q Πωλήσεις &nbsp;|&nbsp;
          <span style={{ color: '#FCA5A5' }}>Κόκκινο</span> = έλλειμμα &nbsp;
          <span style={{ color: '#FFD700' }}>Κίτρινο</span> = διαφορά &nbsp;
          <span style={{ color: '#86EFAC' }}>Πράσινο</span> = ταιριάζει
        </div>
      </div>
    </>
  )
}
