import { useMemo, useState } from 'react'
import type { BuysItem, SortMode } from '../types'
import StatCard from '../components/StatCard'
import FiltersBar from '../components/FiltersBar'
import ExcelUpload from '../components/ExcelUpload'

interface Props {
  items: BuysItem[]
  loading: boolean
  onRefresh: () => void
}

function fmt(n: number, dec = 2) {
  return n.toLocaleString('el-GR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
function fmtEur(n: number) {
  return '€' + fmt(n)
}

export default function Agores({ items, loading, onRefresh }: Props) {
  const [supplier, setSupplier] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortMode>('code')

  const suppliers = useMemo(() =>
    [...new Set(items.map(i => i.supplier).filter(Boolean))].sort()
  , [items])

  const totalQty = useMemo(() => items.reduce((s, i) => s + i.qty_bought, 0), [items])
  const totalEur = useMemo(() => items.reduce((s, i) => s + i.value_bought, 0), [items])

  const filtered = useMemo(() => {
    let rows = items
    if (supplier) rows = rows.filter(i => i.supplier === supplier)
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(i => i.code.toLowerCase().includes(q) || i.description.toLowerCase().includes(q))
    }
    if (sort === 'code') {
      rows = [...rows].sort((a, b) => a.code.localeCompare(b.code))
    } else {
      rows = [...rows].sort((a, b) => b.value_bought - a.value_bought)
    }
    return rows
  }, [items, supplier, search, sort])

  const filtQty = filtered.reduce((s, i) => s + i.qty_bought, 0)
  const filtEur = filtered.reduce((s, i) => s + i.value_bought, 0)

  if (loading) return <div style={{ padding: 40, color: '#7FA8C9' }}>Φόρτωση αγορών…</div>

  return (
    <>
      <div className="cards">
        <StatCard value={items.length.toLocaleString('el-GR')} label="Κωδικοί Αγορών" color="green" />
        <StatCard value={fmt(totalQty, 0)} label="Συνολική Ποσότητα" color="green" />
        <StatCard value={fmtEur(totalEur)} label="Συνολική Αξία Αγορών" color="teal" />
      </div>

      <FiltersBar
        suppliers={suppliers}
        supplier={supplier} onSupplier={setSupplier}
        search={search} onSearch={setSearch}
        filter="all" onFilter={() => {}}
        sort={sort} onSort={setSort}
        countLabel={`${filtered.length.toLocaleString('el-GR')} κωδικοί | Q: ${fmt(filtQty, 0)} | ${fmtEur(filtEur)}`}
        showStatusFilters={false}
        extraRight={
          <ExcelUpload
            table="buys_2025"
            label="Import ΑΓΟΡΕΣ"
            onDone={() => onRefresh()}
          />
        }
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="tbl-wrap" style={{ flex: 1, overflowY: 'scroll', overflowX: 'auto' }}>
          <table style={{ tableLayout: 'fixed', width: '100%' }}>
            <thead>
              <tr style={{ background: '#0E4D2E' }}>
                <th className="c-code" style={{ color: '#C8FFDB', padding: '7px 6px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '2px solid rgba(0,0,0,.3)', position: 'sticky', top: 0, zIndex: 2 }}>ΚΩΔΙΚΟΣ</th>
                <th className="c-sup"  style={{ color: '#C8FFDB', padding: '7px 6px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '2px solid rgba(0,0,0,.3)', position: 'sticky', top: 0, zIndex: 2 }}>ΠΡ.</th>
                <th className="c-desc" style={{ color: '#C8FFDB', padding: '7px 6px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '2px solid rgba(0,0,0,.3)', position: 'sticky', top: 0, zIndex: 2 }}>ΠΕΡΙΓΡΑΦΗ</th>
                <th className="c-num"  style={{ color: '#C8FFDB', padding: '7px 6px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '2px solid rgba(0,0,0,.3)', position: 'sticky', top: 0, zIndex: 2 }}>ΠΟΣΟΤΗΤΑ</th>
                <th className="c-num"  style={{ color: '#C8FFDB', padding: '7px 6px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px', borderBottom: '2px solid rgba(0,0,0,.3)', position: 'sticky', top: 0, zIndex: 2 }}>ΑΞΙΑ €</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.code} style={{ height: 27, background: i % 2 === 0 ? '#0A1F12' : '#0D2416' }}>
                  <td className="c-code" style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 11, color: '#99FFBB' }}>{r.code}</td>
                  <td className="c-sup"  style={{ fontFamily: 'monospace', fontSize: 10, textAlign: 'center', color: '#A8C8E8' }}>{r.supplier}</td>
                  <td className="c-desc" style={{ fontSize: 11 }}>{r.description}</td>
                  <td className="c-num"  style={{ color: '#86EFAC' }}>{r.qty_bought.toLocaleString('el-GR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</td>
                  <td className="c-num"  style={{ color: '#86EFAC' }}>{fmt(r.value_bought)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals bar */}
        <div style={{ flexShrink: 0, background: '#091A10', borderTop: '2px solid #1A7A4A', padding: '6px 6px' }}>
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
            <tr>
              <td className="c-code" style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 800, color: '#FFE08A', textTransform: 'uppercase', letterSpacing: '.6px' }}>ΣΥΝΟΛΟ</td>
              <td className="c-sup"></td>
              <td className="c-desc"></td>
              <td className="c-num" style={{ textAlign: 'right', fontWeight: 800, color: '#86EFAC', fontVariantNumeric: 'tabular-nums' }}>{fmt(filtQty, 0)}</td>
              <td className="c-num" style={{ textAlign: 'right', fontWeight: 800, color: '#86EFAC', fontVariantNumeric: 'tabular-nums' }}>{fmt(filtEur)}</td>
            </tr>
          </table>
        </div>
      </div>
    </>
  )
}
