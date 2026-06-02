import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { productsApi } from '../../services/api'
import { useCartStore } from '../../store/cart.store'

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [product, setProduct]           = useState<any>(null)
  const [loading, setLoading]           = useState(true)
  const [selectedVariant, setSelectedVariant] = useState<any>(null)
  const [quantity, setQuantity]         = useState(1)
  const addItem = useCartStore(s => s.addItem)
  const cartCount = useCartStore(s => s.getItemCount())

  // Determine which checkout route to use based on where we came from
  const isAmbassador = location.pathname.startsWith('/ambassador')
  const checkoutPath = isAmbassador ? '/ambassador/checkout' : '/customer/checkout'

  useEffect(() => {
    productsApi.getById(id!).then(p => {
      setProduct(p)
      if (p.variants?.length > 0) setSelectedVariant(p.variants[0])
    }).finally(() => setLoading(false))
  }, [id])

  const getRetailPrice = (variant: any) => {
    const price = variant?.prices?.find((p: any) => p.tier === 'RETAIL') ?? variant?.prices?.[0]
    return price ? Number(price.price) : null
  }

  const handleAddToCart = () => {
    if (!selectedVariant) { alert('Please choose a size first'); return }
    const price = getRetailPrice(selectedVariant)
    if (!price) { alert('No price available for this option'); return }
    addItem({ productId: product.id, variantId: selectedVariant.id, quantity, productName: product.name, variantName: selectedVariant.name, price })
    setQuantity(1)
    if (window.confirm(`${quantity}× ${product.name} added to your cart.\n\nView cart now?`)) {
      navigate(checkoutPath)
    }
  }

  if (loading) return <div className="spinner-wrap" style={{ minHeight: '100vh' }}><div className="spinner" /></div>
  if (!product) return <div className="spinner-wrap" style={{ minHeight: '100vh' }}><p style={{ color: '#999' }}>Product not found</p></div>

  const price = selectedVariant ? getRetailPrice(selectedVariant) : null

  return (
    <div className="screen" style={{ background: '#FDF6F0' }}>
      {/* Header */}
      <div style={{ background: '#8B3A3A', display: 'flex', alignItems: 'center', padding: '52px 16px 16px', flexShrink: 0 }}>
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <p style={{ flex: 1, fontSize: 17, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Product Details</p>
        <button onClick={() => navigate(checkoutPath)} style={{ background: 'none', border: 'none', padding: 8, cursor: 'pointer', position: 'relative' }}>
          <span style={{ fontSize: 22 }}>🛍️</span>
          {cartCount > 0 && (
            <span style={{ position: 'absolute', top: 2, right: 2, background: '#fff', color: '#8B3A3A', borderRadius: 8, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, padding: '0 2px' }}>
              {cartCount > 9 ? '9+' : cartCount}
            </span>
          )}
        </button>
      </div>

      <div className="scroll-content" style={{ paddingBottom: 120 }}>
        {/* Image */}
        <div style={{ background: '#FFF0E6', height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <span style={{ fontSize: 80 }}>🍪</span>
          {product.category?.name && (
            <div style={{ position: 'absolute', bottom: 12, left: 16, background: '#8B3A3A', borderRadius: 20, padding: '4px 12px' }}>
              <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{product.category.name}</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ padding: 20 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a', marginBottom: 8 }}>{product.name}</h1>
          {product.description && <p style={{ fontSize: 14, color: '#666', lineHeight: 1.5, marginBottom: 12 }}>{product.description}</p>}
          {price && <p style={{ fontSize: 26, fontWeight: 800, color: '#8B3A3A' }}>R{price.toFixed(2)}</p>}
        </div>

        {/* Variants */}
        {product.variants?.length > 0 && (
          <div style={{ paddingInline: 20, marginBottom: 24 }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginBottom: 12 }}>Choose Size</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {product.variants.map((variant: any) => {
                const vPrice = getRetailPrice(variant)
                const isSelected = selectedVariant?.id === variant.id
                return (
                  <button
                    key={variant.id}
                    className={`variant-chip${isSelected ? ' selected' : ''}`}
                    onClick={() => setSelectedVariant(variant)}
                  >
                    <span className="name">{variant.name}</span>
                    {vPrice && <span className="price">R{vPrice.toFixed(2)}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Quantity */}
        <div style={{ paddingInline: 20, marginBottom: 24 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginBottom: 12 }}>Quantity</p>
          <div className="qty-row-lg">
            <button className="qty-btn-lg" onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button>
            <span className="qty-value-lg">{quantity}</span>
            <button className="qty-btn-lg" onClick={() => setQuantity(q => q + 1)}>+</button>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="bottom-bar">
        {price && <p style={{ fontSize: 14, color: '#666', marginBottom: 10, textAlign: 'center' }}>Total: R{(price * quantity).toFixed(2)}</p>}
        <button className="btn-primary" onClick={handleAddToCart}>Add to Cart 🛍️</button>
      </div>
    </div>
  )
}
