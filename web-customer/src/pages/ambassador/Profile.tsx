import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth.store'
import { useAuth } from '../../context/AuthContext'
import { ambassadorsApi } from '../../services/api'
import AmbassadorNavBar from '../../components/AmbassadorNavBar'

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  PENDING:   { bg: '#FFF3CD', text: '#856404', label: '⏳ Pending Review' },
  ACTIVE:    { bg: '#D4EDDA', text: '#155724', label: '✅ Active' },
  SUSPENDED: { bg: '#F8D7DA', text: '#721C24', label: '⛔ Suspended' },
}

export default function AmbassadorProfile() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { logout } = useAuth()
  const [ambassador, setAmbassador] = useState<any>(null)
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    ambassadorsApi.me().then(setAmbassador).finally(() => setLoading(false))
  }, [])

  const shareCode = () => {
    if (!ambassador?.code) return
    const text = `Order fresh treats from Tlaka Treats using my referral code: ${ambassador.code} 🍪`
    if (navigator.share) navigator.share({ text }).catch(() => {})
    else navigator.clipboard.writeText(ambassador.code).then(() => alert('Code copied!'))
  }

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) logout()
  }

  const statusInfo = ambassador ? (STATUS_CONFIG[ambassador.status] ?? { bg: '#eee', text: '#666', label: ambassador.status }) : null

  return (
    <div className="screen" style={{ background: '#FDF6F0' }}>
      <div style={{ background: '#8B3A3A', padding: '52px 20px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <p style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>Profile</p>
        <button onClick={() => navigate('/ambassador/settings')} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', padding: 4 }}>⚙️</button>
      </div>

      {loading ? (
        <div className="spinner-wrap"><div className="spinner" /></div>
      ) : (
        <div style={{ padding: 16, paddingBottom: 100 }}>
          <div className="avatar-section">
            <div className="avatar">{user?.firstName?.[0]?.toUpperCase() ?? '?'}</div>
            <p style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a', marginBottom: 4 }}>{user?.firstName} {user?.lastName}</p>
            <p style={{ fontSize: 14, color: '#999', marginBottom: 10 }}>{user?.email}</p>
            {statusInfo && (
              <span style={{ borderRadius: 20, padding: '6px 14px', background: statusInfo.bg, fontSize: 13, fontWeight: 700, color: statusInfo.text }}>
                {statusInfo.label}
              </span>
            )}
          </div>

          {/* Code card */}
          {ambassador?.code && (
            <div className="code-card">
              <p style={{ color: '#f5d0d0', fontSize: 13, marginBottom: 8 }}>Your Referral Code</p>
              <p style={{ color: '#fff', fontSize: 32, fontWeight: 900, letterSpacing: 3, marginBottom: 8 }}>{ambassador.code}</p>
              <p style={{ color: '#f5d0d0', fontSize: 12, textAlign: 'center', lineHeight: 1.5, marginBottom: 16 }}>
                Share this with customers — you earn commission on every order placed with your code
              </p>
              <button onClick={shareCode} style={{ background: '#fff', borderRadius: 12, padding: '12px 24px', border: 'none', color: '#8B3A3A', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                📤  Share My Code
              </button>
            </div>
          )}

          {/* Commission Info */}
          {ambassador && (
            <div style={{ background: '#fff', borderRadius: 16, padding: 18, marginBottom: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginBottom: 14 }}>Commission Details</p>
              <div className="info-row">
                <span className="info-label">Commission Rate</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#8B3A3A' }}>{(Number(ambassador.commissionRate) * 100).toFixed(0)}%</span>
              </div>
              <div className="info-row" style={{ borderBottom: 'none' }}>
                <span className="info-label">Account Status</span>
                <span style={{ borderRadius: 12, padding: '3px 10px', background: statusInfo?.bg, fontSize: 12, fontWeight: 700, color: statusInfo?.text }}>{ambassador.status}</span>
              </div>
            </div>
          )}

          {/* Account details */}
          <div style={{ background: '#fff', borderRadius: 16, padding: 18, marginBottom: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginBottom: 14 }}>Account Details</p>
            <div className="info-row"><span className="info-label">First Name</span><span className="info-value">{user?.firstName}</span></div>
            <div className="info-row"><span className="info-label">Last Name</span><span className="info-value">{user?.lastName}</span></div>
            <div className="info-row" style={{ borderBottom: 'none' }}><span className="info-label">Email</span><span className="info-value">{user?.email}</span></div>
          </div>

          {ambassador?.status === 'SUSPENDED' && (
            <div style={{ background: '#FFF0E6', borderRadius: 14, padding: 16, display: 'flex', gap: 12, marginBottom: 16, border: '1px solid #f5d0d0' }}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <p style={{ flex: 1, fontSize: 13, color: '#8B3A3A', lineHeight: 1.5 }}>Your ambassador account has been suspended. Please contact support for more information.</p>
            </div>
          )}

          <button onClick={() => navigate('/ambassador/settings')} style={{ width: '100%', background: '#fff', borderRadius: 14, padding: 16, display: 'flex', alignItems: 'center', marginBottom: 12, border: '1px solid #f0e8e8', cursor: 'pointer' }}>
            <span style={{ fontSize: 20, marginRight: 12 }}>⚙️</span>
            <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: '#1a1a1a' }}>Settings</span>
            <span style={{ fontSize: 22, color: '#ccc' }}>›</span>
          </button>

          <button onClick={handleLogout} style={{ width: '100%', background: '#fff', borderRadius: 14, padding: 16, border: '1px solid #f5d0d0', color: '#8B3A3A', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginBottom: 16 }}>
            Log Out
          </button>
        </div>
      )}

      <AmbassadorNavBar />
    </div>
  )
}
