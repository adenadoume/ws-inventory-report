/**
 * Import Excel for ΑΠΟΓΡΑΦΗ: replace data for 2024 or 2025.
 * Headers: Greek or English (Κωδικός/code, Περιγραφή/description, Ποσότητα/qty, Αξία/value).
 */
import { useRef, useState } from 'react'
import { parseInventoryExcel } from '../lib/parseInventoryExcel'
import { applyInventoryYear } from '../lib/applyInventoryYear'

const EXCEL_COLUMNS = [
  { key: 'Κωδικός', en: 'code', required: true },
  { key: 'Περιγραφή', en: 'description', required: true },
  { key: 'Ποσότητα', en: 'qty', required: true },
  { key: 'Αξία', en: 'value', required: true },
] as const

interface Props {
  year: '2024' | '2025'
  label: string
  onDone?: () => void
  compact?: boolean
}

export default function InventoryExcelUpload({ year, label, onDone, compact = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [lastUpload, setLastUpload] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setLastUpload(null)
    try {
      const buffer = await file.arrayBuffer()
      const parsed = parseInventoryExcel(buffer)
      if (parsed.length === 0) {
        alert('Δεν βρέθηκαν γραμμές με κωδικό. Ελέγξτε ότι το 2ο φύλλο έχει στήλες A=ΚΩΔΙΚΟΣ, B=ΠΕΡΙΓΡΑΦΗ, C=ΠΟΣΟΤΗΤΑ, D=ΑΞΙΑ (ή αγγλικές κεφαλίδες).')
        return
      }

      await applyInventoryYear(year, parsed, `${year}_${file.name}`)
      setLastUpload(`${parsed.length} εγγραφές (${year}) — ${file.name}`)
      onDone?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : (err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : String(err))
      console.error('Inventory upload error:', err)
      alert('Σφάλμα: ' + msg)
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className={compact ? 'inventory-upload-inline' : 'inventory-upload-block'}>
      <label className="btn-upload">
        <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={handleFile} />
        {loading ? '⏳' : label}
      </label>
      {!compact && lastUpload && <span className="upload-info">{lastUpload}</span>}
      {compact && lastUpload && <span className="upload-info-compact" title={lastUpload}>{lastUpload.split('—')[0]}</span>}
      {!compact && (
        <>
          <button type="button" className="excel-help-btn" onClick={() => setShowHelp(!showHelp)} title="Οδηγίες Excel">
            {showHelp ? '▼' : '?'} Excel
          </button>
          {showHelp && (
            <div className="excel-instruction" role="region" aria-label="Οδηγίες στήλων Excel">
              <p className="excel-instruction-title">Στήλες Excel (πρώτη γραμμή = κεφαλίδες)</p>
              <ul>
                {EXCEL_COLUMNS.map(({ key, en, required }) => (
                  <li key={key}>
                    <strong>{key}</strong> {(en as string) !== (key as string) ? `(ή ${en})` : ''} — {required ? 'υποχρεωτικό' : 'προαιρετικό'}
                  </li>
                ))}
              </ul>
              <p className="excel-instruction-note">
                Το πεδίο ΠΡ. (προμηθευτής) προέρχεται από την αρχή της περιγραφής (π.χ. «B172 …» → B172) αν δεν υπάρχει ξεχωριστή στήλη.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
