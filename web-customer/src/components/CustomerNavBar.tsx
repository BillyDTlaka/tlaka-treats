import { useNavigate, useLocation } from 'react-router-dom'
import { useCartStore } from '../store/cart.store'

const TABS = [
  { label: 'Shop',    icon: '🛍️', path: '/customer/home'    },
  { label: 'Orders',  icon: '📦', path: '/customer/orders'  },
  { label: 'Profile', icon: '👤', path: '/customer/profile' },
]

export default function CustomerNavBar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const cartCount = useCartStore(s => s.getItemCount())

  const isActive = (path: string) => {
    if (path === '/customer/home') return pathname === '/customer/home' || pathname.startsWith('/customer/product')
    return pathname.startsWith(path)
  }

  return (
    <nav className="tab-bar">
      {TABS.map(tab => {
        const active = isActive(tab.path)
        const isShop = tab.path === '/customer/home'
        return (
          <button key={tab.path} className="tab-bar-item" onClick={() => navigate(tab.path)}>
            <span className="tab-bar-icon" style={{ position: 'relative' }}>
              {tab.icon}
              {isShop && cartCount > 0 && (
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
