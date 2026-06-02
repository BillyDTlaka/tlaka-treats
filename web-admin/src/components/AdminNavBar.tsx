import { useNavigate, useLocation } from 'react-router-dom'

const TABS = [
  { label: 'Dashboard', icon: '📊', path: '/admin/dashboard' },
  { label: 'Orders',    icon: '📦', path: '/admin/orders'    },
  { label: 'Products',  icon: '🛒', path: '/admin/products'  },
  { label: 'Stock',     icon: '🥄', path: '/admin/stock'     },
  { label: 'People',    icon: '👥', path: '/admin/people'    },
]

export default function AdminNavBar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <nav className="tab-bar">
      {TABS.map(tab => {
        const active = pathname.startsWith(tab.path)
        return (
          <button key={tab.path} className="tab-bar-item" onClick={() => navigate(tab.path)}>
            <span className="tab-bar-icon">{tab.icon}</span>
            <span className={`tab-bar-label${active ? ' active' : ''}`}>{tab.label}</span>
            {active && <span className="tab-bar-dot" />}
          </button>
        )
      })}
    </nav>
  )
}
