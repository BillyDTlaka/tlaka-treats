import { useNavigate, useLocation } from 'react-router-dom'
import { useCartStore } from '../store/cart.store'

const TABS = [
  { label: 'Dashboard', icon: '📊', path: '/ambassador/dashboard' },
  { label: 'Orders',    icon: '📦', path: '/ambassador/orders'    },
  { label: 'Shop',      icon: '🍪', path: '/ambassador/shop'      },
  { label: 'Cart',      icon: '🛍️', path: '/ambassador/checkout'  },
  { label: 'Profile',   icon: '👤', path: '/ambassador/profile'   },
]

export default function AmbassadorNavBar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const cartCount = useCartStore(s => s.getItemCount())

  const isActive = (path: string) => {
    if (path === '/ambassador/shop') return pathname === '/ambassador/shop' || pathname.startsWith('/ambassador/product')
    return pathname.startsWith(path)
  }

  return (
    <nav className="tab-bar">
      {TABS.map(tab => {
        const active = isActive(tab.path)
        const isCart = tab.path === '/ambassador/checkout'
        return (
          <button key={tab.path} className="tab-bar-item" onClick={() => navigate(tab.path)}>
            <span className="tab-bar-icon" style={{ position: 'relative' }}>
              {tab.icon}
              {isCart && cartCount > 0 && (
                <span className="tab-badge">{cartCount > 9 ? '9+' : cartCount}</span>
              )}
            </span>
            <span className={`tab-bar-label${active ? ' active' : ''}`}>{tab.label}</span>
            {active && <span className="tab-bar-dot" />}
          </button>
        )
      })}
    </nav>
  )
}
