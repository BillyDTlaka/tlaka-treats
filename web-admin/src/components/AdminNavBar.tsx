import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const BASE_TABS = [
  { label: 'Dashboard', icon: '📊', path: '/admin/dashboard' },
  { label: 'Orders',    icon: '📦', path: '/admin/orders'    },
  { label: 'Stock',     icon: '🥄', path: '/admin/stock'     },
  { label: 'People',    icon: '👥', path: '/admin/people'    },
]
const ADMIN_TAB = { label: 'Bohlale', icon: '✨', path: '/admin/bohlale' }

export default function AdminNavBar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user } = useAuth()
  const isAdmin = user?.roles?.includes('ADMIN')
  const tabs = isAdmin ? [...BASE_TABS, ADMIN_TAB] : BASE_TABS

  return (
    <nav className="tab-bar">
      {tabs.map(tab => {
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
