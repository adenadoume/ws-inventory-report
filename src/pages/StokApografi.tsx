import { useMemo, useRef, useState } from 'react'
import ExcelJS from 'exceljs'
import type { InventoryItem, FilterStatus, SortMode } from '../types'
import StatCard from '../components/StatCard'
import FiltersBar from '../components/FiltersBar'

interface Props {
  items: InventoryItem[]
  loading: boolean
}

function fmt(n: number | null | undefined, dec = 2) {
  if (n == null) return '—'
  return n.toLocaleString('el-GR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function fmtEur(n: number) {
  return '€' + n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function StokApografi({ items, loading }: Props) {
  const [supplier, setSupplier] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [sort, setSort] = useState<SortMode>('code')
  const wrap25Ref = useRef<HTMLDivElement>(null)
  const wrap24Ref = useRef<HTMLDivElement>(null)

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

  const stats = useMemo(() => {
    const has24 = items.filter(i => i.q_2024 != null)
    const has25 = items.filter(i => i.q_2025 != null)
    return {
      n24: has24.length,
      n25: has25.length,
      nOnly24: items.filter(i => i.status === 'missing').length,
      nOnly25: items.filter(i => i.status === 'new').length,
      nChanged: items.filter(i => i.status === 'changed').length,
      nSame: items.filter(i => i.status === 'same').length,
      tot24: has24.reduce((s, i) => s + (i.cost_2024 ?? 0), 0),
      tot25: has25.reduce((s, i) => s + (i.cost_2025 ?? 0), 0),
    }
  }, [items])

  const diff = stats.tot25 - stats.tot24
  const diffStr = (diff >= 0 ? '+' : '') + fmtEur(diff)

  const filtered = useMemo(() => {
    let rows = items
    if (supplier) rows = rows.filter(i => i.supplier === supplier)
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(i => i.code.toLowerCase().includes(q) || i.description.toLowerCase().includes(q))
    }
    if (filter !== 'all') rows = rows.filter(i => i.status === filter)
    if (sort === 'code') {
      rows = [...rows].sort((a, b) => a.code.localeCompare(b.code))
    } else {
      // Sort by cost_2025 desc (use cost_2024 for missing items)
      rows = [...rows].sort((a, b) => {
        const va = a.cost_2025 ?? a.cost_2024 ?? 0
        const vb = b.cost_2025 ?? b.cost_2024 ?? 0
        return vb - va
      })
    }
    return rows
  }, [items, supplier, search, filter, sort])

  const tot25 = filtered.reduce((s, i) => s + (i.cost_2025 ?? 0), 0)
  const tot24 = filtered.reduce((s, i) => s + (i.cost_2024 ?? 0), 0)
  const totQty25 = filtered.reduce((s, i) => s + (i.q_2025 ?? 0), 0)
  const totQty24 = filtered.reduce((s, i) => s + (i.q_2024 ?? 0), 0)

  const downloadExcel = async () => {
    const wb = new ExcelJS.Workbook()

    const addSheet = (name: string, rows: InventoryItem[], year: '2025' | '2024') => {
      const ws = wb.addWorksheet(name)
      ws.columns = [
        { header: 'Κωδικός', key: 'code', width: 18 },
        { header: 'ΠΡ.', key: 'supplier', width: 8 },
        { header: 'Περιγραφή', key: 'description', width: 50 },
        { header: 'Ποσότητα', key: 'qty', width: 12 },
        { header: 'Αξία €', key: 'cost', width: 14 },
        { header: 'Κατάσταση', key: 'status', width: 12 },
      ]
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
    }

    addSheet('Απογραφή 2025', filtered, '2025')
    addSheet('Απογραφή 2024', filtered, '2024')

    // Diff sheet
    const ws3 = wb.addWorksheet('Σύγκριση')
    ws3.columns = [
      { header: 'Κωδικός', key: 'code', width: 18 },
      { header: 'ΠΡ.', key: 'supplier', width: 8 },
      { header: 'Περιγραφή', key: 'description', width: 50 },
      { header: 'Q 2024', key: 'q24', width: 10 },
      { header: 'Αξία 2024', key: 'c24', width: 14 },
      { header: 'Q 2025', key: 'q25', width: 10 },
      { header: 'Αξία 2025', key: 'c25', width: 14 },
      { header: 'Κατάσταση', key: 'status', width: 12 },
    ]
    for (const r of filtered) {
      ws3.addRow({ code: r.code, supplier: r.supplier, description: r.description,
        q24: r.q_2024, c24: r.cost_2024, q25: r.q_2025, c25: r.cost_2025, status: r.status })
    }

    const buf = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'APOGRAFI_2024_2025.xlsx'; a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div style={{ padding: 40, color: '#7FA8C9' }}>Φόρτωση δεδομένων…</div>

  return (
    <>
      {/* Stat cards */}
      <div className="cards">
        <StatCard value={stats.n24.toLocaleString('el-GR')} label="Κωδικοί 2024" color="blue" />
        <StatCard value={stats.n25.toLocaleString('el-GR')} label="Κωδικοί 2025" color="blue" />
        <StatCard value={stats.nOnly24.toLocaleString('el-GR')} label="⚠ Απόντα 2025" color="red" />
        <StatCard value={stats.nOnly25.toLocaleString('el-GR')} label="✦ Νέα 2025" color="green" />
        <StatCard value={stats.nChanged.toLocaleString('el-GR')} label="Αλλαγές" color="amber" />
        <StatCard value={fmtEur(stats.tot25)} label="Αξία Αποθ. 2025" color="purple" />
        <StatCard value={fmtEur(stats.tot24)} label="Αξία Αποθ. 2024" color="purple" />
        <StatCard value={diffStr} label="Διαφορά Αξίας" color={diff >= 0 ? 'green' : 'red'} />
      </div>

      {/* Filters */}
      <FiltersBar
        suppliers={suppliers}
        supplier={supplier} onSupplier={setSupplier}
        search={search} onSearch={setSearch}
        filter={filter} onFilter={setFilter}
        sort={sort} onSort={setSort}
        countLabel={`${filtered.length.toLocaleString('el-GR')} κωδικοί`}
        showStatusFilters
        extraRight={
          <button className="btn-download" onClick={downloadExcel}>⬇ Excel</button>
        }
      />

      {/* Legend */}
      <div className="legend">
        <div className="leg"><div className="leg-dot" style={{ background: '#2D0A0A', border: '1px solid #E74C3C' }}></div> Απόντα από 2025</div>
        <div className="leg"><div className="leg-dot" style={{ background: '#0A2D12', border: '1px solid #27AE60' }}></div> Νέα στο 2025</div>
        <div className="leg"><div className="leg-dot" style={{ background: '#3D2F00', border: '1px solid #F39C12' }}></div> Αλλαγή ποσ./αξίας</div>
        <div className="leg"><div className="leg-dot" style={{ background: '#7A5B00', border: '1px solid #FFE08A' }}></div> Κελί που άλλαξε</div>
        <div className="leg"><div className="leg-dot" style={{ background: '#1B2A3B', border: '1px solid #2A5C8A' }}></div> Αμετάβλητο</div>
      </div>

      {/* Dual panels */}
      <div id="panels">
        {/* LEFT: 2025 */}
        <div className="panel" id="panel-25">
          <div className="panel-hdr">📋 ΑΠΟΓΡΑΦΗ 31 ΔΕΚ 2025</div>
          <div className="tbl-wrap" ref={wrap25Ref} onScroll={onScroll25}>
            <table>
              <thead><tr>
                <th className="c-code">ΚΩΔΙΚΟΣ</th>
                <th className="c-sup">ΠΡ.</th>
                <th className="c-desc">ΠΕΡΙΓΡΑΦΗ</th>
                <th className="c-num">ΠΟΣΟΤΗΤΑ</th>
                <th className="c-num">ΑΞΙΑ €</th>
              </tr></thead>
              <tbody>
                {filtered.map(r => {
                  const rowCls = `r-${r.status}`
                  return (
                    <tr key={r.code + '-25'} className={rowCls}>
                      <td className="c-code">{r.code}</td>
                      <td className="c-sup">{r.supplier}</td>
                      <td className="c-desc">{r.description}</td>
                      <td className={`c-num${r.qty_changed ? ' cell-ch' : ''}`}>{fmt(r.q_2025)}</td>
                      <td className={`c-num${r.cost_changed ? ' cell-ch' : ''}`}>{fmt(r.cost_2025)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="totals-bar">
            <table><tr>
              <td className="c-code tot-label">ΣΥΝΟΛΟ</td>
              <td className="c-sup"></td>
              <td className="c-desc"></td>
              <td className="c-num tot-num">{fmt(totQty25)}</td>
              <td className="c-num tot-num">{fmt(tot25)}</td>
            </tr></table>
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
                <th className="c-num">ΠΟΣΟΤΗΤΑ</th>
                <th className="c-num">ΑΞΙΑ €</th>
              </tr></thead>
              <tbody>
                {filtered.map(r => {
                  const rowCls = `r-${r.status}`
                  return (
                    <tr key={r.code + '-24'} className={rowCls}>
                      <td className="c-code">{r.code}</td>
                      <td className="c-sup">{r.supplier}</td>
                      <td className="c-desc">{r.description}</td>
                      <td className={`c-num${r.qty_changed ? ' cell-ch' : ''}`}>{fmt(r.q_2024)}</td>
                      <td className={`c-num${r.cost_changed ? ' cell-ch' : ''}`}>{fmt(r.cost_2024)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="totals-bar">
            <table><tr>
              <td className="c-code tot-label">ΣΥΝΟΛΟ</td>
              <td className="c-sup"></td>
              <td className="c-desc"></td>
              <td className="c-num tot-num">{fmt(totQty24)}</td>
              <td className="c-num tot-num">{fmt(tot24)}</td>
            </tr></table>
          </div>
        </div>
      </div>
    </>
  )
}
