import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ambassadorsApi } from '../../services/api'

interface Ambassador {
  id: string; status: string; kycStatus: string; kycNote: string | null;
  kycData: any; commissionRate: number; code: string; createdAt: string;
}

const STATUS_CONFIG: Record<string, { emoji: string; label: string; color: string; bg: string; message: string }> = {
  PENDING: {
    emoji: '⏳', label: 'Under Review', color: '#856404', bg: '#FFF3CD',
    message: 'Your application has been received and is being reviewed by our team. We\'ll notify you once a decision has been made.',
  },
  ACTIVE: {
    emoji: '✅', label: 'Active', color: '#155724', bg: '#D4EDDA',
    message: 'Congratulations! Your ambassador account is active. You can now access your ambassador dashboard and start earning commissions.',
  },
  SUSPENDED: {
    emoji: '⚠️', label: 'Suspended', color: '#721C24', bg: '#F8D7DA',
    message: 'Your ambassador account has been suspended. Please contact us for more information.',
  },
}

const KYC_STEPS = [
  { key: 'applied',  label: 'Application submitted',  doneWhen: () => true },
  { key: 'kyc',      label: 'Documents under review',  doneWhen: (a: Ambassador) => ['SUBMITTED', 'APPROVED'].includes(a.kycStatus) },
  { key: 'approved', label: 'Application approved',    doneWhen: (a: Ambassador) => a.kycStatus === 'APPROVED' || a.status === 'ACTIVE' },
  { key: 'active',   label: 'Account activated',       doneWhen: (a: Ambassador) => a.status === 'ACTIVE' },
]

export default function AmbassadorStatus() {
  const navigate = useNavigate()
  const [ambassador, setAmbassador] = useState<Ambassador | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try { setAmbassador(await ambassadorsApi.myApplication()) }
    catch { setAmbassador(null) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="spinner-wrap" style={{ minHeight: '100vh' }}><div className="spinner" /></div>

  if (!ambassador) {
    return (
      <div style={{ minHeight: '100vh', background: '#FDF6F0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <span style={{ fontSize: 48, marginBottom: 16 }}>🌟</span>
        <p style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a', marginBottom: 8 }}>No application found</p>
        <p style={{ fontSize: 14, color: '#999', textAlign: 'center', marginBottom: 24 }}>You haven't applied to become an ambassador yet.</p>
        <button onClick={() => navigate('/customer/ambassador-apply', { replace: true })} className="btn-primary" style={{ width: 'auto', padding: '14px 28px' }}>Apply Now</button>
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[ambassador.status] ?? STATUS_CONFIG.PENDING
  const banking = ambassador.kycData?.banking

  return (
    <div className="screen" style={{ background: '#FDF6F0' }}>
      <div style={{ background: '#8B3A3A', display: 'flex', alignItems: 'center', padding: '52px 16px 16px', flexShrink: 0 }}>
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <p style={{ flex: 1, fontSize: 17, fontWeight: 800, color: '#fff', textAlign: 'center' }}>Application Status</p>
        <div style={{ width: 40 }} />
      </div>

      <div style={{ padding: 20 }}>
        {/* Status card */}
        <div className="status-card" style={{ background: statusCfg.bg }}>
          <span style={{ fontSize: 40, marginBottom: 8 }}>{statusCfg.emoji}</span>
          <p style={{ fontSize: 20, fontWeight: 800, color: statusCfg.color, marginBottom: 8 }}>{statusCfg.label}</p>
          <p style={{ fontSize: 13, color: statusCfg.color, textAlign: 'center', lineHeight: 1.6 }}>{statusCfg.message}</p>
          {ambassador.status === 'ACTIVE' && (
            <button onClick={() => navigate('/ambassador/dashboard', { replace: true })} style={{ marginTop: 16, background: '#155724', color: '#fff', borderRadius: 12, padding: '12px 20px', border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              Go to Ambassador Dashboard →
            </button>
          )}
        </div>

        {ambassador.kycStatus === 'REJECTED' && ambassador.kycNote && (
          <div style={{ background: '#F8D7DA', borderRadius: 16, padding: 18, marginBottom: 16 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#721C24', marginBottom: 8 }}>❌ Application not approved</p>
            <p style={{ fontSize: 13, color: '#721C24', lineHeight: 1.6, marginBottom: 14 }}>{ambassador.kycNote}</p>
            <button onClick={() => navigate('/customer/ambassador-apply')} style={{ background: '#721C24', color: '#fff', borderRadius: 10, padding: 12, width: '100%', border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Update & Resubmit</button>
          </div>
        )}

        {/* Progress steps */}
        <p style={{ fontSize: 15, fontWeight: 800, color: '#1a1a1a', marginBottom: 12, marginTop: 8 }}>Application Progress</p>
        <div className="steps-card">
          {KYC_STEPS.map((step, idx) => {
            const done = step.doneWhen(ambassador)
            return (
              <div key={step.key}>
                <div className="step-row">
                  <div className={`step-dot${done ? ' done' : ''}`}>{done ? '✓' : idx + 1}</div>
                  <p style={{ fontSize: 14, color: done ? '#1a1a1a' : '#999', fontWeight: done ? 700 : 500 }}>{step.label}</p>
                </div>
                {idx < KYC_STEPS.length - 1 && <div className={`step-line${done ? ' done' : ''}`} />}
              </div>
            )
          })}
        </div>

        {/* Details */}
        <p style={{ fontSize: 15, fontWeight: 800, color: '#1a1a1a', marginBottom: 12 }}>Your Details</p>
        <div className="details-card">
          {[
            ['Submitted', new Date(ambassador.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })],
            ambassador.kycData?.phone ? ['Phone', ambassador.kycData.phone] : null,
            ambassador.kycData?.idType ? ['ID Type', ambassador.kycData.idType] : null,
            ambassador.kycData?.idNumber ? ['ID Number', `••••••${ambassador.kycData.idNumber.slice(-4)}`] : null,
            ambassador.status === 'ACTIVE' ? ['Referral Code', ambassador.code] : null,
            ambassador.status === 'ACTIVE' ? ['Commission Rate', `${(ambassador.commissionRate * 100).toFixed(0)}%`] : null,
          ].filter(Boolean).map(([label, value]: any) => (
            <div key={label} className="info-row">
              <span style={{ fontSize: 13, color: '#999' }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: label === 'Referral Code' || label === 'Commission Rate' ? '#8B3A3A' : '#1a1a1a' }}>{value}</span>
            </div>
          ))}
        </div>

        {banking && (
          <>
            <p style={{ fontSize: 15, fontWeight: 800, color: '#1a1a1a', marginBottom: 12 }}>Banking Details</p>
            <div className="details-card">
              {[['Bank', banking.bankName], ['Account Holder', banking.accountName], ['Account Number', `••••••${banking.accountNumber?.slice(-4)}`], ['Branch Code', banking.branchCode], ['Account Type', banking.accountType]].map(([label, value]) => (
                <div key={label} className="info-row">
                  <span style={{ fontSize: 13, color: '#999' }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>{value}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <p style={{ fontSize: 12, color: '#ccc', textAlign: 'center', marginTop: 8 }}>Pull down to refresh status</p>
      </div>
    </div>
  )
}
