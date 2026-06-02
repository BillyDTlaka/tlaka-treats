import { useEffect, useState, useCallback } from 'react'
import { ordersApi } from '../../services/api'
import AmbassadorNavBar from '../../components/AmbassadorNavBar'

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  PENDING:   { bg: '#FFF3CD', text: '#856404', label: 'Pending' },
  CONFIRMED: { bg: '#D1ECF1', text: '#0C5460', label: 'Confirmed' },
  BAKING:    { bg: '#FFE0B2', text: '#E65100', label: '🔥 Baking' },
  READY:     { bg: '#D4EDDA', text: '#155724', label: '✅ Ready' },
  DELIVERED: { bg: '#E2D9F3', text: '#432874', label: '🚚 Delivered' },
  CANCELLED: { bg: '#F8D7DA', text: '#721C24', label: 'Cancelled' },
}

type FilterType = 'ALL' | 'PENDING' | 'CONFIRMED' | 'DELIVERED'
const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'ALL', label: 'All' }, { key: 'PENDING', label: 'Pending' },
  { key: 'CONFIRMED', label: 'Confirmed' }, { key: 'DELIVERED', label: 'Delivered' },
]

export default function AmbassadorOrders() {
  const [orders, setOrders]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState<FilterType>('ALL')

  const fetchOrders = useCallback(async () => {
    try { setOrders(await ordersApi.getAmbassador()) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const filtered = filter === 'ALL' ? orders : orders.filter(o => o.status === filter)
  const totalComm = orders.reduce((s, o) => s + (o.commission?.amount ? Number(o.commission.amount) : 0), 0)
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })

  return (
    <div className="screen" style={{ background: '#FDF6F0' }}>
      <div style={{ background: '#8B3A3A', padding: '52px 20px 18px', flexShrink: 0 }}>
        <p style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>Attributed Orders</p>
        <p style={{ fontSize: 13, color: '#f5d0d0', marginTop: 2 }}>{orders.length} order{orders.length !== 1 ? 's' : ''} · R{totalComm.toFixed(2)} earned</p>
      </div>

      <div className="filter-row" style={{ flexShrink: 0 }}>
        {FILTERS.map(f => (
          <button key={f.key} className={`chip${filter === f.key ? ' active' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
      </div>

      {loading ? (
        <div className="spinner-wrap"><div className="spinner" /></div>
      ) : (
        <div style={{ padding: 16 }}>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <span style={{ fontSize: 56, marginBottom: 16 }}>📦</span>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', marginBottom: 6 }}>No orders yet</p>
              <p style={{ fontSize: 14, color: '#999', textAlign: 'center' }}>Share your referral code to start earning</p>
            </div>
          ) : filtered.map(order => {
            const s = STATUS_COLORS[order.status] ?? { bg: '#eee', text: '#666', label: order.status }
            const hasComm = !!order.commission
            return (
              <div key={order.id} style={{ background: '#fff', borderRadius: 16, marginBottom: 14, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottom: '1px solid #f5eded' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="customer-initial">{order.customer?.firstName?.[0]?.toUpperCase() ?? '?'}</div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>{order.customer?.firstName} {order.customer?.lastName}</p>
                      <p style={{ fontSize: 12, color: '#999', marginTop: 1 }}>{fmt(order.createdAt)}</p>
                    </div>
                  </div>
                  <span className="status-badge" style={{ background: s.bg, color: s.text }}>{s.label}</span>
                </div>
                <div style={{ display: 'flex', padding: 16, justifyContent: 'space-around' }}>
                  {[
                    { label: 'Order Total', value: `R${Number(order.total).toFixed(2)}`, color: '#1a1a1a' },
                  ].map(stat => (
                    <div key={stat.label} style={{ flex: 1, textAlign: 'center' }}>
                      <p style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>{stat.label}</p>
                      <p style={{ fontSize: 16, fontWeight: 700, color: stat.color }}>{stat.value}</p>
                    </div>
                  ))}
                  <div style={{ width: 1, background: '#f5eded' }} />
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <p style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>Commission</p>
                    {hasComm ? (
                      <>
                        <p style={{ fontSize: 16, fontWeight: 700, color: '#2E7D32' }}>+R{Number(order.commission.amount).toFixed(2)}</p>
                        <span style={{ fontSize: 10, fontWeight: 700, background: order.commission.status === 'PAID' ? '#D4EDDA' : '#FFF3CD', color: order.commission.status === 'PAID' ? '#155724' : '#856404', borderRadius: 10, padding: '2px 8px' }}>
                          {order.commission.status === 'PAID' ? 'Paid' : 'Pending'}
                        </span>
                      </>
                    ) : <p style={{ fontSize: 16, color: '#ccc' }}>—</p>}
                  </div>
                  <div style={{ width: 1, background: '#f5eded' }} />
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <p style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>Items</p>
                    <p style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>{order.items?.length ?? 0}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AmbassadorNavBar />
    </div>
  )
}
