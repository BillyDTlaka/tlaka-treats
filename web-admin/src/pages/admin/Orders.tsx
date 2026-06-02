import { useState } from 'react'
import { useOrders, useUpdateOrderStatus } from '../../lib/hooks'
import { BRAND, COLORS, STATUS_COLORS } from '../../lib/theme'
import AdminNavBar from '../../components/AdminNavBar'

const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'BAKING', 'READY', 'DELIVERED', 'CANCELLED']
const NEXT_STATUS: Record<string, string> = {
  PENDING: 'CONFIRMED', CONFIRMED: 'BAKING', BAKING: 'READY', READY: 'DELIVERED',
}

export default function OrdersPage() {
  const [filterStatus, setFilterStatus] = useState('')
  const [expandedId, setExpandedId]     = useState<string | null>(null)
  const { data: orders = [], isLoading, refetch, isRefetching } = useOrders(filterStatus ? { status: filterStatus } : {})
  const updateStatus = useUpdateOrderStatus()

  const handleAdvance = (order: any) => {
    const next = NEXT_STATUS[order.status]
    if (!next) return
    if (window.confirm(`Mark as ${next}? Order for ${order.customer?.firstName || 'customer'}`)) {
      updateStatus.mutate({ id: order.id, status: next })
    }
  }

  const handleCancel = (order: any) => {
    if (window.confirm('Cancel this order? This cannot be undone.')) {
      updateStatus.mutate({ id: order.id, status: 'CANCELLED' })
    }
  }

  return (
    <div className="screen" style={{ background: COLORS.gray50 }}>
      <div style={{ paddingTop: 52, paddingInline: 16, paddingBottom: 12, background: '#fff', borderBottom: `1px solid ${COLORS.gray100}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <p style={{ fontSize: 22, fontWeight: 900, color: COLORS.gray900 }}>Orders</p>
          <p style={{ fontSize: 13, color: COLORS.gray400, fontWeight: 600 }}>{orders.length} order(s)</p>
        </div>
        <div className="pills-scroll">
          {['', ...ORDER_STATUSES].map(s => (
            <button key={s} className={`pill${filterStatus === s ? ' active' : ''}`} onClick={() => setFilterStatus(s)}>
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="spinner-wrap"><div className="spinner" /></div>
      ) : (
        <div className="scroll-content">
          {orders.length === 0 && <p style={{ textAlign: 'center', color: COLORS.gray400, marginTop: 60, fontSize: 15 }}>No orders found</p>}
          {orders.map((order: any) => {
            const name = `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() || 'Unknown'
            const sc   = STATUS_COLORS[order.status] || '#6B7280'
            const expanded = expandedId === order.id
            const nextStatus = NEXT_STATUS[order.status]

            return (
              <div key={order.id} className="order-card" style={{ marginBottom: 10 }}>
                <div className="order-header" onClick={() => setExpandedId(expanded ? null : order.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                    <div className="stock-dot" style={{ background: sc }} />
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: COLORS.gray900 }}>{name}</p>
                      <p style={{ fontSize: 11, color: COLORS.gray400, marginTop: 2 }}>{new Date(order.createdAt).toLocaleDateString('en-ZA')}</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 15, fontWeight: 900, color: COLORS.gray900 }}>R{Number(order.total || 0).toFixed(2)}</p>
                    <span className="badge" style={{ background: sc + '20', color: sc }}>{order.status}</span>
                  </div>
                </div>

                {expanded && (
                  <div className="order-body">
                    {(order.items || []).map((item: any, i: number) => (
                      <div key={i} className="order-item-row">
                        <p style={{ flex: 1, fontSize: 13, color: COLORS.gray700 }}>{item.variant?.product?.name || 'Item'}</p>
                        <p style={{ fontSize: 13, color: COLORS.gray500, width: 32, textAlign: 'center' }}>×{item.quantity}</p>
                        <p style={{ fontSize: 13, fontWeight: 700, color: COLORS.gray900, width: 64, textAlign: 'right' }}>R{Number(item.subtotal || 0).toFixed(2)}</p>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${COLORS.gray100}`, paddingTop: 10, marginTop: 6 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: COLORS.gray500 }}>Total</p>
                      <p style={{ fontSize: 15, fontWeight: 900, color: COLORS.gray900 }}>R{Number(order.total || 0).toFixed(2)}</p>
                    </div>
                    {order.notes && <p style={{ fontSize: 12, color: COLORS.gray500, marginTop: 10, fontStyle: 'italic' }}>📝 {order.notes}</p>}
                    <div className="actions-row">
                      {nextStatus && (
                        <button className="btn-advance" onClick={() => handleAdvance(order)}>→ Mark {nextStatus}</button>
                      )}
                      {!['DELIVERED', 'CANCELLED', 'COMPLETED'].includes(order.status) && (
                        <button className="btn-cancel" onClick={() => handleCancel(order)}>Cancel</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          <div style={{ height: 24 }} />
        </div>
      )}

      <AdminNavBar />
    </div>
  )
}
