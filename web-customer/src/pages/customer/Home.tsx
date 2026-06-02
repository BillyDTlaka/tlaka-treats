import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { productsApi, ambassadorsApi } from '../../services/api'
import { useAuthStore } from '../../store/auth.store'
import { useCartStore } from '../../store/cart.store'
import CustomerNavBar from '../../components/CustomerNavBar'

export default function CustomerHome() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const cartCount = useCartStore(s => s.getItemCount())
  const [products, setProducts] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [ambassadorApp, setAmbassadorApp] = useState<any>(undefined)

  const fetchProducts = useCallback(async () => {
    try {
      const data = await productsApi.getAll()
      setProducts(data); setFiltered(data)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchProducts()
    ambassadorsApi.myApplication().then(setAmbassadorApp)
  }, [fetchProducts])

  useEffect(() => {
    let result = products
    if (selectedCat) result = result.filter((p: any) => p.category?.name === selectedCat)
    if (search.trim()) result = result.filter((p: any) => p.name?.toLowerCase().includes(search.toLowerCase()))
    setFiltered(result)
  }, [search, selectedCat, products])

  const categories = Array.from(new Set(products.map((p: any) => p.category?.name).filter(Boolean))) as string[]

  const getFromPrice = (product: any) => {
    const prices = product.variants?.flatMap((v: any) => v.prices?.filter((p: any) => p.tier === 'RETAIL') ?? []) ?? []
    if (!prices.length) return null
    return Math.min(...prices.map((p: any) => Number(p.price)))
  }

  return (
    <div className="screen" style={{ background: '#FDF6F0' }}>
      {/* Header */}
      <div style={{ background: '#8B3A3A', padding: '52px 16px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>Hey, {user?.firstName} 👋</p>
            <p style={{ fontSize: 13, color: '#f5d0d0', marginTop: 2 }}>What are you craving today?</p>
          </div>
          <button onClick={() => navigate('/customer/checkout')} style={{ background: 'none', border: 'none', padding: 6, cursor: 'pointer', position: 'relative' }}>
            <span style={{ fontSize: 26 }}>🛍️</span>
            {cartCount > 0 && (
              <span style={{ position: 'absolute', top: 0, right: 0, background: '#fff', color: '#8B3A3A', borderRadius: 8, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, padding: '0 3px' }}>
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </button>
        </div>
        <div className="search-bar">
          <span style={{ fontSize: 16, marginRight: 8 }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search treats..." />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', fontSize: 14, color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: 4 }}>✕</button>}
        </div>
      </div>

      {/* Category Filter */}
      {categories.length > 0 && (
        <div className="filter-row" style={{ flexShrink: 0 }}>
          <button className={`chip${!selectedCat ? ' active' : ''}`} onClick={() => setSelectedCat(null)}>All</button>
          {categories.map(cat => (
            <button key={cat} className={`chip${selectedCat === cat ? ' active' : ''}`} onClick={() => setSelectedCat(selectedCat === cat ? null : cat)}>{cat}</button>
          ))}
        </div>
      )}

      <div style={{ padding: '12px 12px 0' }}>
        {/* Ambassador banner */}
        {ambassadorApp === null && (
          <button className="amb-banner" onClick={() => navigate('/customer/ambassador-apply')} style={{ border: 'none', width: '100%', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: 12 }}>
              <span style={{ fontSize: 28 }}>🌟</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>Become an Ambassador</p>
                <p style={{ fontSize: 11, color: '#f5d0d0', marginTop: 2 }}>Earn commission on every order with your unique code</p>
              </div>
            </div>
            <span style={{ fontSize: 18, color: '#fff', fontWeight: 700 }}>→</span>
          </button>
        )}
        {ambassadorApp && ambassadorApp.status !== 'ACTIVE' && (
          <button className="amb-status-banner" onClick={() => navigate('/customer/ambassador-status')} style={{ border: '1px solid #ffeeba', width: '100%', textAlign: 'left' }}>
            <span style={{ fontSize: 24, marginRight: 12 }}>{ambassadorApp.status === 'PENDING' ? '⏳' : '⚠️'}</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: '#856404' }}>Ambassador Application</p>
              <p style={{ fontSize: 11, color: '#856404', marginTop: 2 }}>
                {ambassadorApp.status === 'PENDING' ? 'Under review — tap to check status' : 'Account suspended — tap for details'}
              </p>
            </div>
            <span style={{ fontSize: 18, color: '#856404', fontWeight: 700 }}>→</span>
          </button>
        )}

        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <span style={{ fontSize: 48, marginBottom: 12 }}>🔍</span>
            <p style={{ fontSize: 16, color: '#999' }}>No treats found</p>
          </div>
        ) : (
          <div className="product-grid" style={{ paddingBottom: 20 }}>
            {filtered.map((item: any) => {
              const fromPrice = getFromPrice(item)
              return (
                <div key={item.id} className="product-card" onClick={() => navigate(`/customer/product/${item.id}`)}>
                  <div className="product-image-area">🍪</div>
                  <div style={{ padding: 12 }}>
                    <p className="product-name" style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{item.name}</p>
                    {item.category?.name && <p className="product-category">{item.category.name}</p>}
                    {fromPrice != null ? (
                      <p className="product-price">From R{fromPrice.toFixed(2)}</p>
                    ) : (
                      <p className="product-price-na">Price on request</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <CustomerNavBar />
    </div>
  )
}
