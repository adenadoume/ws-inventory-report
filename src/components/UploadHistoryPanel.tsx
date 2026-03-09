import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { UploadHistory } from '../types'
import { createMasterSnapshot } from '../lib/snapshot'

interface Props {
    open: boolean
    onClose: () => void
    onRestoreSnapshot: (tableName: string, snapshotData: any[]) => void
}

interface HistoryWithPayload extends UploadHistory {
    data_payload?: any[]
}

export default function UploadHistoryPanel({ open, onClose, onRestoreSnapshot }: Props) {
    const [history, setHistory] = useState<HistoryWithPayload[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!open) return
        loadHistory()
    }, [open])

    const loadHistory = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('ws_upload_history')
            .select('*')
            .eq('table_name', 'master_snapshot')
            .order('uploaded_at', { ascending: false })
            .limit(50)

        if (!error && data) {
            setHistory(data)
        }
        setLoading(false)
    }

    const handleRestore = (item: HistoryWithPayload) => {
        if (!item.data_payload) {
            alert('Αυτή η εγγραφή δεν περιέχει αποθηκευμένα δεδομένα (data_payload είναι κενό).')
            return
        }
        if (confirm(`Είστε σίγουροι ότι θέλετε να φορτώσετε το snapshot "${item.filename}";\n\nΑυτό θα διαγράψει τα τρέχοντα δεδομένα (Απογραφή, Αγορές, Πωλήσεις) και θα τα αντικαταστήσει πλήρως με τα δεδομένα του snapshot.`)) {
            onRestoreSnapshot(item.table_name, item.data_payload)
            onClose()
        }
    }

    const handleTakeSnapshot = async () => {
        const name = prompt('Δώστε όνομα για το νέο Snapshot (π.χ. "Απογραφή 2024 Final"):')
        if (!name) return
        setLoading(true)
        try {
            await createMasterSnapshot(name)
            await loadHistory()
            alert('Το Snapshot δημιουργήθηκε επιτυχώς!')
        } catch (e: any) {
            alert('Σφάλμα: ' + e.message)
        }
        setLoading(false)
    }

    const handleDelete = async (id: string, filename: string) => {
        if (!confirm(`Διαγραφή του snapshot "${filename}";\nΗ ενέργεια δεν αναιρείται.`)) return
        setLoading(true)
        const { error } = await supabase.from('ws_upload_history').delete().eq('id', id)
        if (error) alert('Σφάλμα διαγραφής: ' + error.message)
        else await loadHistory()
        setLoading(false)
    }

    const handleRename = async (id: string, currentName: string) => {
        const newName = prompt('Εισάγετε νέο όνομα (π.χ. "Απογραφή 2024"):', currentName)
        if (!newName || newName === currentName) return
        setLoading(true)
        const { error } = await supabase.from('ws_upload_history').update({ filename: newName }).eq('id', id)
        if (error) alert('Σφάλμα μετονομασίας: ' + error.message)
        else await loadHistory()
        setLoading(false)
    }

    const handleDownloadJSON = (item: HistoryWithPayload) => {
        if (!item.data_payload) return
        const str = JSON.stringify(item.data_payload, null, 2)
        const blob = new Blob([str], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `snapshot_${item.filename}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

    if (!open) return null

    return (
        <div style={{
            position: 'fixed',
            top: 0, right: 0, bottom: 0,
            width: '400px',
            background: '#0A0A0C',
            borderLeft: '1px solid #2A5C8A',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '-4px 0 20px rgba(0,0,0,0.8)',
            color: '#FAFAFA'
        }} className="animate-slide-up">
            <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid #1B2A3B',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#111115'
            }}>
                <h2 style={{ fontSize: '16px', margin: 0 }}>Ιστορικό Uploads (Snapshots)</h2>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button
                        onClick={handleTakeSnapshot}
                        disabled={loading}
                        style={{
                            background: '#10B981', color: '#FFF', border: 'none',
                            padding: '6px 12px', borderRadius: '4px', cursor: 'pointer',
                            fontSize: '13px', fontWeight: 'bold'
                        }}
                    >
                        📸 Νέο Snapshot
                    </button>
                    <button onClick={onClose} style={{
                        background: 'transparent', border: 'none', color: '#A8C8E8', fontSize: '20px', cursor: 'pointer'
                    }}>✕</button>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#7FA8C9' }}>Φόρτωση...</div>
                ) : history.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#7FA8C9' }}>Δεν βρέθηκε ιστορικό.</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {history.map(h => (
                            <div key={h.id} style={{
                                background: '#18181B',
                                border: '1px solid #2A5C8A',
                                borderRadius: '6px',
                                padding: '12px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <strong style={{ fontSize: '15px', color: '#60A5FA', display: 'block' }}>{h.filename}</strong>
                                        <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                                            {new Date(h.uploaded_at).toLocaleString('el-GR')}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        <button onClick={() => handleRename(h.id, h.filename)} style={{ cursor: 'pointer', background: 'transparent', border: '1px solid #4B5563', borderRadius: '4px', color: '#E5E7EB', padding: '2px 6px', fontSize: '11px' }}>✏️ Όνομα</button>
                                        <button onClick={() => handleDelete(h.id, h.filename)} style={{ cursor: 'pointer', background: 'transparent', border: '1px solid #ef4444', borderRadius: '4px', color: '#ef4444', padding: '2px 6px', fontSize: '11px' }}>🗑️</button>
                                    </div>
                                </div>
                                <div style={{ fontSize: '12px', color: '#D1D5DB' }}>
                                    Συνολικές Γραμμές: <strong>{h.row_count}</strong><br />
                                    Χρήστης: {h.uploaded_by}
                                </div>

                                <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                                    <button
                                        onClick={() => handleRestore(h)}
                                        disabled={!h.data_payload}
                                        style={{
                                            flex: 1,
                                            background: h.data_payload ? '#3B82F6' : '#374151',
                                            color: '#FFF',
                                            border: 'none',
                                            padding: '8px',
                                            borderRadius: '4px',
                                            cursor: h.data_payload ? 'pointer' : 'not-allowed',
                                            fontWeight: 600,
                                            fontSize: '13px'
                                        }}
                                    >
                                        {h.data_payload ? '👁 Προβολή / Επαναφορά' : 'Δεν υπάρχει JSON Backup'}
                                    </button>
                                    {h.data_payload && (
                                        <button
                                            onClick={() => handleDownloadJSON(h)}
                                            style={{
                                                background: '#10B981',
                                                color: '#FFF',
                                                border: 'none',
                                                padding: '8px 12px',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontWeight: 600,
                                                fontSize: '13px'
                                            }}
                                            title="Λήψη JSON Backup"
                                        >
                                            ⬇
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
