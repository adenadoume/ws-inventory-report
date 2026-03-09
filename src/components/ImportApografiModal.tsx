/**
 * Modal for importing both 2024 and 2025 Excel files (matches APOGRAFI_DIFF.html import modal).
 */
import { useState, useRef } from 'react'
import { parseInventoryExcel } from '../lib/parseInventoryExcel'
import { applyInventoryMerge } from '../lib/applyInventoryYear'

interface Props {
  open: boolean
  onClose: () => void
  onDone?: () => void
}

export default function ImportApografiModal({ open, onClose, onDone }: Props) {
  const [processing, setProcessing] = useState(false)
  const [fileNewName, setFileNewName] = useState('δεν έχει επιλεγεί')
  const [fileOldName, setFileOldName] = useState('δεν έχει επιλεγεί')
  const fileNewRef = useRef<HTMLInputElement>(null)
  const fileOldRef = useRef<HTMLInputElement>(null)

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
        alert('Δεν βρέθηκαν γραμμές με κωδικό στο παλιό αρχείο (2024). Ελέγξτε τις στήλες A=ΚΩΔΙΚΟΣ, B=ΠΕΡΙΓΡΑΦΗ, C=ΠΟΣΟΤΗΤΑ, D=ΑΞΙΑ ή αγγλικές κεφαλίδες.')
        return
      }
      if (parsedNew.length === 0) {
        alert('Δεν βρέθηκαν γραμμές με κωδικό στο νέο αρχείο (2025). Ελέγξτε τις στήλες A=ΚΩΔΙΚΟΣ, B=ΠΕΡΙΓΡΑΦΗ, C=ΠΟΣΟΤΗΤΑ, D=ΑΞΙΑ ή αγγλικές κεφαλίδες.')
        return
      }
      await applyInventoryMerge(parsedOld, parsedNew, `2024_${fOld.name}+2025_${fNew.name}`)
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
          <label>📗 ΝΕΟ ΑΡΧΕΙΟ — αριστερό panel (π.χ. APOGRAFI 31DEC25.xlsx)</label>
          <input
            ref={fileNewRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={e => setFileNewName(e.target.files?.[0]?.name ?? 'δεν έχει επιλεγεί')}
          />
          <span className="import-fname">{fileNewName}</span>
        </div>
        <div className="import-field">
          <label>📘 ΠΑΛΑΙΟ ΑΡΧΕΙΟ — δεξί panel (π.χ. APOGRAFI 31DEC24.xlsx)</label>
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
