/**
 * Modal for importing both oldYear and newYear Excel files.
 */
import { useState, useRef } from 'react'
import { parseInventoryExcel } from '../lib/parseInventoryExcel'
import { applyInventoryMerge } from '../lib/applyInventoryYear'
import { useYearConfig } from '../hooks/useYearConfig'

interface Props {
  open: boolean
  onClose: () => void
  onDone?: () => void
}

export default function ImportApografiModal({ open, onClose, onDone }: Props) {
  const { newYear, oldYear, update } = useYearConfig()
  const [processing, setProcessing] = useState(false)
  const [fileNewName, setFileNewName] = useState('δεν έχει επιλεγεί')
  const [fileOldName, setFileOldName] = useState('δεν έχει επιλεγεί')
  const [editingYear, setEditingYear] = useState<'new' | 'old' | null>(null)
  const [yearInput, setYearInput] = useState('')
  const fileNewRef = useRef<HTMLInputElement>(null)
  const fileOldRef = useRef<HTMLInputElement>(null)

  const startEditYear = (which: 'new' | 'old') => {
    setEditingYear(which)
    setYearInput(String(which === 'new' ? newYear : oldYear))
  }

  const confirmEditYear = () => {
    const val = parseInt(yearInput, 10)
    if (!val || val < 2000 || val > 2100) {
      alert('Μη έγκυρο έτος.')
      return
    }
    if (editingYear === 'new') update({ newYear: val })
    else update({ oldYear: val })
    setEditingYear(null)
  }

  const handleProcess = async () => {
    const fNew = fileNewRef.current?.files?.[0]
    const fOld = fileOldRef.current?.files?.[0]
    if (!fNew || !fOld) {
      alert('Επιλέξτε και τα δύο αρχεία πριν συνεχίσετε.')
      return
    }
    setProcessing(true)
    try {
      const bufNew = await fNew.arrayBuffer()
      const bufOld = await fOld.arrayBuffer()
      const parsedNew = parseInventoryExcel(bufNew)
      const parsedOld = parseInventoryExcel(bufOld)
      if (parsedOld.length === 0) {
        alert(`Δεν βρέθηκαν γραμμές με κωδικό στο αρχείο ${oldYear}. Ελέγξτε τις στήλες A=ΚΩΔΙΚΟΣ, B=ΠΕΡΙΓΡΑΦΗ, C=ΠΟΣΟΤΗΤΑ, D=ΑΞΙΑ ή αγγλικές κεφαλίδες.`)
        return
      }
      if (parsedNew.length === 0) {
        alert(`Δεν βρέθηκαν γραμμές με κωδικό στο αρχείο ${newYear}. Ελέγξτε τις στήλες A=ΚΩΔΙΚΟΣ, B=ΠΕΡΙΓΡΑΦΗ, C=ΠΟΣΟΤΗΤΑ, D=ΑΞΙΑ ή αγγλικές κεφαλίδες.`)
        return
      }
      await applyInventoryMerge(parsedOld, parsedNew, `${oldYear}_${fOld.name}+${newYear}_${fNew.name}`)
      onClose()
      onDone?.()
    } catch (err) {
      const o = err && typeof err === 'object' ? (err as Record<string, unknown>) : null
      let msg =
        err instanceof Error ? err.message
        : typeof o?.message === 'string' ? o.message
        : typeof o?.details === 'string' ? o.details
        : String(err)
      if (msg === '[object Object]') msg = o ? JSON.stringify(o) : String(err)
      console.error('Import error:', err)
      alert('Σφάλμα ανάγνωσης: ' + msg)
    } finally {
      setProcessing(false)
    }
  }

  if (!open) return null

  const yearBtnStyle = {
    background: 'transparent',
    border: '1px solid #3B82F6',
    borderRadius: '4px',
    color: '#60A5FA',
    padding: '1px 7px',
    cursor: 'pointer',
    fontSize: '12px',
    marginLeft: '6px',
  }

  const renderYearBadge = (which: 'new' | 'old') => {
    const year = which === 'new' ? newYear : oldYear
    if (editingYear === which) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 6 }}>
          <input
            value={yearInput}
            onChange={e => setYearInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') confirmEditYear(); if (e.key === 'Escape') setEditingYear(null) }}
            autoFocus
            style={{ width: 64, background: '#0D1B2A', border: '1px solid #3B82F6', borderRadius: 4, color: '#FFF', padding: '2px 6px', fontSize: 13 }}
          />
          <button onClick={confirmEditYear} style={{ ...yearBtnStyle, background: '#10B981', border: 'none', color: '#FFF' }}>OK</button>
          <button onClick={() => setEditingYear(null)} style={{ ...yearBtnStyle, color: '#9CA3AF' }}>✕</button>
        </span>
      )
    }
    return (
      <span>
        <strong style={{ color: which === 'new' ? '#34D399' : '#93C5FD' }}>{year}</strong>
        <button style={yearBtnStyle} onClick={() => startEditYear(which)} title="Αλλαγή έτους">✏</button>
      </span>
    )
  }

  return (
    <div id="import-modal" className="import-modal open" role="dialog" aria-labelledby="import-modal-title">
      <div id="import-box" className="import-box">
        <h2 id="import-modal-title">⬆ ΕΙΣΑΓΩΓΗ ΝΕΩΝ ΑΡΧΕΙΩΝ EXCEL</h2>
        <div className="import-note">
          Επιλέξτε τα δύο αρχεία Excel από το Softone.<br />
          Κάθε αρχείο πρέπει να έχει στο <strong>2ο φύλλο</strong> (φύλλο δεδομένων) τις στήλες:<br />
          <code>Στήλη A = ΚΩΔΙΚΟΣ &nbsp;|&nbsp; B = ΠΕΡΙΓΡΑΦΗ &nbsp;|&nbsp; C = ΠΟΣΟΤΗΤΑ &nbsp;|&nbsp; D = ΑΞΙΑ ΧΩΡΙΣ ΦΠΑ</code><br />
          (Ελληνικές ή αγγλικές κεφαλίδες: code, description, qty, value)<br />
          Ο κωδικός προμηθευτή εξάγεται αυτόματα από την περιγραφή (π.χ. <code>B172 BASKET…</code> → <code>B172</code>).
        </div>
        <div className="import-field">
          <label>📗 ΝΕΟ ΑΡΧΕΙΟ {renderYearBadge('new')} — αριστερό panel (π.χ. APOGRAFI 31DEC{String(newYear).slice(2)}.xlsx)</label>
          <input
            ref={fileNewRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={e => setFileNewName(e.target.files?.[0]?.name ?? 'δεν έχει επιλεγεί')}
          />
          <span className="import-fname">{fileNewName}</span>
        </div>
        <div className="import-field">
          <label>📘 ΠΑΛΑΙΟ ΑΡΧΕΙΟ {renderYearBadge('old')} — δεξί panel (π.χ. APOGRAFI 31DEC{String(oldYear).slice(2)}.xlsx)</label>
          <input
            ref={fileOldRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={e => setFileOldName(e.target.files?.[0]?.name ?? 'δεν έχει επιλεγεί')}
          />
          <span className="import-fname">{fileOldName}</span>
        </div>
        <div className="import-actions">
          <button type="button" className="import-btn cancel" onClick={onClose} disabled={processing}>
            ✕ Ακύρωση
          </button>
          <button
            type="button"
            className="import-btn process"
            id="btn-process-import"
            onClick={handleProcess}
            disabled={processing}
          >
            {processing ? '⏳ Επεξεργασία…' : '▶ Επεξεργασία'}
          </button>
        </div>
      </div>
    </div>
  )
}
