import { useMemo } from 'react'

import type { InventoryItem, SalesItem, BuysItem } from '../types'

interface Props {
    code: string
    items: InventoryItem[]
    sales: SalesItem[]
    buys: BuysItem[]
    onClose: () => void
}

function fmtQty(n: number | null | undefined) {
    if (n == null) return '—'
    return n.toLocaleString('el-GR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function fmtEur(n: number | null | undefined) {
    if (n == null) return '—'
    return '€' + n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ItemHistoryModal({ code, items, sales, buys, onClose }: Props) {

    const data = useMemo(() => {
        const inv = items.find(i => i.code === code)
        if (!inv) return null

        const sls = sales.find(s => s.code === code)
        const bys = buys.find(b => b.code === code)

        const q24 = inv.q_2024 ?? 0
        const cost24 = inv.cost_2024 ?? 0
        const slsQ = sls?.qty_sold ?? 0
        const bysQ = bys?.qty_bought ?? 0
        const expQ25 = q24 + bysQ - slsQ
        const actQ25 = inv.q_2025 ?? null
        const cost25 = inv.cost_2025 ?? null

        let unitCost = 0
        if (actQ25 && actQ25 > 0 && cost25) {
            unitCost = cost25 / actQ25
        } else if (q24 > 0 && cost24) {
            unitCost = cost24 / q24
        }

        const expVal = expQ25 * unitCost
        const actVal = cost25 ?? 0
        const diffQ = actQ25 != null ? actQ25 - expQ25 : null
        const diffVal = actQ25 != null ? actVal - expVal : null

        return {
            inv,
            slsQ,
            bysQ,
            expQ25,
            actQ25,
            expVal,
            actVal,
            diffQ,
            diffVal,
            unitCost
        }
    }, [items, sales, buys, code])

    if (!data) return null

    return (
        <div className="import-modal open" style={{ zIndex: 9999 }}>
            <div className="import-box" style={{ maxWidth: 640 }}>
                <h2>ΚΑΡΤΕΛΑ ΕΙΔΟΥΣ: {code}</h2>
                <div className="import-note" style={{ marginBottom: 12 }}>
                    <strong>ΣΥΝΟΨΗ ΚΙΝΗΣΗΣ</strong> - Προμηθευτής: {data.inv.supplier}
                    <br />
                    <span style={{ color: '#C8DEFF' }}>{data.inv.description}</span>
                </div>

                <table style={{ width: '100%', marginBottom: 16 }}>
                    <tbody>
                        <tr>
                            <td style={{ padding: 8, borderBottom: '1px solid #2A5C8A', color: '#7FA8C9' }}>Απόθεμα 2024</td>
                            <td style={{ padding: 8, borderBottom: '1px solid #2A5C8A', textAlign: 'right', fontWeight: 700 }}>{fmtQty(data.inv.q_2024)} Q</td>
                            <td style={{ padding: 8, borderBottom: '1px solid #2A5C8A', textAlign: 'right', color: '#E8F4FF' }}>{fmtEur(data.inv.cost_2024)}</td>
                        </tr>
                        <tr>
                            <td style={{ padding: 8, borderBottom: '1px solid #2A5C8A', color: '#7FA8C9' }}>Αγορές (+)</td>
                            <td style={{ padding: 8, borderBottom: '1px solid #2A5C8A', textAlign: 'right', color: '#86EFAC', fontWeight: 700 }}>{fmtQty(data.bysQ)} Q</td>
                            <td style={{ padding: 8, borderBottom: '1px solid #2A5C8A' }}></td>
                        </tr>
                        <tr>
                            <td style={{ padding: 8, borderBottom: '1px solid #2A5C8A', color: '#7FA8C9' }}>Πωλήσεις (-)</td>
                            <td style={{ padding: 8, borderBottom: '1px solid #2A5C8A', textAlign: 'right', color: '#FCA5A5', fontWeight: 700 }}>{fmtQty(data.slsQ)} Q</td>
                            <td style={{ padding: 8, borderBottom: '1px solid #2A5C8A' }}></td>
                        </tr>
                        <tr style={{ background: '#0D1B2A' }}>
                            <td style={{ padding: 8, borderBottom: '1px solid #2A5C8A', color: '#DDA0DD', fontWeight: 700 }}>Αναμενόμενο 2025</td>
                            <td style={{ padding: 8, borderBottom: '1px solid #2A5C8A', textAlign: 'right', color: '#DDA0DD', fontWeight: 700 }}>{fmtQty(data.expQ25)} Q</td>
                            <td style={{ padding: 8, borderBottom: '1px solid #2A5C8A', textAlign: 'right', color: '#E8F4FF', fontWeight: 700 }}>{fmtEur(data.expVal)}</td>
                        </tr>
                        <tr style={{ background: '#1B2A3B' }}>
                            <td style={{ padding: 8, borderBottom: '1px solid #2A5C8A', color: '#7DD3FC', fontWeight: 700 }}>Πραγματικό 2025</td>
                            <td style={{ padding: 8, borderBottom: '1px solid #2A5C8A', textAlign: 'right', color: '#7DD3FC', fontWeight: 700 }}>{fmtQty(data.actQ25)} Q</td>
                            <td style={{ padding: 8, borderBottom: '1px solid #2A5C8A', textAlign: 'right', color: '#E8F4FF', fontWeight: 700 }}>{fmtEur(data.actVal)}</td>
                        </tr>
                        <tr>
                            <td style={{ padding: 8, borderBottom: '1px solid #2A5C8A', color: '#FFE08A', fontWeight: 700 }}>Διαφορά (Έλλειμμα / Πλεόνασμα)</td>
                            <td style={{ padding: 8, borderBottom: '1px solid #2A5C8A', textAlign: 'right', color: data.diffQ && data.diffQ < 0 ? '#FCA5A5' : '#86EFAC', fontWeight: 700 }}>
                                {data.diffQ != null && Math.abs(data.diffQ) > 0.001 ? (data.diffQ > 0 ? '+' : '') + fmtQty(data.diffQ) + ' Q' : '—'}
                            </td>
                            <td style={{ padding: 8, borderBottom: '1px solid #2A5C8A', textAlign: 'right', color: data.diffVal && data.diffVal < 0 ? '#FCA5A5' : '#86EFAC', fontWeight: 700 }}>
                                {data.diffVal != null && Math.abs(data.diffVal) > 0.001 ? (data.diffVal > 0 ? '+' : '') + fmtEur(data.diffVal) : '—'}
                            </td>
                        </tr>
                    </tbody>
                </table>

                <div className="import-actions" style={{ justifyContent: 'center' }}>
                    <button type="button" className="import-btn cancel" onClick={onClose} style={{ width: '100%' }}>
                        Κλείσιμο
                    </button>
                </div>
            </div>
        </div>
    )
}
