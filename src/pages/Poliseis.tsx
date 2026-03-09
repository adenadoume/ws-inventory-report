import { useMemo, useState } from 'react'
import type { SalesItem, SortMode } from '../types'
import StatCard from '../components/StatCard'
import FiltersBar from '../components/FiltersBar'
import ExcelUpload from '../components/ExcelUpload'

interface Props {
  items: SalesItem[]
  loading: boolean
  onRefresh: () => void
}

function fmt(n: number, dec = 2) {
  return n.toLocaleString('el-GR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function fmtEur(n: number) {
  return '€' + fmt(n)
}

export default function Poliseis({ items, loading, onRefresh }: Props) {
  const [supplier, setSupplier] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortMode>('code')
  const [codeInitial, setCodeInitial] = useState('WS')

  const codeInitials = useMemo(() => {
    const chars = new Set<string>()
    items.forEach(i => {
      if (i.code) chars.add(i.code.charAt(0).toUpperCase())
    })
    return Array.from(chars).sort()
  }, [items])

  const baseFiltered = useMemo(() => {
    let rows = items
    if (codeInitial) {
      if (codeInitial === 'WS') {
        rows = rows.filter(i => i.code.toUpperCase().localeCompare('W') < 0)
      } else {
        rows = rows.filter(i => i.code.toUpperCase().startsWith(codeInitial))
      }
    }
    return rows
  }, [items, codeInitial])

  const suppliers = useMemo(() =>
    [...new Set(items.map(i => i.supplier).filter(Boolean))].sort()
    , [items])

  const totalEur = useMemo(() => baseFiltered.reduce((s, i) => s + i.value_sold, 0), [baseFiltered])

  const filtered = useMemo(() => {
    let rows = baseFiltered
    if (supplier) rows = rows.filter(i => i.supplier === supplier)
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(i => i.code.toLowerCase().includes(q) || i.description.toLowerCase().includes(q))
    }
    if (sort === 'code') {
      rows = [...rows].sort((a, b) => a.code.localeCompare(b.code))
    } else {
      rows = [...rows].sort((a, b) => b.value_sold - a.value_sold)
    }
    return rows
  }, [baseFiltered, supplier, search, sort])

  const filtQty = filtered.reduce((s, i) => s + i.qty_sold, 0)
  const filtEur = filtered.reduce((s, i) => s + i.value_sold, 0)

  if (loading) return (
    <div className="loading-state">
      <span className="loading-state-inner">Φόρτωση πωλήσεων…</span>
    </div>
  )

  return (
    <>
      <div className="cards stagger-children">
        <StatCard value={fmtEur(totalEur)} label="Συνολική Αξία Πωλήσεων" color="orange" />
      </div>

      <div className="animate-fade-in">
        <FiltersBar
          suppliers={suppliers}
          supplier={supplier} onSupplier={setSupplier}
          search={search} onSearch={setSearch}
          codeInitial={codeInitial} onCodeInitial={setCodeInitial} codeInitials={codeInitials}
          filter="all" onFilter={() => { }}
          sort={sort} onSort={setSort}
          countLabel={`${filtered.length.toLocaleString('el-GR')} κωδικοί | Q: ${fmt(filtQty, 0)} | ${fmtEur(filtEur)}`}
          showStatusFilters={false}
          extraRight={
            <ExcelUpload
              table="ws_sales_2025"
              label="Import ΠΩΛΗΣΕΙΣ"
              onDone={() => onRefresh()}
            />
          }
        />
      </div>

      <div className="animate-slide-up single-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="tbl-wrap" style={{ flex: 1, overflowY: 'scroll', overflowX: 'auto' }}>
          <table style={{ tableLayout: 'fixed', width: '100%' }}>
            <thead>
              <tr style={{ background: '#4A1010' }}>
                <th className="c-code" style={{ color: '#FFCCCC', padding: '7px 6px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '2px solid rgba(0,0,0,.3)', position: 'sticky', top: 0, zIndex: 2 }}>ΚΩΔΙΚΟΣ</th>
                <th className="c-sup" style={{ color: '#FFCCCC', padding: '7px 6px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '2px solid rgba(0,0,0,.3)', position: 'sticky', top: 0, zIndex: 2 }}>ΠΡ.</th>
                <th className="c-desc" style={{ color: '#FFCCCC', padding: '7px 6px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '2px solid rgba(0,0,0,.3)', position: 'sticky', top: 0, zIndex: 2 }}>ΠΕΡΙΓΡΑΦΗ</th>
                <th className="c-num" style={{ color: '#FFCCCC', padding: '7px 6px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '2px solid rgba(0,0,0,.3)', position: 'sticky', top: 0, zIndex: 2 }}>ΠΟΣΟΤΗΤΑ</th>
                <th className="c-num" style={{ color: '#FFCCCC', padding: '7px 6px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '2px solid rgba(0,0,0,.3)', position: 'sticky', top: 0, zIndex: 2 }}>ΑΞΙΑ €</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.code} style={{ height: 34, background: i % 2 === 0 ? '#1F0A0A' : '#260D0D' }}>
                  <td className="c-code" style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 14, color: '#FF9999' }}>{r.code}</td>
                  <td className="c-sup" style={{ fontFamily: 'monospace', fontSize: 13, textAlign: 'center', color: '#A8C8E8' }}>{r.supplier}</td>
                  <td className="c-desc" style={{ fontSize: 14 }}>{r.description}</td>
                  <td className="c-num" style={{ color: '#FCA5A5' }}>{r.qty_sold.toLocaleString('el-GR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
                  <td className="c-num" style={{ color: '#FCA5A5' }}>{fmt(r.value_sold)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals bar */}
        <div style={{ flexShrink: 0, background: '#1A0909', borderTop: '2px solid #7A1E1E', padding: '6px 6px' }}>
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <tr>
              <td className="c-code" style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 800, color: '#FFE08A', textTransform: 'uppercase', letterSpacing: '.6px' }}>ΣΥΝΟΛΟ</td>
              <td className="c-sup"></td>
              <td className="c-desc"></td>
              <td className="c-num" style={{ textAlign: 'right', fontWeight: 800, color: '#FCA5A5', fontVariantNumeric: 'tabular-nums' }}>{fmt(filtQty, 0)}</td>
              <td className="c-num" style={{ textAlign: 'right', fontWeight: 800, color: '#FCA5A5', fontVariantNumeric: 'tabular-nums' }}>{fmt(filtEur)}</td>
            </tr>
          </table>
        </div>
      </div>
    </>
  )
}
