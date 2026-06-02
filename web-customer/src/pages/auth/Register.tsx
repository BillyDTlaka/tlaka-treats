import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const FIELDS = [
  { key: 'firstName', placeholder: 'First Name *', type: 'text' },
  { key: 'lastName',  placeholder: 'Last Name *',  type: 'text' },
  { key: 'email',     placeholder: 'Email *',       type: 'email' },
  { key: 'phone',     placeholder: 'Phone',         type: 'tel' },
  { key: 'password',  placeholder: 'Password *',    type: 'password' },
] as const

export default function Register() {
  const { register, applyAuth, user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm]         = useState({ email: '', password: '', firstName: '', lastName: '', phone: '' })
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(false)
  const [countdown, setCountdown] = useState(3)
  const pendingAuth = useRef<{ token: string; user: any } | null>(null)

  // Navigate once applyAuth has updated the user in context
  useEffect(() => {
    if (!user) return
    if (user.roles?.includes('AMBASSADOR')) navigate('/ambassador/dashboard', { replace: true })
    else navigate('/customer/home', { replace: true })
  }, [user])

  useEffect(() => {
    if (!success) return
    if (countdown <= 0) {
      if (pendingAuth.current) applyAuth(pendingAuth.current.token, pendingAuth.current.user)
      return
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [success, countdown])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email || !form.password || !form.firstName || !form.lastName) {
      setError('Please fill in all required fields'); return
    }
    setLoading(true); setError('')
    try {
      const result = await register({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || undefined,
      })
      pendingAuth.current = result
      setSuccess(true)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: '#8B3A3A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ background: '#fff', borderRadius: 28, padding: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
          <span style={{ fontSize: 64, marginBottom: 16 }}>🎉</span>
          <h2 style={{ fontSize: 26, fontWeight: 900, color: '#111827', marginBottom: 6 }}>Account Created!</h2>
          <p style={{ fontSize: 18, fontWeight: 700, color: '#8B3A3A', marginBottom: 12 }}>Welcome, {form.firstName}!</p>
          <p style={{ fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 1.6, marginBottom: 24 }}>
            Your Tlaka Treats account is ready.{'\n'}Taking you home in {countdown}…
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: 10, height: 10, borderRadius: 5, background: countdown <= i ? '#8B3A3A' : '#e8d5d5' }} />
            ))}
          </div>
          <button
            style={{ background: '#8B3A3A', color: '#fff', borderRadius: 14, padding: '14px 40px', fontSize: 16, fontWeight: 700, border: 'none', cursor: 'pointer' }}
            onClick={() => { if (pendingAuth.current) applyAuth(pendingAuth.current.token, pendingAuth.current.user) }}
          >
            Continue →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#8B3A3A', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: '60px 24px 24px', display: 'flex', flexDirection: 'column' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Create Account</h1>
        <p style={{ fontSize: 16, color: '#f5d0d0', marginBottom: 32 }}>Join the Tlaka Treats family 🍪</p>

        {error && (
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 14, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
          {FIELDS.map(field => (
            <input
              key={field.key}
              style={{ background: '#fff', borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 14, color: '#1a1a1a', border: 'none', outline: 'none', width: '100%' }}
              type={field.type}
              placeholder={field.placeholder}
              value={form[field.key]}
              onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
              autoCapitalize={field.key === 'email' || field.key === 'password' ? 'none' : 'words'}
            />
          ))}

          <button
            type="submit"
            disabled={loading}
            style={{ background: '#5C1A1A', color: '#fff', borderRadius: 12, padding: 16, fontSize: 16, fontWeight: 700, border: 'none', cursor: 'pointer', marginBottom: 20, marginTop: 8, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Creating…' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', color: '#f5d0d0', fontSize: 14 }}>
          Already have an account?{' '}
          <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, padding: 0 }}>
            Sign In
          </button>
        </div>
      </div>
    </div>
  )
}
