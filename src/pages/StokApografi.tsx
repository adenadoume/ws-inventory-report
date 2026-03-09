import { useMemo, useRef, useState } from 'react'
import ExcelJS from 'exceljs'
import type { InventoryItem, FilterStatus, SortMode } from '../types'
import StatCard from '../components/StatCard'
import FiltersBar from '../components/FiltersBar'
import ImportApografiModal from '../components/ImportApografiModal'
import { useBuys } from '../hooks/useBuys'
import { useSales } from '../hooks/useSales'
import ItemHistoryModal from '../components/ItemHistoryModal'

interface Props {
  items: InventoryItem[]
  loading: boolean
  onRefresh?: () => void
}

function fmtEur(n: number) {
  return '€' + n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function StokApografi({ items, loading, onRefresh }: Props) {
  const [supplier, setSupplier] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [sort, setSort] = useState<SortMode>('code')
  const [codeInitial, setCodeInitial] = useState('WS')
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const wrap25Ref = useRef<HTMLDivElement>(null)
  const wrap24Ref = useRef<HTMLDivElement>(null)

  const { items: buys } = useBuys()
  const { items: sales } = useSales()

  // Sync scroll between panels
  const onScroll25 = () => {
    if (wrap24Ref.current && wrap25Ref.current)
      wrap24Ref.current.scrollTop = wrap25Ref.current.scrollTop
  }
  const onScroll24 = () => {
    if (wrap25Ref.current && wrap24Ref.current)
      wrap25Ref.current.scrollTop = wrap24Ref.current.scrollTop
  }

  const suppliers = useMemo(() =>
    [...new Set(items.map(i => i.supplier).filter(Boolean))].sort()
    , [items])

  const baseFiltered = useMemo(() => {
    let rows = items
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
  }, [items, supplier, search, codeInitial])

  const stats = useMemo(() => {
    return {
      nOnly24: baseFiltered.filter(i => i.status === 'missing').length,
      nOnly25: baseFiltered.filter(i => i.status === 'new').length,
      nChanged: baseFiltered.filter(i => i.status === 'changed').length,
      tot24: baseFiltered.reduce((s, i) => s + (i.cost_2024 ?? 0), 0),
      tot25: baseFiltered.reduce((s, i) => s + (i.cost_2025 ?? 0), 0),
    }
  }, [baseFiltered])

  // Compute total Expected Value for the whole DB to show on top
  const { totalExpectedValue, globalDiffValue } = useMemo(() => {
    const bMap = new Map<string, number>()
    buys.forEach((b: any) => bMap.set(b.code, b.qty_bought))
    const sMap = new Map<string, number>()
    sales.forEach((s: any) => sMap.set(s.code, s.qty_sold))

    const itemMap = new Map<string, InventoryItem>()
    items.forEach(i => itemMap.set(i.code, i))

    // Collect ALL unique codes across items, buys, and sales
    const allCodes = new Set<string>([...itemMap.keys(), ...bMap.keys(), ...sMap.keys()])

    let eVal = 0
    let diffVal = 0

    for (const code of allCodes) {
      // If "WS" filter is active, exclude W, X, Y, Z
      if (codeInitial === 'WS' && code.toUpperCase().localeCompare('W') >= 0) {
        continue
      } else if (codeInitial !== '' && codeInitial !== 'WS' && !code.toUpperCase().startsWith(codeInitial)) {
        continue
      }

      const r = itemMap.get(code)
      const q24 = r?.q_2024 ?? 0
      const bQ = bMap.get(code) ?? 0
      const sQ = sMap.get(code) ?? 0
      const expQ = q24 + bQ - sQ

      // Find unit cost to price the expected Qty
      let unitCost = 0
      if (r?.q_2025 && r.q_2025 > 0 && r.cost_2025) {
        unitCost = r.cost_2025 / r.q_2025
      } else if (r?.q_2024 && r.q_2024 > 0 && r.cost_2024) {
        unitCost = r.cost_2024 / r.q_2024
      }

      const expectedVal = expQ * unitCost
      const actualVal = r?.cost_2025 ?? 0

      eVal += expectedVal
      diffVal += actualVal - expectedVal
    }

    return { totalExpectedValue: eVal, globalDiffValue: diffVal }
  }, [items, buys, sales, codeInitial])

  const codeInitials = useMemo(() => {
    const chars = new Set<string>()
    items.forEach(i => {
      if (i.code) chars.add(i.code.charAt(0).toUpperCase())
    })
    return Array.from(chars).sort()
  }, [items])

  const filtered = useMemo(() => {
    let rows = baseFiltered
    if (filter !== 'all') rows = rows.filter(i => i.status === filter)
    if (sort === 'code') {
      rows = [...rows].sort((a, b) => a.code.localeCompare(b.code))
    } else {
      // Sort by absolute diff descending (biggest valuation first based on cost)
      rows = [...rows].sort((a, b) => {
        const va = a.cost_2025 ?? a.cost_2024 ?? 0
        const vb = b.cost_2025 ?? b.cost_2024 ?? 0
        return vb - va
      })
    }
    return rows
  }, [baseFiltered, filter, sort])

  const tot25 = filtered.reduce((s, i) => s + (i.cost_2025 ?? 0), 0)
  const tot24 = filtered.reduce((s, i) => s + (i.cost_2024 ?? 0), 0)

  const downloadExcel = async () => {
    const wb = new ExcelJS.Workbook()

    const addSheet = (name: string, rows: InventoryItem[], year: '2025' | '2024') => {
      const ws = wb.addWorksheet(name)
      ws.columns = [
        { header: 'Κωδικός', key: 'code', width: 18 },
        { header: 'ΠΡ.', key: 'supplier', width: 10 },
        { header: 'Περιγραφή', key: 'description', width: 50 },
        { header: 'Ποσότητα', key: 'qty', width: 14 },
        { header: 'Αξία €', key: 'cost', width: 16 },
        { header: 'Κατάσταση', key: 'status', width: 16 },
      ]
      ws.getRow(1).font = { bold: true }
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } }

      for (const r of rows) {
        ws.addRow({
          code: r.code,
          supplier: r.supplier,
          description: r.description,
          qty: year === '2025' ? r.q_2025 : r.q_2024,
          cost: year === '2025' ? r.cost_2025 : r.cost_2024,
          status: r.status,
        })
      }
      ws.getColumn('qty').numFmt = '#,##0.00'
      ws.getColumn('cost').numFmt = '#,##0.00 €'
    }

    addSheet('Απογραφή 2025', filtered, '2025')
    addSheet('Απογραφή 2024', filtered, '2024')

    // Diff sheet
    const ws3 = wb.addWorksheet('Σύγκριση')
    ws3.columns = [
      { header: 'Κωδικός', key: 'code', width: 18 },
      { header: 'ΠΡ.', key: 'supplier', width: 10 },
      { header: 'Περιγραφή', key: 'description', width: 50 },
      { header: 'Q 2024', key: 'q24', width: 12 },
      { header: 'Αξία 2024', key: 'c24', width: 16 },
      { header: 'Q 2025', key: 'q25', width: 12 },
      { header: 'Αξία 2025', key: 'c25', width: 16 },
      { header: 'Κατάσταση', key: 'status', width: 16 },
    ]
    ws3.getRow(1).font = { bold: true }
    ws3.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } }

    for (const r of filtered) {
      ws3.addRow({
        code: r.code, supplier: r.supplier, description: r.description,
        q24: r.q_2024, c24: r.cost_2024, q25: r.q_2025, c25: r.cost_2025, status: r.status
      })
    }
    ws3.getColumn('q24').numFmt = '#,##0.00'
    ws3.getColumn('c24').numFmt = '#,##0.00 €'
    ws3.getColumn('q25').numFmt = '#,##0.00'
    ws3.getColumn('c25').numFmt = '#,##0.00 €'

    const buf = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'APOGRAFI_2024_2025.xlsx'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
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
        <StatCard value={fmtEur(stats.tot24)} label="Αξία Αποθ. 2024" color="purple" />
        <StatCard value={fmtEur(totalExpectedValue)} label="Expected Αξία Αποθ. 2025" color="blue" />
        <StatCard value={fmtEur(stats.tot25)} label="Actual Αξία Αποθ. 2025" color="purple" />
        <StatCard value={(globalDiffValue > 0 ? '+' : '') + fmtEur(globalDiffValue)} label="Σύνολο Διαφοράς €" color={globalDiffValue >= 0 ? 'green' : 'red'} />
        <StatCard value={stats.nChanged.toLocaleString('el-GR')} label="Αλλαγές" color="amber" />
        <StatCard value={stats.nOnly24.toLocaleString('el-GR')} label="⚠ Απόντα 2025" color="red" />
        <StatCard value={stats.nOnly25.toLocaleString('el-GR')} label="✦ Νέα 2025" color="green" />
      </div>

      {/* Filters */}
      <div className="animate-fade-in">
        <FiltersBar
          suppliers={suppliers}
          supplier={supplier} onSupplier={setSupplier}
          search={search} onSearch={setSearch}
          codeInitial={codeInitial} onCodeInitial={setCodeInitial} codeInitials={codeInitials}
          filter={filter} onFilter={setFilter}
          sort={sort} onSort={setSort}
          countLabel={`${filtered.length.toLocaleString('el-GR')} κωδικοί`}
          showStatusFilters
          extraRight={
            <>
              <button
                type="button"
                id="btn-import"
                className={`filter-btn${importModalOpen ? ' active' : ''}`}
                onClick={() => setImportModalOpen(true)}
                title="Εισαγωγή Excel"
              >
                {importModalOpen ? '▼ ' : '⬆ '}Import Excel
              </button>
              <button type="button" id="btn-download" className="filter-btn" onClick={downloadExcel} title="Λήψη Excel">
                ⬇ Excel
              </button>
            </>
          }
        />
      </div>

      <ImportApografiModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onDone={onRefresh}
      />

      {/* Legend (exactly as APOGRAFI_DIFF) */}
      <div className="legend animate-fade-in">
        <div className="leg"><div className="leg-dot" style={{ background: '#2D0A0A', border: '1px solid #E74C3C' }}></div> Απόντα από 2025 (υπήρχαν στο 2024)</div>
        <div className="leg"><div className="leg-dot" style={{ background: '#0A2D12', border: '1px solid #27AE60' }}></div> Νέα στο 2025</div>
        <div className="leg"><div className="leg-dot" style={{ background: '#3D2F00', border: '1px solid #F39C12' }}></div> Αλλαγή ποσότητας / αξίας</div>
        <div className="leg"><div className="leg-dot" style={{ background: '#7A5B00', border: '1px solid #FFE08A' }}></div> Συγκεκριμένο κελί που άλλαξε</div>
        <div className="leg"><div className="leg-dot" style={{ background: '#1B2A3B', border: '1px solid #2A5C8A' }}></div> Αμετάβλητο</div>
      </div>

      {/* Dual panels */}
      <div id="panels" className="animate-slide-up">
        {/* LEFT: 2025 */}
        <div className="panel" id="panel-25">
          <div className="panel-hdr">📋 ΑΠΟΓΡΑΦΗ 31 ΔΕΚ 2025</div>
          <div className="tbl-wrap" ref={wrap25Ref} onScroll={onScroll25}>
            <table>
              <thead><tr>
                <th className="c-code">ΚΩΔΙΚΟΣ</th>
                <th className="c-sup">ΠΡ.</th>
                <th className="c-desc">ΠΕΡΙΓΡΑΦΗ</th>
                <th className="c-num">ΑΞΙΑ €</th>
              </tr></thead>
              <tbody>
                {filtered.map(r => {
                  const rowCls = `r-${r.status}`
                  return (
                    <tr key={r.code + '-25'} className={rowCls} onClick={() => setSelectedCode(r.code)} style={{ cursor: 'pointer' }}>
                      <td className="c-code">{r.code}</td>
                      <td className="c-sup">{r.supplier}</td>
                      <td className="c-desc">{r.description}</td>
                      <td className={`c-num${r.cost_changed ? ' cell-ch' : ''}`}>{fmtEur(r.cost_2025 ?? 0)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="totals-bar">
            <table><tbody><tr>
              <td className="c-code tot-label">ΣΥΝΟΛΟ</td>
              <td className="c-sup"></td>
              <td className="c-desc"></td>
              <td className="c-num tot-num">{fmtEur(tot25)}</td>
            </tr></tbody></table>
          </div>
        </div>

        {/* RIGHT: 2024 */}
        <div className="panel" id="panel-24">
          <div className="panel-hdr">📋 ΑΠΟΓΡΑΦΗ 31 ΔΕΚ 2024</div>
          <div className="tbl-wrap" ref={wrap24Ref} onScroll={onScroll24}>
            <table>
              <thead><tr>
                <th className="c-code">ΚΩΔΙΚΟΣ</th>
                <th className="c-sup">ΠΡ.</th>
                <th className="c-desc">ΠΕΡΙΓΡΑΦΗ</th>
                <th className="c-num">ΑΞΙΑ €</th>
              </tr></thead>
              <tbody>
                {filtered.map(r => {
                  const rowCls = `r-${r.status}`
                  return (
                    <tr key={r.code + '-24'} className={rowCls} onClick={() => setSelectedCode(r.code)} style={{ cursor: 'pointer' }}>
                      <td className="c-code">{r.code}</td>
                      <td className="c-sup">{r.supplier}</td>
                      <td className="c-desc">{r.description}</td>
                      <td className={`c-num${r.cost_changed ? ' cell-ch' : ''}`}>{fmtEur(r.cost_2024 ?? 0)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="totals-bar">
            <table><tbody><tr>
              <td className="c-code tot-label">ΣΥΝΟΛΟ</td>
              <td className="c-sup"></td>
              <td className="c-desc"></td>
              <td className="c-num tot-num">{fmtEur(tot24)}</td>
            </tr></tbody></table>
          </div>
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
