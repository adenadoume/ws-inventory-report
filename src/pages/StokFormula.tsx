import { useMemo, useState } from 'react'
import type { InventoryItem, SalesItem, BuysItem, FilterStatus, SortMode } from '../types'
import StatCard from '../components/StatCard'
import FiltersBar from '../components/FiltersBar'
import ItemHistoryModal from '../components/ItemHistoryModal'
import UploadHistoryPanel from '../components/UploadHistoryPanel'
import { restoreMasterSnapshot } from '../lib/snapshot'

interface Props {
  items: InventoryItem[]
  sales: SalesItem[]
  buys: BuysItem[]
  loading: boolean
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
  const [codeInitial, setCodeInitial] = useState('WS')
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [selectedCode, setSelectedCode] = useState<string | null>(null)

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
      const valSold = s?.value_sold ?? 0
      const valBought = b?.value_bought ?? 0
      const q24 = inv.q_2024 ?? 0
      const expectedQ25 = q24 + qtyBought - qtySold
      const actualQ25 = inv.q_2025 ?? null
      const hasDiff = (actualQ25 != null && Math.abs(actualQ25 - expectedQ25) > 0.001) || inv.status === 'missing'
      return { ...inv, qtySold, valSold, qtyBought, valBought, expectedQ25, actualQ25, hasDiff }
    })
  }, [items, salesMap, buysMap])

  const baseFiltered = useMemo(() => {
    let rows = merged
    if (supplier) rows = rows.filter(i => i.supplier === supplier)
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(i => i.code.toLowerCase().includes(q) || i.description.toLowerCase().includes(q))
    }
    if (codeInitial) {
      if (codeInitial === 'WS') {
        rows = rows.filter(i => i.code.toUpperCase().localeCompare('W') < 0)
      } else {
        rows = rows.filter(i => i.code.toUpperCase().startsWith(codeInitial))
      }
    }
    return rows
  }, [merged, supplier, search, codeInitial])

  const suppliers = useMemo(() =>
    [...new Set(items.map(i => i.supplier).filter(Boolean))].sort()
    , [items])

  // Aggregate stats
  const totalSalesEur = useMemo(() => baseFiltered.reduce((s, i) => s + (i.valSold || 0), 0), [baseFiltered])
  const totalBuysEur = useMemo(() => baseFiltered.reduce((s, i) => s + (i.valBought || 0), 0), [baseFiltered])
  const totalStock24Eur = useMemo(() => baseFiltered.reduce((s, i) => s + (i.cost_2024 || 0), 0), [baseFiltered])

  // Expected Αξία 2025 & Diff Total: We must iterate over all unique codes across all three feeds.
  const { expectedAxia, diffAxiaTotal } = useMemo(() => {
    const itemMap = new Map<string, InventoryItem>()
    items.forEach(i => itemMap.set(i.code, i))

    // We already have salesMap and buysMap
    const allCodes = new Set<string>([...itemMap.keys(), ...buysMap.keys(), ...salesMap.keys()])

    let expVal = 0
    let diffVal = 0

    for (const code of allCodes) {
      if (codeInitial === 'WS' && code.toUpperCase().localeCompare('W') >= 0) {
        continue
      } else if (codeInitial !== '' && codeInitial !== 'WS' && !code.toUpperCase().startsWith(codeInitial)) {
        continue
      }

      const r = itemMap.get(code)
      const s = salesMap.get(code)
      const b = buysMap.get(code)

      const qtySold = s?.qty_sold ?? 0
      const qtyBought = b?.qty_bought ?? 0
      const q24 = r?.q_2024 ?? 0
      const expectedQ25 = q24 + qtyBought - qtySold

      let unitCost = 0
      if (r?.q_2025 && r.q_2025 > 0 && r.cost_2025) {
        unitCost = r.cost_2025 / r.q_2025
      } else if (r?.q_2024 && r.q_2024 > 0 && r.cost_2024) {
        unitCost = r.cost_2024 / r.q_2024
      }

      const expectedVal = expectedQ25 * unitCost
      const actualVal = r?.cost_2025 ?? 0

      expVal += expectedVal
      diffVal += actualVal - expectedVal
    }

    return { expectedAxia: expVal, diffAxiaTotal: diffVal }
  }, [items, buysMap, salesMap, codeInitial])

  const codeInitials = useMemo(() => {
    const chars = new Set<string>()
    items.forEach(i => {
      if (i.code) chars.add(i.code.charAt(0).toUpperCase())
    })
    return Array.from(chars).sort()
  }, [items])

  const filtered = useMemo(() => {
    let rows = baseFiltered
    if (filter === 'changed') rows = rows.filter(i => i.hasDiff)
    else if (filter === 'same') rows = rows.filter(i => !i.hasDiff)
    else if (filter === 'missing') rows = rows.filter(i => i.status === 'missing')
    else if (filter === 'new') rows = rows.filter(i => i.status === 'new')

    if (sort === 'code') {
      rows = [...rows].sort((a, b) => a.code.localeCompare(b.code))
    } else if (sort === 'cost') {
      // Sort by absolute diff descending (biggest discrepancies first)
      rows = [...rows].sort((a, b) => {
        const da = a.actualQ25 != null ? Math.abs(a.actualQ25 - a.expectedQ25) : (a.status === 'missing' ? a.expectedQ25 : 0)
        const db = b.actualQ25 != null ? Math.abs(b.actualQ25 - b.expectedQ25) : (b.status === 'missing' ? b.expectedQ25 : 0)

        let unitCostA = 0
        if (a.q_2025 && a.q_2025 > 0 && a.cost_2025) unitCostA = a.cost_2025 / a.q_2025
        else if (a.q_2024 && a.q_2024 > 0 && a.cost_2024) unitCostA = a.cost_2024 / a.q_2024

        let unitCostB = 0
        if (b.q_2025 && b.q_2025 > 0 && b.cost_2025) unitCostB = b.cost_2025 / b.q_2025
        else if (b.q_2024 && b.q_2024 > 0 && b.cost_2024) unitCostB = b.cost_2024 / b.q_2024

        const diffV_a = da * unitCostA
        const diffV_b = db * unitCostB

        return diffV_b - diffV_a
      })
    } else if (sort === 'diff-desc' || sort === 'diff-asc') {
      rows = [...rows].sort((a, b) => {
        const da = a.actualQ25 != null ? (a.actualQ25 - a.expectedQ25) : (a.status === 'missing' ? -a.expectedQ25 : null)
        const db = b.actualQ25 != null ? (b.actualQ25 - b.expectedQ25) : (b.status === 'missing' ? -b.expectedQ25 : null)

        let unitCostA = 0
        if (a.q_2025 && a.q_2025 > 0 && a.cost_2025) unitCostA = a.cost_2025 / a.q_2025
        else if (a.q_2024 && a.q_2024 > 0 && a.cost_2024) unitCostA = a.cost_2024 / a.q_2024

        let unitCostB = 0
        if (b.q_2025 && b.q_2025 > 0 && b.cost_2025) unitCostB = b.cost_2025 / b.q_2025
        else if (b.q_2024 && b.q_2024 > 0 && b.cost_2024) unitCostB = b.cost_2024 / b.q_2024

        const diffV_a = da != null ? da * unitCostA : 0
        const diffV_b = db != null ? db * unitCostB : 0

        if (sort === 'diff-desc') {
          return diffV_b - diffV_a
        } else {
          return diffV_a - diffV_b
        }
      })
    }
    return rows
  }, [baseFiltered, filter, sort])

  const handleRestoreSnapshot = async (tableName: string, snapshotData: any) => {
    if (tableName !== 'master_snapshot') return

    try {
      await restoreMasterSnapshot(snapshotData)
      alert('Επιτυχής επαναφορά Master Snapshot! Παρακαλώ ανανεώστε τη σελίδα (F5).')
      window.location.reload()
    } catch (e: any) {
      alert('Σφάλμα επαναφοράς: ' + e.message)
    }
  }

  if (loading) return (
    <div className="loading-state">
      <span className="loading-state-inner">Φόρτωση δεδομένων…</span>
    </div>
  )

  return (
    <>
      {/* Stat cards */}
      <div className="cards stagger-children">
        <StatCard value={fmtEur(totalStock24Eur)} label="Αξία Αποθ. 2024" color="purple" />
        <StatCard value={fmtEur(totalSalesEur)} label="Σύνολο Πωλήσεων €" color="red" />
        <StatCard value={fmtEur(totalBuysEur)} label="Σύνολο Αγορών €" color="green" />
        <StatCard value={fmtEur(expectedAxia)} label="Expected Αξία Αποθ. 2025" color="violet" />
        <StatCard value={(diffAxiaTotal >= 0 ? '+' : '') + fmtEur(diffAxiaTotal)} label="Σύνολο Διαφοράς €" color={diffAxiaTotal >= 0 ? 'green' : 'red'} />
      </div>

      {/* Filters — reuse filter buttons: here "changed" means formula mismatch */}
      <div className="animate-fade-in">
        <FiltersBar
          suppliers={suppliers}
          supplier={supplier} onSupplier={setSupplier}
          search={search} onSearch={setSearch}
          codeInitial={codeInitial} onCodeInitial={setCodeInitial} codeInitials={codeInitials}
          filter={filter} onFilter={setFilter}
          sort={sort === 'diff-desc' || sort === 'diff-asc' ? 'cost' : sort} onSort={v => setSort(v === 'cost' ? 'cost' : 'code')}
          countLabel={`${filtered.length.toLocaleString('el-GR')} κωδικοί`}
          showStatusFilters
          extraRight={
            <button
              type="button"
              className={`filter-btn${historyModalOpen ? ' active' : ''}`}
              onClick={() => setHistoryModalOpen(true)}
              style={{ background: '#3B82F6', borderColor: '#2563EB', color: '#FFF' }}
            >
              🕒 Ιστορικό / Snapshots
            </button>
          }
        />
      </div>

      <UploadHistoryPanel
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        onRestoreSnapshot={handleRestoreSnapshot}
      />

      {/* Single panel */}
      <div className="animate-slide-up single-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="tbl-wrap single-tbl-wrap" style={{ flex: 1, overflowY: 'scroll', overflowX: 'auto' }}>
          <table style={{ tableLayout: 'fixed', width: '100%' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr style={{ background: '#1A3060' }}>
                <th className="c-code" style={{ color: '#C8DEFF', padding: '7px 6px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '2px solid rgba(0,0,0,.3)' }}>ΚΩΔΙΚΟΣ</th>
                <th className="c-sup" style={{ color: '#C8DEFF', padding: '7px 6px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '2px solid rgba(0,0,0,.3)' }}>ΠΡ.</th>
                <th className="c-desc" style={{ color: '#C8DEFF', padding: '7px 6px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '2px solid rgba(0,0,0,.3)' }}>ΠΕΡΙΓΡΑΦΗ</th>
                <th className="c-num" style={{ color: '#C8DEFF', padding: '7px 6px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '2px solid rgba(0,0,0,.3)' }}>STOCK 24</th>
                <th className="c-num" style={{ color: '#FFAABB', padding: '7px 6px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '2px solid rgba(0,0,0,.3)' }}>Q ΠΩΛΗΣΕΙΣ</th>
                <th className="c-num" style={{ color: '#AAFFBB', padding: '7px 6px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '2px solid rgba(0,0,0,.3)' }}>Q ΑΓΟΡΕΣ</th>
                <th className="c-num" style={{ color: '#DDA0DD', padding: '7px 6px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '2px solid rgba(0,0,0,.3)' }}>EXPECTED 25</th>
                <th className="c-num" style={{ color: '#C8DEFF', padding: '7px 6px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '2px solid rgba(0,0,0,.3)' }}>STOCK 25</th>
                <th
                  className="c-num"
                  style={{ color: '#FFE08A', padding: '7px 6px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '2px solid rgba(0,0,0,.3)', cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => {
                    if (sort === 'code' || sort === 'cost') setSort('diff-desc')
                    else if (sort === 'diff-desc') setSort('diff-asc')
                    else setSort('code')
                  }}
                >ΔΙΑΦ. €</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const diff = r.actualQ25 != null ? (r.actualQ25 - r.expectedQ25) : (r.status === 'missing' ? -r.expectedQ25 : null)
                const rowBg = r.hasDiff
                  ? (diff != null && diff < 0 ? '#3D0A0A' : '#3D2000')
                  : (r.actualQ25 != null ? '#0A1A0A' : '#131E2A')

                let unitCost = 0
                if (r.q_2025 && r.q_2025 > 0 && r.cost_2025) unitCost = r.cost_2025 / r.q_2025
                else if (r.q_2024 && r.q_2024 > 0 && r.cost_2024) unitCost = r.cost_2024 / r.q_2024
                const diffV = diff != null ? diff * unitCost : null

                return (
                  <tr key={r.code} style={{ height: 34, background: rowBg, cursor: 'pointer' }} onClick={() => setSelectedCode(r.code)}>
                    <td className="c-code" style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 14 }}>{r.code}</td>
                    <td className="c-sup" style={{ fontFamily: 'monospace', fontSize: 13, textAlign: 'center', color: '#A8C8E8' }}>{r.supplier}</td>
                    <td className="c-desc" style={{ fontSize: 14 }}>{r.description}</td>
                    <td className="c-num" style={{ color: '#7DD3FC' }}>{fmtQty(r.q_2024)}</td>
                    <td className="c-num" style={{ color: r.qtySold > 0 ? '#FCA5A5' : '#556' }}>{fmtQty(r.qtySold || null)}</td>
                    <td className="c-num" style={{ color: r.qtyBought > 0 ? '#86EFAC' : '#556' }}>{fmtQty(r.qtyBought || null)}</td>
                    <td className="c-num" style={{ color: '#DDA0DD', fontWeight: 700 }}>{fmtQty(r.expectedQ25)}</td>
                    <td className="c-num" style={{ color: r.hasDiff ? '#FFD700' : '#86EFAC', fontWeight: r.hasDiff ? 700 : 400 }}>
                      {fmtQty(r.actualQ25)}
                      {r.status === 'missing' && <span style={{ fontSize: 13, marginLeft: 4, color: '#FCA5A5' }}>(ΑΠΟΥΣΙΑ)</span>}
                      {r.status !== 'missing' && r.hasDiff && diff != null && (
                        <span style={{ fontSize: 13, marginLeft: 4, color: diff < 0 ? '#FCA5A5' : '#86EFAC' }}>
                          ({diff > 0 ? '+' : ''}{fmtQty(diff)})
                        </span>
                      )}
                    </td>
                    <td className="c-num" style={{ color: r.hasDiff && diffV != null && diffV < 0 ? '#FCA5A5' : (r.hasDiff && diffV != null && diffV > 0 ? '#FFE08A' : '#556'), fontWeight: r.hasDiff ? 700 : 400 }}>
                      {diffV != null && Math.abs(diffV) > 0.001 ? (diffV > 0 ? '+' : '') + fmtEur(diffV) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Formula explanation bar */}
        <div style={{ flexShrink: 0, background: '#0D1B2A', borderTop: '1px solid #1B2A3B', padding: '6px 20px', fontSize: 14, color: '#7FA8C9' }}>
          <strong style={{ color: '#DDA0DD' }}>Τύπος:</strong>&nbsp;
          Expected Stock 25 = Stock 24 + Q Αγορές − Q Πωλήσεις &nbsp;|&nbsp;
          <span style={{ color: '#FCA5A5' }}>Κόκκινο</span> = έλλειμμα &nbsp;
          <span style={{ color: '#FFD700' }}>Κίτρινο</span> = διαφορά &nbsp;
          <span style={{ color: '#86EFAC' }}>Πράσινο</span> = ταιριάζει
        </div>
      </div>
      {selectedCode && (
        <ItemHistoryModal
          code={selectedCode}
          items={items}
          sales={sales}
          buys={buys}
          onClose={() => setSelectedCode(null)}
        />
      )}
    </>
  )
}
