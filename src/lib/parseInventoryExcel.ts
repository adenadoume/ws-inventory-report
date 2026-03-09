/**
 * Parse inventory Excel: accept headers in Greek or English, or use column order A=code, B=desc, C=qty, D=value.
 * Uses array-based reading and header detection to avoid "Δεν βρέθηκαν γραμμές με κωδικό".
 */
import * as XLSX from 'xlsx'

const CODE_HEADERS = ['κωδικός', 'code', 'κωδικος', 'κωδ', 'κωδ.', 'cod', 'item', 'article']
const DESC_HEADERS = ['περιγραφή', 'description', 'περιγραφη', 'περιγραφ', 'desc', 'name']
const QTY_HEADERS = ['ποσότητα', 'quantity', 'qty', 'ποσοτητα', 'ποσοτ', 'qty.', 'amount']
const VALUE_HEADERS = ['αξία', 'αξια', 'value', 'cost', 'αξια χωρις φπα', 'αξία χωρίς φπα', 'price', 'τιμή', 'τιμη']

function normalize(s: unknown): string {
  if (s == null) return ''
  return String(s).trim().toLowerCase().replace(/\s+/g, ' ')
}

function cellMatches(cell: unknown, options: string[]): boolean {
  const n = normalize(cell)
  if (!n) return false
  return options.some(opt => n === opt || n.includes(opt) || opt.includes(n))
}

function rowToArray(row: unknown): unknown[] {
  if (Array.isArray(row)) return row
  if (row && typeof row === 'object') {
    const o = row as Record<string | number, unknown>
    const keys = Object.keys(o).filter(k => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b)
    return keys.map(k => o[k])
  }
  return []
}

function findColumnIndex(headerRow: unknown[], columnHeaders: string[]): number {
  const arr = rowToArray(headerRow)
  for (let c = 0; c < arr.length; c++) {
    if (cellMatches(arr[c], columnHeaders)) return c
  }
  return -1
}

function isHeaderRow(row: unknown[]): boolean {
  const first = normalize(row[0])
  if (!first) return false
  return cellMatches(row[0], CODE_HEADERS) || first === 'code' || first.includes('κωδ')
}

export interface ParsedInventoryRow {
  code: string
  description: string
  supplier: string
  qty: number
  value: number
}

export function extractSupplier(desc: string): string {
  const m = desc?.match(/^([A-Za-z]\d{1,3})\s/)
  return m ? m[1].toUpperCase() : ''
}

function getCell(row: unknown[], idx: number): string {
  if (idx < 0) return ''
  const v = row[idx]
  if (v == null) return ''
  return String(v).trim()
}

function getNum(row: unknown[], idx: number): number {
  const s = getCell(row, idx)
  if (!s) return 0
  const n = parseFloat(s.replace(/,/g, '.').replace(/\s/g, ''))
  return Number.isFinite(n) ? n : 0
}

/**
 * Parse one sheet (2nd sheet by default for Softone export) into inventory rows.
 * - Reads sheet as rows; finds header row by matching known column names (Greek/English).
 * - Maps columns by header or falls back to A=0, B=1, C=2, D=3.
 * - Skips empty code cells and rows that look like headers.
 */
function parseSheet(ws: XLSX.WorkSheet): ParsedInventoryRow[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })
  if (!rows.length) return []

  let dataStartRow = 0
  let codeCol = 0
  let descCol = 1
  let qtyCol = 2
  let valueCol = 3

  for (let r = 0; r < Math.min(rows.length, 5); r++) {
    const rowArr = rowToArray(rows[r])
    if (rowArr.length && isHeaderRow(rowArr)) {
      const ic = findColumnIndex(rowArr, CODE_HEADERS)
      if (ic >= 0) {
        dataStartRow = r + 1
        codeCol = ic
        descCol = findColumnIndex(rowArr, DESC_HEADERS)
        if (descCol < 0) descCol = codeCol + 1
        qtyCol = findColumnIndex(rowArr, QTY_HEADERS)
        if (qtyCol < 0) qtyCol = codeCol + 2
        valueCol = findColumnIndex(rowArr, VALUE_HEADERS)
        if (valueCol < 0) valueCol = codeCol + 3
        break
      }
    }
  }

  const out: ParsedInventoryRow[] = []
  for (let i = dataStartRow; i < rows.length; i++) {
    const r = rowToArray(rows[i])
    const code = getCell(r, codeCol)
    if (!code) continue
    if (isHeaderRow(r)) continue
    if (cellMatches(code, CODE_HEADERS) || cellMatches(code, DESC_HEADERS)) continue
    const description = getCell(r, descCol)
    const qty = getNum(r, qtyCol)
    const value = getNum(r, valueCol)
    out.push({
      code,
      description,
      supplier: extractSupplier(description),
      qty,
      value,
    })
  }
  return out
}

export function parseInventoryExcel(
  buffer: ArrayBuffer,
  sheetIndex?: number
): ParsedInventoryRow[] {
  const wb = XLSX.read(buffer, { type: 'array' })
  const tryIndices = sheetIndex !== undefined
    ? [sheetIndex]
    : wb.SheetNames.length > 1
      ? [1, 0]
      : [0]
  for (const idx of tryIndices) {
    const sheetName = wb.SheetNames[idx]
    const ws = wb.Sheets[sheetName]
    if (!ws) continue
    const result = parseSheet(ws)
    if (result.length > 0) return result
  }
  return []
}
