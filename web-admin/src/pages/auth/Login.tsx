import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'

export default function AdminLogin() {
  const { login } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) { setError('Please enter your email and password.'); return }
    setLoading(true); setError('')
    try {
      await login(email.trim().toLowerCase(), password)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Invalid credentials')
    } finally { setLoading(false) }
  }

  return (
    <div className="auth-screen">
      <div className="auth-scroll">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 40 }}>
          <div className="auth-logo" style={{ width: 80, height: 80, borderRadius: 24, background: '#8B3A3A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, marginBottom: 16 }}>🍪</div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#111827', marginBottom: 4 }}>Tlaka Treats</h1>
          <p style={{ fontSize: 13, color: '#6B7280' }}>Admin & Staff Portal</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {error && <div style={{ background: '#FEE2E2', borderRadius: 10, padding: '10px 14px', color: '#DC2626', fontSize: 14 }}>{error}</div>}
          <label style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>Email</label>
          <input className="auth-form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@tlakatreats.co.za" autoComplete="email" />
          <label style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>Password</label>
          <input className="auth-form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
          <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 16 }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
