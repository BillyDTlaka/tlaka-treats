import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCartStore } from '../../store/cart.store'
import { ordersApi, ambassadorsApi } from '../../services/api'
import AddressAutocomplete from '../../components/AddressAutocomplete'
import CustomerNavBar from '../../components/CustomerNavBar'

export default function CheckoutPage() {
  const navigate = useNavigate()
  const { items, ambassadorCode, notes, setAmbassadorCode, setNotes, removeItem, updateQuantity, getTotal, clearCart } = useCartStore()
  const [placing, setPlacing]               = useState(false)
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [ambassadors, setAmbassadors]       = useState<any[]>([])
  const [showAmbPicker, setShowAmbPicker]   = useState(false)
  const [ambSearch, setAmbSearch]           = useState('')

  useEffect(() => {
    ambassadorsApi.getActive().then(setAmbassadors).catch(() => {})
  }, [])

  const filteredAmbs = ambassadors.filter(a => !ambSearch.trim() || a.code?.toLowerCase().includes(ambSearch.toLowerCase()))

  const handlePlaceOrder = async () => {
    if (!items.length) { alert('Add some items first!'); return }
    if (!deliveryAddress.trim()) { alert('Please enter your delivery address'); return }
    setPlacing(true)
    try {
      await ordersApi.create({
        items: items.map(i => ({ variantId: i.variantId, quantity: i.quantity })),
        ambassadorCode: ambassadorCode.trim() || undefined,
        notes: `Delivery: ${deliveryAddress.trim()}${notes.trim() ? ` | ${notes.trim()}` : ''}`,
      })
      clearCart()
      alert('Order Placed! 🎉\n\nWe\'ve received your order and will start preparing it shortly.')
      navigate('/customer/orders')
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Something went wrong. Please try again.')
    } finally {
      setPlacing(false)
    }
  }

  const total = getTotal()

  if (!items.length) {
    return (
      <div className="screen" style={{ background: '#FDF6F0' }}>
        <div style={{ background: '#8B3A3A', display: 'flex', alignItems: 'center', padding: '52px 16px 16px', flexShrink: 0 }}>
          <button className="back-btn" onClick={() => navigate(-1)}>←</button>
          <p style={{ flex: 1, fontSize: 18, fontWeight: 800, color: '#fff', textAlign: 'center' }}>Your Cart</p>
          <div style={{ width: 40 }} />
        </div>
        <div className="empty-state" style={{ flex: 1 }}>
          <span style={{ fontSize: 64, marginBottom: 16 }}>🛒</span>
          <p style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a', marginBottom: 8 }}>Your cart is empty</p>
          <p style={{ fontSize: 14, color: '#999', textAlign: 'center', marginBottom: 24 }}>Browse our delicious treats and add them here</p>
          <button className="btn-primary" style={{ width: 'auto', padding: '14px 24px' }} onClick={() => navigate('/customer/home')}>Browse Products</button>
        </div>
        <CustomerNavBar />
      </div>
    )
  }

  return (
    <div className="screen" style={{ background: '#FDF6F0' }}>
      <div style={{ background: '#8B3A3A', display: 'flex', alignItems: 'center', padding: '52px 16px 16px', flexShrink: 0 }}>
        <button className="back-btn" onClick={() => navigate(-1)}>←</button>
        <p style={{ flex: 1, fontSize: 18, fontWeight: 800, color: '#fff', textAlign: 'center' }}>Your Cart</p>
        <div style={{ width: 40 }} />
      </div>

      <div className="scroll-content" style={{ padding: 16, paddingBottom: 100 }}>
        {/* Cart Items */}
        <p className="section-title">Items ({items.length})</p>
        {items.map(item => (
          <div key={item.variantId} className="cart-item">
            <div className="cart-item-emoji">🍪</div>
            <div className="cart-item-info">
              <p className="cart-item-name">{item.productName}</p>
              <p className="cart-item-variant">{item.variantName}</p>
              <p className="cart-item-price">R{item.price.toFixed(2)} each</p>
            </div>
            <div className="qty-row">
              <button className="qty-btn" onClick={() => updateQuantity(item.variantId, item.quantity - 1)}>−</button>
              <span className="qty-value">{item.quantity}</span>
              <button className="qty-btn" onClick={() => updateQuantity(item.variantId, item.quantity + 1)}>+</button>
            </div>
            <button className="remove-btn" onClick={() => removeItem(item.variantId)}>✕</button>
          </div>
        ))}

        {/* Delivery Address */}
        <p className="section-title">Delivery Address *</p>
        <AddressAutocomplete value={deliveryAddress} onChange={setDeliveryAddress} placeholder="e.g. 12 Rose Street, Soweto, 1804" />

        {/* Ambassador Code */}
        <p className="section-title">Ambassador Code (optional)</p>
        <button
          onClick={() => { setAmbSearch(''); setShowAmbPicker(true) }}
          style={{ width: '100%', display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #e8d5d5', borderRadius: 12, padding: 14, cursor: 'pointer', marginBottom: 16, textAlign: 'left' }}
        >
          <span style={{ flex: 1, fontSize: 15, color: ambassadorCode ? '#1a1a1a' : '#bbb', fontWeight: ambassadorCode ? 600 : 400 }}>
            {ambassadorCode || 'Select ambassador code…'}
          </span>
          {ambassadorCode ? (
            <button onClick={e => { e.stopPropagation(); setAmbassadorCode('') }} style={{ background: 'none', border: 'none', fontSize: 14, color: '#bbb', cursor: 'pointer', padding: '0 0 0 8px' }}>✕</button>
          ) : (
            <span style={{ fontSize: 16, color: '#999' }}>▾</span>
          )}
        </button>

        {/* Notes */}
        <p className="section-title">Special Instructions (optional)</p>
        <textarea
          className="form-textarea"
          style={{ height: 80, marginBottom: 16 }}
          placeholder="e.g. No nuts, extra packaging..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />

        {/* Summary */}
        <div className="summary-card">
          <p style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', marginBottom: 14 }}>Order Summary</p>
          {items.map(item => (
            <div key={item.variantId} className="summary-row">
              <span style={{ fontSize: 13, color: '#555', flex: 1 }}>{item.productName} × {item.quantity}</span>
              <span style={{ fontSize: 13, color: '#1a1a1a', fontWeight: 600 }}>R{(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          <div className="summary-divider" />
          <div className="summary-row">
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>Total</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: '#8B3A3A' }}>R{total.toFixed(2)}</span>
          </div>
          <p style={{ fontSize: 12, color: '#999', marginTop: 10, textAlign: 'center' }}>💳 Payment collected on delivery</p>
        </div>
      </div>

      {/* Place Order */}
      <div className="bottom-bar">
        <button className="btn-primary" disabled={placing} onClick={handlePlaceOrder}>
          {placing ? 'Placing Order…' : `Place Order · R${total.toFixed(2)}`}
        </button>
      </div>

      {/* Ambassador Picker Modal */}
      {showAmbPicker && (
        <div className="modal-overlay" onClick={() => setShowAmbPicker(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 17, fontWeight: 700, color: '#1a1a1a', textAlign: 'center', marginBottom: 14 }}>Select Ambassador</p>
            <input
              style={{ width: '100%', background: '#f5f0eb', borderRadius: 10, padding: 12, fontSize: 15, color: '#1a1a1a', border: 'none', outline: 'none', marginBottom: 12 }}
              placeholder="Search by code…"
              value={ambSearch}
              onChange={e => setAmbSearch(e.target.value.toUpperCase())}
              autoFocus
            />
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {filteredAmbs.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#999', padding: '24px 0', fontSize: 14 }}>{ambassadors.length === 0 ? 'No active ambassadors' : 'No results'}</p>
              ) : filteredAmbs.map(a => (
                <button
                  key={a.id}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '14px 0', background: 'none', borderBottom: '1px solid #f5f0eb', cursor: 'pointer' }}
                  onClick={() => { setAmbassadorCode(a.code); setShowAmbPicker(false) }}
                >
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#8B3A3A' }}>{a.code}</span>
                  {a.user && <span style={{ fontSize: 13, color: '#999' }}>{a.user.firstName} {a.user.lastName}</span>}
                </button>
              ))}
            </div>
            <button style={{ width: '100%', padding: '16px 0', background: 'none', border: 'none', fontSize: 15, color: '#999', fontWeight: 600, cursor: 'pointer', marginTop: 8 }} onClick={() => setShowAmbPicker(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
