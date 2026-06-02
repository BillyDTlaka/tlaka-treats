import { useEffect, useState, useCallback } from 'react'
import { ordersApi } from '../../services/api'
import CustomerNavBar from '../../components/CustomerNavBar'
import { STATUS_COLORS } from '../../lib/theme'

export default function CustomerOrders() {
  const [orders, setOrders]     = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchOrders = useCallback(async () => {
    try { const data = await ordersApi.getMy(); setOrders(data) }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="screen" style={{ background: '#FDF6F0' }}>
      <div style={{ background: '#8B3A3A', padding: '52px 20px 18px', flexShrink: 0 }}>
        <p style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>My Orders</p>
        <p style={{ fontSize: 13, color: '#f5d0d0', marginTop: 2 }}>{orders.length} order{orders.length !== 1 ? 's' : ''}</p>
      </div>

      {loading ? (
        <div className="spinner-wrap"><div className="spinner" /></div>
      ) : (
        <div className="scroll-content" style={{ padding: 16 }}>
          {orders.length === 0 ? (
            <div className="empty-state">
              <span style={{ fontSize: 56, marginBottom: 16 }}>📦</span>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', marginBottom: 6 }}>No orders yet</p>
              <p style={{ fontSize: 14, color: '#999', textAlign: 'center' }}>When you place an order, it will appear here</p>
            </div>
          ) : orders.map(order => {
            const s = STATUS_COLORS[order.status] ?? { bg: '#eee', text: '#666', label: order.status }
            const itemCount = order.items?.reduce((n: number, i: any) => n + i.quantity, 0) ?? 0
            return (
              <div key={order.id} className="order-card">
                <div className="order-card-header">
                  <div>
                    <p className="order-id">Order #{order.id.slice(-8).toUpperCase()}</p>
                    <p className="order-date">{fmt(order.createdAt)}</p>
                  </div>
                  <span className="status-badge" style={{ background: s.bg, color: s.text }}>{s.label}</span>
                </div>
                {order.items?.slice(0, 3).map((item: any) => (
                  <div key={item.id} className="order-item-row">
                    <span style={{ color: '#ccc', marginRight: 6 }}>•</span>
                    <span className="order-item-name">{item.variant?.product?.name ?? 'Item'} × {item.quantity}</span>
                    <span className="order-item-subtotal">R{Number(item.subtotal ?? item.unitPrice * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                {order.items?.length > 3 && (
                  <p style={{ fontSize: 12, color: '#999', marginBottom: 4, marginLeft: 14 }}>+{order.items.length - 3} more item(s)</p>
                )}
                <div className="order-footer">
                  <span style={{ fontSize: 13, color: '#999' }}>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
                  <span className="order-total">R{Number(order.total).toFixed(2)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <CustomerNavBar />
    </div>
  )
}
