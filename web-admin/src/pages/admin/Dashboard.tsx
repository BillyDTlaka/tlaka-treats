import { useNavigate } from 'react-router-dom'
import { useDashboard } from '../../lib/hooks'
import { useAuth } from '../../context/AuthContext'
import { BRAND, COLORS, STATUS_COLORS } from '../../lib/theme'
import AdminNavBar from '../../components/AdminNavBar'

function fmt(n: number) {
  return `R${n.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function KpiCard({ label, value, icon, color, sub }: { label: string; value: string; icon: string; color?: string; sub?: string }) {
  return (
    <div className="kpi-card">
      <span className="kpi-icon">{icon}</span>
      <p className="kpi-value" style={{ color: color || BRAND }}>{value}</p>
      <p className="kpi-label">{label}</p>
      {sub && <p className="kpi-sub">{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.roles?.includes('ADMIN')
  const perms: string[] = user?.permissions ?? []

  const { data, isLoading, refetch, isRefetching } = useDashboard()

  if (!isAdmin) {
    const canOrders    = perms.some(p => p.includes(':order'))
    const canInventory = perms.some(p => p.includes(':inventory'))
    const canPeople    = perms.some(p => p.includes(':employee'))
    if (canOrders)    return <div className="screen" onLoad={() => navigate('/admin/orders')} />
    if (canInventory) return <div className="screen" onLoad={() => navigate('/admin/stock')} />
    if (canPeople)    return <div className="screen" onLoad={() => navigate('/admin/people')} />
  }

  if (isLoading) return <div className="spinner-wrap" style={{ minHeight: '100vh' }}><div className="spinner" /></div>

  const today  = data?.today  || {}
  const month  = data?.month  || {}
  const alerts = data?.alerts || {}
  const recentOrders  = data?.recentOrders || []
  const lowStockItems = data?.lowStockItems || []

  return (
    <div className="screen" style={{ background: COLORS.gray50 }}>
      <div style={{ padding: 16, paddingBottom: 100 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingTop: 40 }}>
          <div>
            <p style={{ fontSize: 13, color: COLORS.gray500 }}>Good day 👋</p>
            <p style={{ fontSize: 20, fontWeight: 900, color: COLORS.gray900 }}>{user?.firstName} {user?.lastName}</p>
          </div>
          <button onClick={logout} style={{ padding: '6px 12px', borderRadius: 10, border: `1px solid ${COLORS.gray200}`, fontSize: 12, color: COLORS.gray500, fontWeight: 600, cursor: 'pointer', background: '#fff' }}>Sign out</button>
        </div>

        {/* Today KPIs */}
        <p className="section-title">Today</p>
        <div className="kpi-row">
          <KpiCard label="Revenue" value={fmt(today.revenue || 0)} icon="💰" color={COLORS.success} />
          <KpiCard label="Pending Orders" value={String(alerts.pendingOrders || 0)} icon="📦" color={BRAND} />
          <KpiCard label="Production" value={String(today.production || 0)} icon="🏭" color={COLORS.purple} />
        </div>

        {/* Month KPIs */}
        <p className="section-title">This Month</p>
        <div className="kpi-row">
          <KpiCard label="Revenue" value={fmt(month.revenue || 0)} icon="📈" color={COLORS.success} sub={`${month.orderCount || 0} orders`} />
          <KpiCard label="Low Stock" value={String(alerts.lowStock || 0)} icon="⚠️" color={alerts.lowStock > 0 ? COLORS.warning : COLORS.success} />
          <KpiCard label="Leave Requests" value={String(alerts.pendingLeave || 0)} icon="🌴" color={alerts.pendingLeave > 0 ? COLORS.warning : COLORS.gray400} />
        </div>

        {/* Alerts */}
        {(alerts.lowStock > 0 || alerts.pendingLeave > 0 || alerts.pendingOrders > 0) && (
          <div style={{ background: '#FFF7ED', borderRadius: 16, padding: 14, border: '1px solid #FED7AA', marginTop: 4 }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: COLORS.warning, marginBottom: 8 }}>⚡ Needs Attention</p>
            {alerts.pendingOrders > 0 && (
              <button onClick={() => navigate('/admin/orders')} style={{ display: 'block', background: 'none', border: 'none', fontSize: 13, color: COLORS.gray700, marginBottom: 4, cursor: 'pointer', padding: 0 }}>
                • {alerts.pendingOrders} pending order(s) waiting confirmation →
              </button>
            )}
            {alerts.lowStock > 0 && (
              <button onClick={() => navigate('/admin/stock')} style={{ display: 'block', background: 'none', border: 'none', fontSize: 13, color: COLORS.gray700, marginBottom: 4, cursor: 'pointer', padding: 0 }}>
                • {alerts.lowStock} ingredient(s) running low →
              </button>
            )}
            {alerts.pendingLeave > 0 && (
              <button onClick={() => navigate('/admin/people')} style={{ display: 'block', background: 'none', border: 'none', fontSize: 13, color: COLORS.gray700, marginBottom: 4, cursor: 'pointer', padding: 0 }}>
                • {alerts.pendingLeave} leave request(s) to review →
              </button>
            )}
          </div>
        )}

        {/* Recent Orders */}
        {recentOrders.length > 0 && (
          <>
            <div className="section-row">
              <p className="section-title" style={{ margin: 0 }}>Recent Orders</p>
              <button onClick={() => navigate('/admin/orders')} style={{ fontSize: 12, color: BRAND, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer' }}>See all →</button>
            </div>
            <div className="card">
              {recentOrders.map((o: any, i: number) => {
                const name = `${o.customer?.firstName || ''} ${o.customer?.lastName || ''}`.trim() || 'Unknown'
                const sc   = STATUS_COLORS[o.status] || '#6B7280'
                return (
                  <button key={o.id} onClick={() => navigate('/admin/orders')}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, width: '100%', background: 'none', border: 'none', borderBottom: i < recentOrders.length - 1 ? `1px solid ${COLORS.gray100}` : 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: COLORS.gray900 }}>{name}</p>
                      <p style={{ fontSize: 12, color: COLORS.gray400, marginTop: 2 }}>{o.items?.[0]?.variant?.product?.name || '—'}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 14, fontWeight: 800, color: COLORS.gray900 }}>R{Number(o.total || 0).toFixed(0)}</p>
                      <span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: 20, background: sc + '20', fontSize: 11, fontWeight: 700, color: sc }}>{o.status}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}

        {/* Low Stock */}
        {lowStockItems.length > 0 && (
          <>
            <p className="section-title" style={{ marginTop: 20 }}>Low Stock Alert</p>
            <div className="card">
              {lowStockItems.map((item: any, i: number) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottom: i < lowStockItems.length - 1 ? `1px solid ${COLORS.gray100}` : 'none' }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: COLORS.gray900 }}>{item.name}</p>
                  <p style={{ fontSize: 14, fontWeight: 800, color: item.currentStock <= 2 ? COLORS.danger : COLORS.warning }}>
                    {Number(item.currentStock).toFixed(1)} {item.uom?.abbreviation || ''}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Management */}
        <p className="section-title" style={{ marginTop: 20 }}>Management</p>
        <div className="card">
          <button onClick={() => navigate('/admin/ambassadors')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, width: '100%', background: 'none', border: 'none', cursor: 'pointer' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: COLORS.gray900 }}>🌟 Ambassador Applications</p>
            <p style={{ fontSize: 12, color: BRAND, fontWeight: 700 }}>Review →</p>
          </button>
        </div>

        <div style={{ height: 24 }} />
      </div>

      <AdminNavBar />
    </div>
  )
}
