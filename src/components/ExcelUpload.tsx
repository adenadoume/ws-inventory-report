import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'

interface ExcelUploadProps {
  table: 'sales_2025' | 'buys_2025'
  label: string
  onDone?: (count: number) => void
}

// Extract supplier code from description: "B172 BASKET..." → "B172"
function extractSupplier(desc: string): string {
  const m = desc?.match(/^([A-Za-z]\d{1,3})\s/)
  return m ? m[1].toUpperCase() : ''
}

export default function ExcelUpload({ table, label, onDone }: ExcelUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [lastUpload, setLastUpload] = useState<string | null>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)

      // Map columns (Greek headers: Κωδικός, Περιγραφή, Ποσότητα, Αξία)
      const records = rows.map(row => {
        const code = String(row['Κωδικός'] ?? row['code'] ?? '').trim()
        const description = String(row['Περιγραφή'] ?? row['description'] ?? '').trim()
        const qty = Number(row['Ποσότητα'] ?? row['qty'] ?? 0)
        const value = Number(row['Αξία'] ?? row['value'] ?? 0)
        const supplier = extractSupplier(description)
        if (table === 'sales_2025') {
          return { code, description, supplier, qty_sold: qty, value_sold: value }
        } else {
          return { code, description, supplier, qty_bought: qty, value_bought: value }
        }
      }).filter((r): r is NonNullable<typeof r> => r.code.length > 0)

      // Clear existing rows, then insert
      await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')

      const BATCH = 500
      for (let i = 0; i < records.length; i += BATCH) {
        await supabase.from(table).insert(records.slice(i, i + BATCH))
      }

      // Log upload history
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('inv_upload_history').insert({
        table_name: table,
        filename: file.name,
        row_count: records.length,
        uploaded_by: user?.email ?? 'unknown',
      })

      setLastUpload(`${records.length} εγγραφές — ${file.name}`)
      onDone?.(records.length)
    } catch (err) {
      alert('Σφάλμα ανάγνωσης αρχείου: ' + String(err))
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label className="btn-upload">
        <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={handleFile} />
        {loading ? '⏳ Φόρτωση…' : `⬆ ${label}`}
      </label>
      {lastUpload && <span className="upload-info">{lastUpload}</span>}
    </div>
  )
}
