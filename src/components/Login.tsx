import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) setError(err.message)
    setLoading(false)
  }

  return (
    <div className="login-wrap">
      <form className="login-box animate-slide-up" onSubmit={handleLogin}>
        <h2>⚖ ΑΠΟΓΡΑΦΗ</h2>
        <div className="sub">Σύνδεση στο σύστημα απογραφής</div>
        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="email@example.com"
          autoFocus
        />
        <label>Κωδικός</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
        />
        {error && <div className="login-err">{error}</div>}
        <button className="login-btn" type="submit" disabled={loading}>
          {loading ? 'Σύνδεση…' : 'Είσοδος'}
        </button>
      </form>
    </div>
  )
}
