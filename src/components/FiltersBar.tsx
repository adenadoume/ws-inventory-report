import type { FilterStatus, SortMode } from '../types'

interface FiltersBarProps {
  suppliers: string[]
  supplier: string
  onSupplier: (v: string) => void
  search: string
  onSearch: (v: string) => void
  filter: FilterStatus
  onFilter: (v: FilterStatus) => void
  sort: SortMode
  onSort: (v: SortMode) => void
  countLabel?: string
  showStatusFilters?: boolean
  extraRight?: React.ReactNode
}

export default function FiltersBar({
  suppliers, supplier, onSupplier,
  search, onSearch,
  filter, onFilter,
  sort, onSort,
  countLabel,
  showStatusFilters = true,
  extraRight,
}: FiltersBarProps) {
  return (
    <div id="controls">
      <select id="sup-filter" value={supplier} onChange={e => onSupplier(e.target.value)}>
        <option value="">Όλοι οι Προμηθευτές</option>
        {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
      </select>

      <div className="sort-grp">
        <span className="sort-grp-lbl">ΤΑΞΙΝΟΜΗΣΗ:</span>
        <button
          className={`sort-btn${sort === 'code' ? ' active' : ''}`}
          onClick={() => onSort('code')}
        >≡ ΚΩΔΙΚΟΣ ↑</button>
        <button
          className={`sort-btn${sort === 'cost' ? ' active' : ''}`}
          onClick={() => onSort('cost')}
        >⬇ ΑΞΙΑ ↓</button>
      </div>

      <input
        id="search"
        type="text"
        placeholder="🔍  Αναζήτηση κωδικού ή περιγραφής…"
        value={search}
        onChange={e => onSearch(e.target.value)}
      />

      {showStatusFilters && (
        <>
          <button className={`filter-btn f-all${filter === 'all' ? ' active' : ''}`} onClick={() => onFilter('all')}>Όλα</button>
          <button className={`filter-btn f-missing${filter === 'missing' ? ' active' : ''}`} onClick={() => onFilter('missing')}>⚠ Απόντα 2025</button>
          <button className={`filter-btn f-new${filter === 'new' ? ' active' : ''}`} onClick={() => onFilter('new')}>✦ Νέα 2025</button>
          <button className={`filter-btn f-changed${filter === 'changed' ? ' active' : ''}`} onClick={() => onFilter('changed')}>● Αλλαγές</button>
          <button className={`filter-btn f-same${filter === 'same' ? ' active' : ''}`} onClick={() => onFilter('same')}>=  Αμετάβλητα</button>
        </>
      )}

      {extraRight && <>{extraRight}</>}
      {countLabel && <span id="count-label">{countLabel}</span>}
    </div>
  )
}
