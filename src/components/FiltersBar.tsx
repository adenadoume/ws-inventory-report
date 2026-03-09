import type { FilterStatus, SortMode } from '../types'

interface FiltersBarProps {
  suppliers: string[]
  supplier: string
  onSupplier: (v: string) => void
  search: string
  onSearch: (v: string) => void
  codeInitial?: string
  onCodeInitial?: (v: string) => void
  codeInitials?: string[]
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
  codeInitial, onCodeInitial, codeInitials,
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

      {codeInitials && onCodeInitial && (
        <select id="code-init-filter" style={{ background: '#1B2A3B', border: '1px solid #2A5C8A', color: '#E8EDF2', padding: '6px 10px', borderRadius: 4, fontSize: 13, outline: 'none' }} value={codeInitial || ''} onChange={e => onCodeInitial(e.target.value)}>
          <option value="WS">WS</option>
          <option value="">A-Z</option>
          {codeInitials.map(ch => <option key={ch} value={ch}>{ch}</option>)}
        </select>
      )}

      <div className="sort-grp">
        <span className="sort-grp-lbl">ΤΑΞΙΝΟΜΗΣΗ:</span>
        <button
          className={`sort-btn${sort === 'code' ? ' active' : ''}`}
          onClick={() => onSort('code')}
        >ΚΩΔΙΚΟΣ</button>
        <button
          className={`sort-btn${sort === 'cost' ? ' active' : ''}`}
          onClick={() => onSort('cost')}
        >ΑΞΙΑ</button>
      </div>

      <input
        id="search"
        type="text"
        placeholder="🔍  Αναζήτηση…"
        value={search}
        onChange={e => onSearch(e.target.value)}
      />

      {showStatusFilters && (
        <>
          <button className={`filter-btn f-all${filter === 'all' ? ' active' : ''}`} onClick={() => onFilter('all')}>Όλα</button>
          <button className={`filter-btn f-missing${filter === 'missing' ? ' active' : ''}`} onClick={() => onFilter('missing')}>Απόντα</button>
          <button className={`filter-btn f-new${filter === 'new' ? ' active' : ''}`} onClick={() => onFilter('new')}>Νέα</button>
          <button className={`filter-btn f-changed${filter === 'changed' ? ' active' : ''}`} onClick={() => onFilter('changed')}>Αλλαγές</button>
          <button className={`filter-btn f-same${filter === 'same' ? ' active' : ''}`} onClick={() => onFilter('same')}>Ίδια</button>
        </>
      )}

      {extraRight && <>{extraRight}</>}
      {countLabel && <span id="count-label">{countLabel}</span>}
    </div>
  )
}
