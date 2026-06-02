import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { productsApi } from '../../services/api'
import { useAuthStore } from '../../store/auth.store'
import { useCartStore } from '../../store/cart.store'
import AmbassadorNavBar from '../../components/AmbassadorNavBar'

export default function AmbassadorShop() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const cartCount = useCartStore(s => s.getItemCount())
  const [products, setProducts] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [selectedCat, setSelectedCat] = useState<string | null>(null)

  const fetchProducts = useCallback(async () => {
    try { const data = await productsApi.getAll(); setProducts(data); setFiltered(data) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchProducts() }, [fetchProducts])

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
      <div style={{ background: '#8B3A3A', padding: '52px 16px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.png" alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'contain', background: '#fff', padding: 2 }} />
            <div>
              <p style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>Hey, {user?.firstName} 👋</p>
              <p style={{ fontSize: 12, color: '#f5d0d0', marginTop: 1 }}>Order for yourself or customers</p>
            </div>
          </div>
          <button onClick={() => navigate('/ambassador/checkout')} style={{ background: 'none', border: 'none', padding: 6, cursor: 'pointer', position: 'relative' }}>
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

      {categories.length > 0 && (
        <div className="filter-row" style={{ flexShrink: 0 }}>
          <button className={`chip${!selectedCat ? ' active' : ''}`} onClick={() => setSelectedCat(null)}>All</button>
          {categories.map(cat => (
            <button key={cat} className={`chip${selectedCat === cat ? ' active' : ''}`} onClick={() => setSelectedCat(selectedCat === cat ? null : cat)}>{cat}</button>
          ))}
        </div>
      )}

      <div style={{ padding: '12px 12px 100px' }}>
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
                <div key={item.id} className="product-card" onClick={() => navigate(`/ambassador/product/${item.id}`)}>
                  <div className="product-image-area">🍪</div>
                  <div style={{ padding: 12 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', marginBottom: 3 }}>{item.name}</p>
                    {item.category?.name && <p style={{ fontSize: 11, color: '#bbb', marginBottom: 6 }}>{item.category.name}</p>}
                    {fromPrice != null ? (
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#8B3A3A' }}>From R{fromPrice.toFixed(2)}</p>
                    ) : (
                      <p style={{ fontSize: 12, color: '#bbb', fontStyle: 'italic' }}>Price on request</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <AmbassadorNavBar />
    </div>
  )
}
