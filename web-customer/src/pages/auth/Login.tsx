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

  useEffect(() => {
    if (isLoading) return
    if (!user) return
    if (user.roles?.includes('AMBASSADOR')) navigate('/ambassador/dashboard', { replace: true })
    else navigate('/customer/home', { replace: true })
  }, [user, isLoading])

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await login(email.trim().toLowerCase(), password)
    } catch (err: any) {
      console.error('Login error:', err)
      const msg =
        err?.response?.data?.message ||
        (err?.response?.status ? `Server error (${err.response.status})` : null) ||
        err?.message ||
        'Could not reach server. Check your connection.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: '#fff' }}>
      <div style={{ padding: 28, display: 'flex', flexDirection: 'column', maxWidth: 480, width: '100%', margin: '0 auto' }}>
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 40 }}>
          <img src="/logo.png" alt="Tlaka Treats" style={{ width: 100, height: 100, borderRadius: 24, marginBottom: 16, objectFit: 'cover', boxShadow: '0 4px 16px rgba(139,58,58,0.25)' }} />
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#111827', margin: 0 }}>Tlaka Treats</h1>
          <p style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 6 }}>Fresh treats delivered to your door</p>
        </div>

        {/* Email */}
        <label style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
          Email
        </label>
        <input
          style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 14, padding: '14px 16px', fontSize: 15, color: '#111827', background: '#F9FAFB', marginBottom: 16, boxSizing: 'border-box', outline: 'none' }}
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
        />

        {/* Password */}
        <label style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
          Password
        </label>
        <input
          style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 14, padding: '14px 16px', fontSize: 15, color: '#111827', background: '#F9FAFB', marginBottom: 16, boxSizing: 'border-box', outline: 'none' }}
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
        />

        {/* Error */}
        {error && (
          <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 16px', color: '#DC2626', fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
            {error}
          </div>
        )}

        {/* Button */}
        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%', background: loading ? '#a05050' : '#8B3A3A',
            color: '#fff', borderRadius: 14, padding: 16,
            fontSize: 16, fontWeight: 800, border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
        >
          {loading && (
            <span style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
          )}
          {loading ? 'Signing in…' : 'Sign In'}
        </button>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: '#6B7280' }}>
          New here?{' '}
          <button
            onClick={() => navigate('/register')}
            style={{ background: 'none', border: 'none', color: '#8B3A3A', fontWeight: 700, cursor: 'pointer', fontSize: 14, padding: 0 }}
          >
            Create an account
          </button>
        </p>
      </div>
    </div>
  )
}
