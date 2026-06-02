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
  const [toastVisible, setToastVisible] = useState(false)
  const [btnAdded, setBtnAdded]         = useState(false)
  const addItem  = useCartStore(s => s.addItem)
  const cartCount = useCartStore(s => s.getItemCount())

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

    addItem({
      productId: product.id,
      variantId: selectedVariant.id,
      quantity,
      productName: product.name,
      variantName: selectedVariant.name,
      price,
    })
    setQuantity(1)

    // Flash the button green then revert
    setBtnAdded(true)
    setTimeout(() => setBtnAdded(false), 2000)

    // Show toast then fade it away
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 3500)
  }

  if (loading) return <div className="spinner-wrap" style={{ minHeight: '100vh' }}><div className="spinner" /></div>
  if (!product) return <div className="spinner-wrap" style={{ minHeight: '100vh' }}><p style={{ color: '#999' }}>Product not found</p></div>

  const price = selectedVariant ? getRetailPrice(selectedVariant) : null

  return (
    <div className="screen" style={{ background: '#FDF6F0', paddingBottom: 120 }}>
      {/* Header */}
      <div style={{ background: '#8B3A3A', display: 'flex', alignItems: 'center', padding: '52px 16px 16px' }}>
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <p style={{ flex: 1, fontSize: 17, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Product Details
        </p>
        <button onClick={() => navigate(checkoutPath)} style={{ background: 'none', border: 'none', padding: 8, cursor: 'pointer', position: 'relative' }}>
          <span style={{ fontSize: 22 }}>🛍️</span>
          {cartCount > 0 && (
            <span style={{ position: 'absolute', top: 2, right: 2, background: '#fff', color: '#8B3A3A', borderRadius: 8, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, padding: '0 2px' }}>
              {cartCount > 9 ? '9+' : cartCount}
            </span>
          )}
        </button>
      </div>

      {/* Product image */}
      <div style={{ background: '#FFF0E6', height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <span style={{ fontSize: 90 }}>🍪</span>
        {product.category?.name && (
          <div style={{ position: 'absolute', bottom: 14, left: 16, background: '#8B3A3A', borderRadius: 20, padding: '5px 14px' }}>
            <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{product.category.name}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '20px 20px 8px' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a', marginBottom: 8 }}>{product.name}</h1>
        {product.description && (
          <p style={{ fontSize: 14, color: '#666', lineHeight: 1.6, marginBottom: 14 }}>{product.description}</p>
        )}
        {price && <p style={{ fontSize: 28, fontWeight: 900, color: '#8B3A3A' }}>R{price.toFixed(2)}</p>}
      </div>

      {/* Variants */}
      {product.variants?.length > 0 && (
        <div style={{ padding: '8px 20px 16px' }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 12 }}>Choose Size</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {product.variants.map((variant: any) => {
              const vPrice = getRetailPrice(variant)
              const isSelected = selectedVariant?.id === variant.id
              return (
                <button
                  key={variant.id}
                  onClick={() => setSelectedVariant(variant)}
                  style={{
                    border: `2px solid ${isSelected ? '#8B3A3A' : '#e0c8c8'}`,
                    borderRadius: 12,
                    padding: '10px 18px',
                    background: isSelected ? '#8B3A3A' : '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 600, color: isSelected ? '#fff' : '#1a1a1a' }}>{variant.name}</span>
                  {vPrice && <span style={{ fontSize: 13, color: isSelected ? '#f5d0d0' : '#8B3A3A', marginTop: 2, fontWeight: 600 }}>R{vPrice.toFixed(2)}</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Quantity */}
      <div style={{ padding: '8px 20px 24px' }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 14 }}>Quantity</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <button
            onClick={() => setQuantity(q => Math.max(1, q - 1))}
            style={{ width: 48, height: 48, borderRadius: 24, background: '#8B3A3A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer' }}
          >−</button>
          <span style={{ fontSize: 24, fontWeight: 800, minWidth: 32, textAlign: 'center' }}>{quantity}</span>
          <button
            onClick={() => setQuantity(q => q + 1)}
            style={{ width: 48, height: 48, borderRadius: 24, background: '#8B3A3A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer' }}
          >+</button>
        </div>
      </div>

      {/* Fixed Add to Cart bar */}
      <div className="bottom-bar">
        {price && (
          <p style={{ fontSize: 14, color: '#666', marginBottom: 10, textAlign: 'center' }}>
            Total: <strong style={{ color: '#8B3A3A' }}>R{(price * quantity).toFixed(2)}</strong>
          </p>
        )}
        <button
          onClick={handleAddToCart}
          style={{
            width: '100%',
            background: btnAdded ? '#059669' : '#8B3A3A',
            color: '#fff',
            borderRadius: 14,
            padding: 16,
            fontSize: 16,
            fontWeight: 800,
            border: 'none',
            cursor: 'pointer',
            transition: 'background 0.3s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {btnAdded ? '✓ Added to Cart!' : 'Add to Cart 🛍️'}
        </button>
      </div>

      {/* Toast notification */}
      {toastVisible && (
        <div className="cart-toast">
          <span style={{ fontSize: 18 }}>🛍️</span>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Added to cart!</span>
          <button
            onClick={() => navigate(checkoutPath)}
            style={{ background: '#8B3A3A', color: '#fff', border: 'none', borderRadius: 18, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            View Cart →
          </button>
          <button
            onClick={() => setToastVisible(false)}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
