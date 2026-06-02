import { useState, useCallback, useEffect } from 'react'
import { api } from '../../services/api'
import { BRAND, COLORS } from '../../lib/theme'
import AdminNavBar from '../../components/AdminNavBar'

type Tab = 'pending' | 'active' | 'all'
const STATUS_COLOR: Record<string, string> = {
  PENDING: COLORS.warning, ACTIVE: COLORS.success, SUSPENDED: COLORS.danger,
}
const KYC_COLOR: Record<string, string> = {
  NOT_STARTED: COLORS.gray400, SUBMITTED: '#2563EB', APPROVED: COLORS.success, REJECTED: COLORS.danger,
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="detail-row">
      <p className="detail-label">{label}</p>
      <p className="detail-value" style={{ color: highlight ? COLORS.danger : COLORS.gray900 }}>{value}</p>
    </div>
  )
}

export default function AmbassadorsPage() {
  const [tab, setTab]           = useState<Tab>('pending')
  const [ambassadors, setAmbassadors] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<any | null>(null)
  const [rejectNote, setRejectNote]   = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const load = useCallback(async () => {
    try { setAmbassadors(await api.ambassadors.list()) }
    catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = ambassadors.filter(a => {
    if (tab === 'pending') return a.status === 'PENDING'
    if (tab === 'active')  return a.status === 'ACTIVE'
    return true
  })

  const handleApprove = async (ambassador: any) => {
    const name = `${ambassador.user?.firstName || ''} ${ambassador.user?.lastName || ''}`.trim()
    if (!window.confirm(`Approve ${name} and grant them ACTIVE status?`)) return
    setActionLoading(true)
    try {
      await api.ambassadors.reviewKyc(ambassador.id, 'APPROVED', undefined)
      await api.ambassadors.updateStatus(ambassador.id, 'ACTIVE')
      await load(); setSelected(null)
      alert(`${name} is now an active ambassador.`)
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to approve ambassador')
    } finally { setActionLoading(false) }
  }

  const handleReject = async (ambassador: any) => {
    if (!rejectNote.trim()) { alert('Please enter a reason for rejection.'); return }
    const name = `${ambassador.user?.firstName || ''} ${ambassador.user?.lastName || ''}`.trim()
    if (!window.confirm(`Reject ${name}'s application with this note?`)) return
    setActionLoading(true)
    try {
      await api.ambassadors.reviewKyc(ambassador.id, 'REJECTED', rejectNote.trim())
      await load(); setSelected(null); setRejectNote('')
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to reject application')
    } finally { setActionLoading(false) }
  }

  const handleSuspend = async (ambassador: any) => {
    const name = `${ambassador.user?.firstName || ''} ${ambassador.user?.lastName || ''}`.trim()
    if (!window.confirm(`Suspend ${name}'s ambassador account?`)) return
    setActionLoading(true)
    try {
      await api.ambassadors.updateStatus(ambassador.id, 'SUSPENDED')
      await load(); setSelected(null)
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to suspend')
    } finally { setActionLoading(false) }
  }

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (selected) {
    const amb = selected
    const name = `${amb.user?.firstName || ''} ${amb.user?.lastName || ''}`.trim() || 'Unknown'
    const kyc = amb.kycData || {}
    const banking = kyc.banking || {}
    const docUrl = kyc.idDocumentUrl || ''
    const isImage = docUrl.match(/\.(jpg|jpeg|png|webp)$/i)

    return (
      <div className="screen" style={{ background: COLORS.gray50 }}>
        <div style={{ paddingTop: 52, display: 'flex', alignItems: 'center', gap: 4, paddingInline: 16, paddingBottom: 12, background: '#fff', borderBottom: `1px solid ${COLORS.gray100}`, flexShrink: 0 }}>
          <button onClick={() => { setSelected(null); setRejectNote('') }} style={{ fontSize: 22, color: COLORS.gray900, background: 'none', border: 'none', cursor: 'pointer', padding: 8, marginRight: 4 }}>←</button>
          <p style={{ fontSize: 18, fontWeight: 900, color: COLORS.gray900 }}>{name}</p>
        </div>

        <div className="scroll-content" style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <span className="badge" style={{ background: (STATUS_COLOR[amb.status] || COLORS.gray400) + '20', color: STATUS_COLOR[amb.status] || COLORS.gray400 }}>{amb.status}</span>
            <span className="badge" style={{ background: (KYC_COLOR[amb.kycStatus] || COLORS.gray400) + '20', color: KYC_COLOR[amb.kycStatus] || COLORS.gray400 }}>KYC: {(amb.kycStatus || 'NOT_STARTED').replace('_', ' ')}</span>
          </div>

          <p style={{ fontSize: 14, fontWeight: 800, color: COLORS.gray700, marginTop: 20, marginBottom: 8 }}>Personal Details</p>
          <div className="card card-padding">
            <DetailRow label="Email"    value={amb.user?.email || '—'} />
            <DetailRow label="Phone"    value={amb.user?.phone || kyc.phone || '—'} />
            <DetailRow label="Address"  value={kyc.address || '—'} />
            <DetailRow label="Applied"  value={new Date(amb.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })} />
            <DetailRow label="Code"     value={amb.code || '—'} />
            <DetailRow label="Commission" value={`${((amb.commissionRate || 0.10) * 100).toFixed(0)}%`} />
          </div>

          <p style={{ fontSize: 14, fontWeight: 800, color: COLORS.gray700, marginTop: 20, marginBottom: 8 }}>Identity</p>
          <div className="card card-padding">
            <DetailRow label="ID Type"   value={kyc.idType || '—'} />
            <DetailRow label="ID Number" value={kyc.idNumber ? `••••••${kyc.idNumber.slice(-4)}` : '—'} />
            {amb.kycNote && <DetailRow label="Note" value={amb.kycNote} highlight />}
          </div>

          {docUrl && (
            <>
              <p style={{ fontSize: 14, fontWeight: 800, color: COLORS.gray700, marginTop: 20, marginBottom: 8 }}>ID Document</p>
              <div className="card card-padding">
                {isImage ? (
                  <a href={docUrl} target="_blank" rel="noopener noreferrer">
                    <img src={docUrl} style={{ width: '100%', height: 220, borderRadius: 10, objectFit: 'contain' }} alt="ID document" />
                    <p style={{ fontSize: 12, color: COLORS.gray400, textAlign: 'center', marginTop: 6 }}>Tap to open full size</p>
                  </a>
                ) : (
                  <a href={docUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: COLORS.gray50, borderRadius: 10 }}>
                    <span style={{ fontSize: 28 }}>📄</span>
                    <p style={{ fontSize: 14, fontWeight: 700, color: BRAND }}>Open PDF Document</p>
                  </a>
                )}
              </div>
            </>
          )}

          {banking.bankName && (
            <>
              <p style={{ fontSize: 14, fontWeight: 800, color: COLORS.gray700, marginTop: 20, marginBottom: 8 }}>Banking Details</p>
              <div className="card card-padding">
                <DetailRow label="Bank"           value={banking.bankName} />
                <DetailRow label="Account Holder" value={banking.accountName} />
                <DetailRow label="Account Number" value={banking.accountNumber ? `••••••${banking.accountNumber.slice(-4)}` : '—'} />
                <DetailRow label="Branch Code"    value={banking.branchCode || '—'} />
                <DetailRow label="Account Type"   value={banking.accountType || '—'} />
              </div>
            </>
          )}

          {amb.bio && (
            <>
              <p style={{ fontSize: 14, fontWeight: 800, color: COLORS.gray700, marginTop: 20, marginBottom: 8 }}>Why They Want to Be an Ambassador</p>
              <div className="card card-padding">
                <p style={{ fontSize: 14, color: COLORS.gray700, lineHeight: 1.6, fontStyle: 'italic' }}>"{amb.bio}"</p>
              </div>
            </>
          )}

          <p style={{ fontSize: 14, fontWeight: 800, color: COLORS.gray700, marginTop: 20, marginBottom: 8 }}>Actions</p>
          {amb.status === 'PENDING' && (
            <textarea
              className="form-input"
              style={{ width: '100%', minHeight: 80, marginBottom: 12, resize: 'none' }}
              placeholder="Rejection reason (required to reject)…"
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
            />
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            {amb.status === 'PENDING' && (
              <>
                <button onClick={() => handleApprove(amb)} disabled={actionLoading} style={{ flex: 1, background: COLORS.success, color: '#fff', borderRadius: 14, padding: 16, border: 'none', fontWeight: 800, fontSize: 15, cursor: 'pointer', opacity: actionLoading ? 0.5 : 1 }}>✓ Approve</button>
                <button onClick={() => handleReject(amb)} disabled={actionLoading} style={{ flex: 1, background: '#fff', borderRadius: 14, padding: 16, border: `1.5px solid ${COLORS.danger}`, fontWeight: 800, fontSize: 15, color: COLORS.danger, cursor: 'pointer', opacity: actionLoading ? 0.5 : 1 }}>✕ Reject</button>
              </>
            )}
            {amb.status === 'ACTIVE' && (
              <button onClick={() => handleSuspend(amb)} disabled={actionLoading} style={{ flex: 1, background: '#fff', borderRadius: 14, padding: 16, border: `1.5px solid ${COLORS.warning}`, fontWeight: 800, fontSize: 15, color: COLORS.warning, cursor: 'pointer', opacity: actionLoading ? 0.5 : 1 }}>⚠ Suspend</button>
            )}
            {amb.status === 'SUSPENDED' && (
              <button onClick={() => handleApprove(amb)} disabled={actionLoading} style={{ flex: 1, background: COLORS.success, color: '#fff', borderRadius: 14, padding: 16, border: 'none', fontWeight: 800, fontSize: 15, cursor: 'pointer', opacity: actionLoading ? 0.5 : 1 }}>Reactivate</button>
            )}
          </div>
          <div style={{ height: 40 }} />
        </div>
        <AdminNavBar />
      </div>
    )
  }

  // ── List view ──────────────────────────────────────────────────────────────
  const pendingCount = ambassadors.filter(a => a.status === 'PENDING').length

  return (
    <div className="screen" style={{ background: COLORS.gray50 }}>
      <div style={{ paddingTop: 52, paddingInline: 16, paddingBottom: 12, background: '#fff', borderBottom: `1px solid ${COLORS.gray100}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <p style={{ fontSize: 22, fontWeight: 900, color: COLORS.gray900, flex: 1 }}>Ambassadors</p>
          {pendingCount > 0 && <span style={{ background: COLORS.warning, borderRadius: 10, padding: '3px 8px', color: '#fff', fontSize: 12, fontWeight: 800 }}>{pendingCount} pending</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['pending', 'active', 'all'] as const).map(id => (
            <button key={id} className={`tab-btn${tab === id ? ' active' : ''}`} onClick={() => setTab(id)} style={{ flex: 1 }}>
              {id.charAt(0).toUpperCase() + id.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="spinner-wrap"><div className="spinner" /></div>
      ) : (
        <div className="scroll-content" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.length === 0 && <p style={{ textAlign: 'center', color: COLORS.gray400, marginTop: 60, fontSize: 15 }}>No ambassadors in this category</p>}
          {filtered.map(amb => {
            const name = `${amb.user?.firstName || ''} ${amb.user?.lastName || ''}`.trim() || 'Unknown'
            const totalEarned = (amb.commissions || []).reduce((s: number, c: any) => s + Number(c.amount), 0)
            const sc = STATUS_COLOR[amb.status] || COLORS.gray400
            return (
              <button key={amb.id} onClick={() => { setSelected(amb); setRejectNote('') }} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: '#fff', borderRadius: 16, border: `1px solid ${COLORS.gray100}`, padding: 16, cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ width: 42, height: 42, borderRadius: 21, background: sc, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: '#fff', flexShrink: 0 }}>
                  {name[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: COLORS.gray900 }}>{name}</p>
                  <p style={{ fontSize: 12, color: COLORS.gray500, marginTop: 2 }}>{amb.user?.email || '—'}</p>
                  <p style={{ fontSize: 12, color: COLORS.gray500, marginTop: 2 }}>Code: {amb.code}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="badge" style={{ background: sc + '20', color: sc }}>{amb.status}</span>
                  <p style={{ fontSize: 11, color: COLORS.gray500, marginTop: 4 }}>KYC: {(amb.kycStatus || 'NOT_STARTED').replace('_', ' ')}</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: COLORS.gray700, marginTop: 4 }}>R{totalEarned.toFixed(2)}</p>
                </div>
              </button>
            )
          })}
          <div style={{ height: 24 }} />
        </div>
      )}

      <AdminNavBar />
    </div>
  )
}
