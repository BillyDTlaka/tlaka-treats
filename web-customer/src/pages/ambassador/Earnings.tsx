import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ambassadorsApi } from '../../services/api'
import AmbassadorNavBar from '../../components/AmbassadorNavBar'

const COMMISSION_STATUS: Record<string, { bg: string; text: string; label: string }> = {
  PENDING: { bg: '#FFF3CD', text: '#856404', label: 'Pending' },
  PAID:    { bg: '#D4EDDA', text: '#155724', label: 'Paid' },
}
const PAYOUT_STATUS: Record<string, { bg: string; text: string; label: string }> = {
  PENDING:  { bg: '#FFF3CD', text: '#856404', label: '⏳ Requested' },
  APPROVED: { bg: '#D1ECF1', text: '#0C5460', label: '✅ Approved' },
  PAID:     { bg: '#D4EDDA', text: '#155724', label: '💸 Paid' },
  REJECTED: { bg: '#F8D7DA', text: '#721C24', label: '✗ Rejected' },
}
const PAYMENT_METHODS = [
  { key: 'bank_transfer', label: '🏦 Bank Transfer' },
  { key: 'cash',          label: '💵 Cash' },
  { key: 'mobile_money',  label: '📱 Mobile Money' },
]

export default function EarningsPage() {
  const navigate = useNavigate()
  const [data, setData]         = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState<'commissions' | 'payouts'>('commissions')
  const [showModal, setShowModal] = useState(false)
  const [method, setMethod]     = useState('bank_transfer')
  const [notes, setNotes]       = useState('')
  const [requesting, setRequesting] = useState(false)

  const fetchData = useCallback(async () => {
    try { setData(await ambassadorsApi.earnings()) }
    catch (err: any) { alert(err?.response?.data?.message || 'Could not load earnings') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleRequestPayout = async () => {
    setRequesting(true)
    try {
      const res = await ambassadorsApi.requestPayout(method, notes.trim() || undefined)
      setShowModal(false); setNotes(''); await fetchData()
      alert(`Payout Requested! 🎉\n\nR${Number(res.total).toFixed(2)} across ${res.commissionCount} commission(s) has been submitted for payment.`)
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Something went wrong')
    } finally { setRequesting(false) }
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })

  if (loading) return <div className="spinner-wrap" style={{ minHeight: '100vh' }}><div className="spinner" /></div>

  const { summary, commissions = [], payouts = [], commissionRate } = data ?? {}
  const hasPending    = summary?.totalPending > 0
  const canRequest    = hasPending && summary?.totalPending >= 50

  return (
    <div className="screen" style={{ background: '#FDF6F0' }}>
      <div style={{ background: '#8B3A3A', display: 'flex', alignItems: 'center', padding: '52px 16px 16px', flexShrink: 0 }}>
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <p style={{ flex: 1, fontSize: 20, fontWeight: 800, color: '#fff', textAlign: 'center' }}>Earnings</p>
        <div style={{ width: 40 }} />
      </div>

      <div style={{ padding: 16 }}>
        {/* Summary Grid */}
        <div className="summary-grid">
          <div style={{ background: '#8B3A3A', borderRadius: 16, padding: 20, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
            <p style={{ fontSize: 13, color: '#f5d0d0', marginBottom: 4 }}>Available to Withdraw</p>
            <p style={{ fontSize: 32, fontWeight: 900, color: '#fff', marginBottom: 4 }}>R{Number(summary?.totalPending ?? 0).toFixed(2)}</p>
            <p style={{ fontSize: 12, color: '#f5d0d0' }}>{summary?.pendingCount ?? 0} pending commission(s)</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { label: 'Total Earned', value: `R${Number(summary?.totalEarned ?? 0).toFixed(2)}`, color: '#1a1a1a' },
              { label: 'Total Paid Out', value: `R${Number(summary?.totalPaid ?? 0).toFixed(2)}`, color: '#059669' },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <p style={{ fontSize: 12, color: '#999', marginBottom: 6 }}>{s.label}</p>
                <p style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>
          <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <p style={{ fontSize: 12, color: '#999', marginBottom: 6 }}>Commission Rate</p>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#8B3A3A' }}>{(Number(commissionRate ?? 0) * 100).toFixed(0)}%</p>
          </div>
        </div>

        {/* Payout button */}
        {hasPending && (
          <div style={{ marginBottom: 16 }}>
            {canRequest ? (
              <button onClick={() => setShowModal(true)} style={{ width: '100%', background: '#059669', color: '#fff', borderRadius: 14, padding: 16, border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
                Request Payout · R{Number(summary.totalPending).toFixed(2)}
              </button>
            ) : (
              <div style={{ background: '#FFF3CD', borderRadius: 12, padding: 14, border: '1px solid #fde68a' }}>
                <p style={{ fontSize: 13, color: '#856404', lineHeight: 1.5 }}>
                  💡 Minimum payout is R50.00. You have R{Number(summary.totalPending).toFixed(2)} pending.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="tab-row">
          <button className={`tab-btn${tab === 'commissions' ? ' active' : ''}`} onClick={() => setTab('commissions')}>Commissions ({commissions.length})</button>
          <button className={`tab-btn${tab === 'payouts' ? ' active' : ''}`} onClick={() => setTab('payouts')}>Payouts ({payouts.length})</button>
        </div>

        {/* Commissions */}
        {tab === 'commissions' && (commissions.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0' }}>
            <span style={{ fontSize: 44, marginBottom: 12 }}>📭</span>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>No commissions yet</p>
            <p style={{ fontSize: 13, color: '#999', textAlign: 'center' }}>Share your referral code to start earning</p>
          </div>
        ) : commissions.map((c: any) => {
          const s = COMMISSION_STATUS[c.status] ?? { bg: '#eee', text: '#666', label: c.status }
          return (
            <div key={c.id} style={{ background: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ fontSize: 18, fontWeight: 800, color: '#059669' }}>+R{Number(c.amount).toFixed(2)}</p>
                  <p style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{fmt(c.createdAt)}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="status-badge" style={{ background: s.bg, color: s.text }}>{s.label}</span>
                  <p style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>Order #{c.order?.id?.slice(-6).toUpperCase() ?? '—'}</p>
                </div>
              </div>
              {c.payout && <p style={{ fontSize: 11, color: '#8B3A3A', marginTop: 8, fontWeight: 600 }}>Included in payout · {fmt(c.payout.createdAt)}</p>}
            </div>
          )
        }))}

        {/* Payouts */}
        {tab === 'payouts' && (payouts.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0' }}>
            <span style={{ fontSize: 44, marginBottom: 12 }}>💸</span>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>No payouts yet</p>
            <p style={{ fontSize: 13, color: '#999', textAlign: 'center' }}>Request your first payout once you have R50+ pending</p>
          </div>
        ) : payouts.map((p: any) => {
          const s = PAYOUT_STATUS[p.status] ?? { bg: '#eee', text: '#666', label: p.status }
          return (
            <div key={p.id} style={{ background: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <p style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a' }}>R{Number(p.amount).toFixed(2)}</p>
                  <p style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{fmt(p.createdAt)}</p>
                </div>
                <span className="status-badge" style={{ background: s.bg, color: s.text }}>{s.label}</span>
              </div>
              <p style={{ fontSize: 13, color: '#555', fontWeight: 600 }}>{PAYMENT_METHODS.find(m => m.key === p.method)?.label ?? p.method}</p>
              {p.reference && <p style={{ fontSize: 12, color: '#8B3A3A', fontWeight: 600 }}>Ref: {p.reference}</p>}
              {p.notes && <p style={{ fontSize: 12, color: '#999', marginTop: 8, fontStyle: 'italic' }}>{p.notes}</p>}
            </div>
          )
        }))}
      </div>

      <AmbassadorNavBar />

      {/* Payout Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => !requesting && setShowModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a', textAlign: 'center', marginBottom: 4 }}>Request Payout</p>
            <p style={{ fontSize: 14, color: '#8B3A3A', fontWeight: 600, textAlign: 'center', marginBottom: 20 }}>
              R{Number(summary?.totalPending ?? 0).toFixed(2)} across {summary?.pendingCount} commission(s)
            </p>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Payment Method</p>
            <div className="method-list">
              {PAYMENT_METHODS.map(m => (
                <button key={m.key} className={`method-item${method === m.key ? ' active' : ''}`} onClick={() => setMethod(m.key)}>{m.label}</button>
              ))}
            </div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Notes (optional)</p>
            <textarea
              style={{ width: '100%', background: '#FDF6F0', borderRadius: 12, border: '1px solid #e8d5d5', padding: 14, fontSize: 14, color: '#1a1a1a', minHeight: 80, resize: 'none', fontFamily: 'inherit', marginBottom: 20, outline: 'none' }}
              placeholder="e.g. FNB account ending 1234..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
            <button onClick={handleRequestPayout} disabled={requesting} style={{ width: '100%', background: '#059669', color: '#fff', borderRadius: 14, padding: 16, border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer', marginBottom: 10, opacity: requesting ? 0.6 : 1 }}>
              {requesting ? 'Submitting…' : 'Submit Request'}
            </button>
            <button onClick={() => setShowModal(false)} style={{ width: '100%', padding: 12, background: 'none', border: 'none', fontSize: 15, color: '#999', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
