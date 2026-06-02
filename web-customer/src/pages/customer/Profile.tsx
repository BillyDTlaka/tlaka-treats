import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/auth.store'
import { useAuth } from '../../context/AuthContext'
import { ambassadorsApi } from '../../services/api'
import CustomerNavBar from '../../components/CustomerNavBar'

export default function CustomerProfile() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { logout } = useAuth()
  const [showApplyForm, setShowApplyForm] = useState(false)
  const [bio, setBio]       = useState('')
  const [applying, setApplying] = useState(false)

  const handleApply = async () => {
    setApplying(true)
    try {
      await ambassadorsApi.apply({ bio: bio.trim() || undefined })
      setShowApplyForm(false)
      alert('Application Submitted! 🎉\n\nWe\'ve received your ambassador application. We\'ll review it and get back to you soon.')
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Something went wrong')
    } finally { setApplying(false) }
  }

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) logout()
  }

  return (
    <div className="screen" style={{ background: '#FDF6F0' }}>
      <div style={{ background: '#8B3A3A', padding: '52px 20px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <p style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>Profile</p>
        <button onClick={() => navigate('/customer/settings')} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', padding: 4 }}>⚙️</button>
      </div>

      <div className="scroll-content" style={{ padding: 16 }}>
        {/* Avatar */}
        <div className="avatar-section">
          <div className="avatar">{user?.firstName?.[0]?.toUpperCase() ?? '?'}</div>
          <p style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a', marginBottom: 4 }}>{user?.firstName} {user?.lastName}</p>
          <p style={{ fontSize: 14, color: '#999' }}>{user?.email}</p>
        </div>

        {/* Account Info */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 18, marginBottom: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginBottom: 14 }}>Account Details</p>
          <div className="info-row"><span className="info-label">First Name</span><span className="info-value">{user?.firstName}</span></div>
          <div className="info-row"><span className="info-label">Last Name</span><span className="info-value">{user?.lastName}</span></div>
          <div className="info-row"><span className="info-label">Email</span><span className="info-value">{user?.email}</span></div>
          <div className="info-row" style={{ borderBottom: 'none' }}>
            <span className="info-label">Account Type</span>
            <span style={{ background: '#FFF0E6', borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 700, color: '#8B3A3A' }}>Customer</span>
          </div>
        </div>

        {/* Become Ambassador */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 18, marginBottom: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginBottom: 14 }}>Earn with Tlaka Treats</p>
          <p style={{ fontSize: 14, color: '#666', lineHeight: 1.5, marginBottom: 16 }}>
            Become an ambassador and earn commission every time someone orders using your unique referral code. 🍪
          </p>
          {!showApplyForm ? (
            <button className="btn-primary" onClick={() => navigate('/customer/ambassador-apply')}>
              Apply to Become an Ambassador
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 14, color: '#555', fontWeight: 600 }}>Tell us about yourself (optional)</p>
              <textarea
                className="form-textarea"
                style={{ minHeight: 100 }}
                placeholder="Why do you want to be an ambassador?"
                value={bio}
                onChange={e => setBio(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowApplyForm(false)} style={{ flex: 1, borderRadius: 12, padding: 13, border: '1px solid #e8d5d5', background: '#fff', color: '#999', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>Cancel</button>
                <button onClick={handleApply} disabled={applying} style={{ flex: 2, background: '#8B3A3A', borderRadius: 12, padding: 13, color: '#fff', fontWeight: 700, cursor: 'pointer', border: 'none', fontSize: 14, opacity: applying ? 0.6 : 1 }}>
                  {applying ? 'Submitting…' : 'Submit Application'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Settings row */}
        <button onClick={() => navigate('/customer/settings')} style={{ width: '100%', background: '#fff', borderRadius: 14, padding: 16, display: 'flex', alignItems: 'center', marginBottom: 12, border: '1px solid #f0e8e8', cursor: 'pointer', textAlign: 'left' }}>
          <span style={{ fontSize: 20, marginRight: 12 }}>⚙️</span>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: '#1a1a1a' }}>Settings</span>
          <span style={{ fontSize: 22, color: '#ccc' }}>›</span>
        </button>

        {/* Logout */}
        <button onClick={handleLogout} style={{ width: '100%', background: '#fff', borderRadius: 14, padding: 16, border: '1px solid #f5d0d0', color: '#8B3A3A', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginBottom: 16 }}>
          Log Out
        </button>
      </div>

      <CustomerNavBar />
    </div>
  )
}
