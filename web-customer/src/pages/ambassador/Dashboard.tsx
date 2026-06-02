import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ambassadorsApi, ordersApi } from '../../services/api'
import { useAuthStore } from '../../store/auth.store'
import AmbassadorNavBar from '../../components/AmbassadorNavBar'

type Preset = '30d' | '3m' | '6m' | '1y' | 'all' | 'custom'
const PRESETS: { key: Preset; label: string }[] = [
  { key: '30d', label: '30 Days' }, { key: '3m', label: '3 Months' },
  { key: '6m', label: '6 Months' }, { key: '1y', label: '1 Year' },
  { key: 'all', label: 'All Time' }, { key: 'custom', label: 'Custom' },
]

function getPresetRange(preset: Preset) {
  if (preset === 'all' || preset === 'custom') return null
  const to = new Date(); const from = new Date()
  if (preset === '30d') from.setDate(from.getDate() - 30)
  else if (preset === '3m') from.setMonth(from.getMonth() - 3)
  else if (preset === '6m') from.setMonth(from.getMonth() - 6)
  else if (preset === '1y') from.setFullYear(from.getFullYear() - 1)
  return { from, to }
}

function parseDate(str: string): Date | null {
  const parts = str.includes('/') ? str.split('/') : str.split('-')
  if (parts.length !== 3) return null
  let day: number, month: number, year: number
  if (str.includes('/')) { [day, month, year] = parts.map(Number) }
  else { [year, month, day] = parts.map(Number) }
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null
  const d = new Date(year, month - 1, day)
  return isNaN(d.getTime()) ? null : d
}

export default function AmbassadorDashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [ambassador, setAmbassador] = useState<any>(null)
  const [orders, setOrders]         = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [preset, setPreset]         = useState<Preset>('3m')
  const [showCustomModal, setShowCustomModal] = useState(false)
  const [customFromStr, setCustomFromStr] = useState('')
  const [customToStr, setCustomToStr]   = useState('')
  const [customFrom, setCustomFrom]     = useState<Date | undefined>()
  const [customTo, setCustomTo]         = useState<Date | undefined>()

  const fetchData = useCallback(async () => {
    try {
      const [amb, ords] = await Promise.all([ambassadorsApi.me(), ordersApi.getAmbassador()])
      setAmbassador(amb); setOrders(ords)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const shareCode = () => {
    if (!ambassador?.code) return
    const text = `Order from Tlaka Treats using my code: ${ambassador.code}\nFresh biscuits and scones delivered to your door! 🍪`
    if (navigator.share) {
      navigator.share({ text }).catch(() => {})
    } else {
      navigator.clipboard.writeText(ambassador.code).then(() => alert('Code copied to clipboard!'))
    }
  }

  const applyCustomRange = () => {
    const from = parseDate(customFromStr); const to = parseDate(customToStr)
    if (!from) { alert('Enter the start date as DD/MM/YYYY'); return }
    if (!to) { alert('Enter the end date as DD/MM/YYYY'); return }
    if (from > to) { alert('Start date must be before end date'); return }
    to.setHours(23, 59, 59, 999)
    setCustomFrom(from); setCustomTo(to)
    setPreset('custom'); setShowCustomModal(false)
  }

  const filteredOrders = useMemo(() => {
    let from: Date | undefined; let to: Date | undefined
    if (preset === 'custom') { from = customFrom; to = customTo }
    else { const r = getPresetRange(preset); if (r) { from = r.from; to = r.to } }
    if (!from && !to) return orders
    return orders.filter(o => {
      const d = new Date(o.createdAt)
      if (from && d < from) return false
      if (to && d > to) return false
      return true
    })
  }, [orders, preset, customFrom, customTo])

  const totalEarnings = filteredOrders.reduce((s, o) => s + (o.commission?.amount ? Number(o.commission.amount) : 0), 0)
  const pendingComm = filteredOrders.filter(o => o.commission?.status === 'PENDING').length
  const paidComm    = filteredOrders.filter(o => o.commission?.status === 'PAID').length
  const recentOrders = filteredOrders.slice(0, 5)

  if (loading) return <div className="spinner-wrap" style={{ minHeight: '100vh' }}><div className="spinner" /></div>

  return (
    <div className="screen" style={{ background: '#FDF6F0' }}>
      <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 80 }}>
        {/* Header */}
        <div style={{ background: '#8B3A3A', padding: '52px 20px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>Hey, {user?.firstName} 👋</p>
            <p style={{ fontSize: 13, color: '#f5d0d0', marginTop: 2 }}>Ambassador Dashboard</p>
          </div>
          {ambassador?.status && (
            <span style={{ borderRadius: 20, padding: '6px 12px', background: ambassador.status === 'ACTIVE' ? '#D4EDDA' : '#FFF3CD', fontSize: 12, fontWeight: 700, color: ambassador.status === 'ACTIVE' ? '#155724' : '#856404' }}>
              {ambassador.status === 'ACTIVE' ? '✅ Active' : '⏳ Pending'}
            </span>
          )}
        </div>

        {/* Period Selector */}
        <div className="period-bar">
          <div className="period-scroll">
            {PRESETS.map(p => (
              <button key={p.key} className={`chip${preset === p.key ? ' active' : ''}`}
                onClick={() => p.key === 'custom' ? setShowCustomModal(true) : setPreset(p.key)}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Period summary */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px', background: '#fff' }}>
          <span style={{ fontSize: 12, color: '#999' }}>{filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}</span>
          <span style={{ fontSize: 12, color: '#8B3A3A', fontWeight: 600 }}>{preset === 'all' ? 'All time' : preset === 'custom' ? 'Custom range' : preset}</span>
        </div>

        {/* Stats */}
        <div className="stats-row">
          {[
            { value: filteredOrders.length.toString(), label: 'Orders', color: '#1a1a1a' },
            { value: `R${totalEarnings.toFixed(2)}`, label: 'Earned', color: '#8B3A3A' },
            { value: pendingComm.toString(), label: 'Pending', color: '#856404' },
            { value: paidComm.toString(), label: 'Paid Out', color: '#155724' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <p className="stat-value" style={{ color: s.color, fontSize: s.label === 'Earned' ? 13 : 17 }}>{s.value}</p>
              <p className="stat-label">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Code card */}
        {ambassador?.code && (
          <div style={{ padding: '16px 16px 0' }}>
            <div className="code-card">
              <p style={{ color: '#f5d0d0', fontSize: 13, marginBottom: 6 }}>Your Referral Code</p>
              <p style={{ color: '#fff', fontSize: 30, fontWeight: 900, letterSpacing: 3, marginBottom: 6 }}>{ambassador.code}</p>
              <p style={{ color: '#f5d0d0', fontSize: 12, textAlign: 'center', marginBottom: 16 }}>
                Earn {(Number(ambassador.commissionRate) * 100).toFixed(0)}% commission on every order
              </p>
              <button onClick={shareCode} style={{ background: '#fff', borderRadius: 12, padding: '10px 20px', border: 'none', color: '#8B3A3A', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                📤  Share My Code
              </button>
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div style={{ display: 'flex', gap: 12, margin: '16px 16px 0' }}>
          {[
            { icon: '📦', label: 'View All Orders', path: '/ambassador/orders' },
            { icon: '💸', label: 'Earnings & Payouts', path: '/ambassador/earnings' },
            { icon: '👤', label: 'My Profile', path: '/ambassador/profile' },
          ].map(a => (
            <button key={a.path} onClick={() => navigate(a.path)} style={{ flex: 1, background: '#fff', borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: 'none', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: 28 }}>{a.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', textAlign: 'center' }}>{a.label}</span>
            </button>
          ))}
        </div>

        {/* Recent Orders */}
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>Orders in Period</p>
            {filteredOrders.length > 5 && (
              <button onClick={() => navigate('/ambassador/orders')} style={{ background: 'none', border: 'none', fontSize: 14, color: '#8B3A3A', fontWeight: 600, cursor: 'pointer' }}>See All</button>
            )}
          </div>

          {recentOrders.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0' }}>
              <span style={{ fontSize: 40, marginBottom: 12 }}>📭</span>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>No orders in this period</p>
              <p style={{ fontSize: 13, color: '#999' }}>Try a wider date range or share your code</p>
            </div>
          ) : recentOrders.map(order => (
            <div key={order.id} className="amb-order-card">
              <div className="amb-order-row">
                <div className="customer-initial">{order.customer?.firstName?.[0]?.toUpperCase() ?? '?'}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, color: '#1a1a1a', fontSize: 14 }}>{order.customer?.firstName} {order.customer?.lastName}</p>
                  <p style={{ fontSize: 11, color: '#aaa', marginTop: 1 }}>{new Date(order.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  <p style={{ fontSize: 12, color: '#999', marginTop: 1 }}>{order.status}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontWeight: 700, color: '#1a1a1a', fontSize: 15 }}>R{Number(order.total).toFixed(2)}</p>
                  {order.commission && <p style={{ fontSize: 12, color: '#2E7D32', fontWeight: 700, marginTop: 2 }}>+R{Number(order.commission.amount).toFixed(2)}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AmbassadorNavBar />

      {/* Custom Date Modal */}
      {showCustomModal && (
        <div className="modal-overlay" onClick={() => setShowCustomModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#1a1a1a', marginBottom: 4 }}>Custom Date Range</p>
            <p style={{ fontSize: 13, color: '#999', marginBottom: 20 }}>Enter dates as DD/MM/YYYY</p>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#555', marginBottom: 6, display: 'block' }}>From</label>
            <input style={{ width: '100%', background: '#FDF6F0', borderRadius: 12, border: '1px solid #e8d5d5', padding: 14, fontSize: 16, color: '#1a1a1a', marginBottom: 16, outline: 'none' }} placeholder="01/01/2025" value={customFromStr} onChange={e => setCustomFromStr(e.target.value)} />
            <label style={{ fontSize: 13, fontWeight: 700, color: '#555', marginBottom: 6, display: 'block' }}>To</label>
            <input style={{ width: '100%', background: '#FDF6F0', borderRadius: 12, border: '1px solid #e8d5d5', padding: 14, fontSize: 16, color: '#1a1a1a', marginBottom: 20, outline: 'none' }} placeholder="31/03/2025" value={customToStr} onChange={e => setCustomToStr(e.target.value)} />
            <button onClick={applyCustomRange} className="btn-primary" style={{ marginBottom: 10 }}>Apply Range</button>
            <button onClick={() => setShowCustomModal(false)} style={{ width: '100%', padding: '8px 0', background: 'none', border: 'none', fontSize: 15, color: '#999', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
