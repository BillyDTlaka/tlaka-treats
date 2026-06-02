import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Login() {
  const { login, user, isLoading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  // Redirect as soon as we have a user (covers both "already logged in" and "just logged in")
  useEffect(() => {
    if (isLoading) return
    if (!user) return
    if (user.roles?.includes('AMBASSADOR')) navigate('/ambassador/dashboard', { replace: true })
    else navigate('/customer/home', { replace: true })
  }, [user, isLoading])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) { setError('Please enter your email and password.'); return }
    setLoading(true); setError('')
    try {
      await login(email.trim().toLowerCase(), password)
      // navigation handled by the useEffect above
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen" style={{ background: '#fff' }}>
      <div className="auth-scroll">
        <div className="auth-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 40 }}>
          <div className="auth-logo">🍪</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#111827', marginBottom: 6 }}>Tlaka Treats</h1>
          <p style={{ fontSize: 14, color: '#6B7280', textAlign: 'center' }}>Fresh treats delivered to your door</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {error && (
            <div style={{ background: '#FEE2E2', borderRadius: 10, padding: '10px 14px', color: '#DC2626', fontSize: 14, marginBottom: 4 }}>
              {error}
            </div>
          )}
          <label style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, marginTop: 8 }}>Email</label>
          <input
            className="form-input"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
          <label style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, marginTop: 8 }}>Password</label>
          <input
            className="form-input"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
          <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 24 }}>
            {loading ? <span className="spinner" style={{ width: 20, height: 20, margin: 'auto' }} /> : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 14, color: '#6B7280' }}>
          New here?{' '}
          <button onClick={() => navigate('/register')} style={{ background: 'none', border: 'none', color: '#8B3A3A', fontWeight: 700, cursor: 'pointer', fontSize: 14, padding: 0 }}>
            Create an account
          </button>
        </div>
      </div>
    </div>
  )
}
