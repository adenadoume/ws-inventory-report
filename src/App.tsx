import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import type { TabView } from './types'
import { useInventory } from './hooks/useInventory'
import { useSales } from './hooks/useSales'
import { useBuys } from './hooks/useBuys'
import Login from './components/Login'
import StokApografi from './pages/StokApografi'
import StokFormula from './pages/StokFormula'
import Agores from './pages/Agores'
import Poliseis from './pages/Poliseis'
import './styles/globals.css'

function fmtEur(n: number) {
  return '€' + n.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [tab, setTab] = useState<TabView>('apografi')
  const [salesKey, setSalesKey] = useState(0)
  const [buysKey, setBuysKey] = useState(0)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  const { items: inventory, loading: invLoading } = useInventory()
  const { items: sales, loading: salesLoading } = useSales(salesKey)
  const { items: buys, loading: buysLoading } = useBuys(buysKey)

  if (session === undefined) return null // loading auth

  if (!session) return <Login />

  const tot24 = inventory.filter(i => i.cost_2024 != null).reduce((s, i) => s + (i.cost_2024 ?? 0), 0)
  const tot25 = inventory.filter(i => i.cost_2025 != null).reduce((s, i) => s + (i.cost_2025 ?? 0), 0)
  const diff = tot25 - tot24

  return (
    <div className="app-root">
      {/* HEADER */}
      <div id="header">
        <div>
          <h1>⚖ ΑΠΟΓΡΑΦΗ ΑΠΟΘΕΜΑΤΟΣ — 2024 vs 2025</h1>
          {!invLoading && (
            <div className="sub">
              Αξία 2024: {fmtEur(tot24)} | Αξία 2025: {fmtEur(tot25)} | Διαφορά: {(diff >= 0 ? '+' : '') + fmtEur(diff)}
            </div>
          )}
        </div>

        <div className="tab-btns">
          <button
            className={`tab-btn${tab === 'apografi' ? ' active' : ''}`}
            onClick={() => setTab('apografi')}
          >ΣΤΟΚ ΑΠΟΓΡΑΦΗ</button>
          <button
            className={`tab-btn t-formula${tab === 'formula' ? ' active' : ''}`}
            onClick={() => setTab('formula')}
          >ΣΤΟΚ − ΑΓΟΡΕΣ + ΠΩΛΗΣΕΙΣ</button>
          <button
            className={`tab-btn t-agores${tab === 'agores' ? ' active' : ''}`}
            onClick={() => setTab('agores')}
          >ΑΓΟΡΕΣ</button>
          <button
            className={`tab-btn t-poliseis${tab === 'poliseis' ? ' active' : ''}`}
            onClick={() => setTab('poliseis')}
          >ΠΩΛΗΣΕΙΣ</button>
          <button
            style={{ marginLeft: 16, background: 'none', border: 'none', color: '#7FA8C9', cursor: 'pointer', fontSize: 14 }}
            onClick={() => supabase.auth.signOut()}
            title="Αποσύνδεση"
          >⏻</button>
        </div>
      </div>

      {/* PAGE CONTENT */}
      {tab === 'apografi' && (
        <StokApografi items={inventory} loading={invLoading} />
      )}
      {tab === 'formula' && (
        <StokFormula
          items={inventory}
          sales={sales}
          buys={buys}
          loading={invLoading || salesLoading || buysLoading}
        />
      )}
      {tab === 'agores' && (
        <Agores
          items={buys}
          loading={buysLoading}
          onRefresh={() => setBuysKey(k => k + 1)}
        />
      )}
      {tab === 'poliseis' && (
        <Poliseis
          items={sales}
          loading={salesLoading}
          onRefresh={() => setSalesKey(k => k + 1)}
        />
      )}
    </div>
  )
}
