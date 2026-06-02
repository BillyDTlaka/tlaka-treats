import { useState } from 'react'
import { useInventory } from '../../lib/hooks'
import { api } from '../../services/api'
import { BRAND, COLORS } from '../../lib/theme'
import AdminNavBar from '../../components/AdminNavBar'

export default function StockPage() {
  const { data: items = [], isLoading, refetch } = useInventory()
  const [search, setSearch]         = useState('')
  const [adjustItem, setAdjustItem] = useState<any>(null)
  const [adjustQty, setAdjustQty]   = useState('')
  const [adjustNote, setAdjustNote] = useState('')
  const [saving, setSaving]         = useState(false)

  const filtered = items.filter((i: any) => i.name?.toLowerCase().includes(search.toLowerCase()))

  const stockColor = (item: any) => {
    const q = Number(item.currentStock)
    if (q <= 2) return COLORS.danger
    if (q <= 10) return COLORS.warning
    return COLORS.success
  }

  const handleAdjust = async () => {
    if (!adjustQty) return
    setSaving(true)
    try {
      await api.inventory.adjust(adjustItem.id, { adjustment: Number(adjustQty), notes: adjustNote || undefined, type: 'ADJUSTMENT_IN' })
      setAdjustItem(null); setAdjustQty(''); setAdjustNote('')
      refetch()
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to adjust')
    } finally { setSaving(false) }
  }

  return (
    <div className="screen" style={{ background: COLORS.gray50 }}>
      <div style={{ paddingTop: 52, paddingInline: 16, paddingBottom: 12, background: '#fff', borderBottom: `1px solid ${COLORS.gray100}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <p style={{ fontSize: 22, fontWeight: 900, color: COLORS.gray900 }}>Stock</p>
          <p style={{ fontSize: 13, color: COLORS.gray400, fontWeight: 600 }}>{items.length} items</p>
        </div>
        <input
          className="form-input" style={{ background: '#fff', width: '100%' }}
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search ingredients…"
        />
      </div>

      {isLoading ? (
        <div className="spinner-wrap"><div className="spinner" /></div>
      ) : (
        <div className="scroll-content" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((item: any) => {
            const color = stockColor(item)
            const qty   = Number(item.currentStock)
            return (
              <button key={item.id} onClick={() => { setAdjustItem(item); setAdjustQty(''); setAdjustNote('') }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 16, border: `1px solid ${COLORS.gray100}`, padding: 14, cursor: 'pointer', textAlign: 'left' }}>
                <div className="stock-dot" style={{ background: color }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: COLORS.gray900 }}>{item.name}</p>
                  <p style={{ fontSize: 11, color: COLORS.gray400, marginTop: 2 }}>{item.category || item.supplier?.name || 'Ingredient'}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 18, fontWeight: 900, color }}>{qty.toFixed(1)}</p>
                  <p style={{ fontSize: 11, color: COLORS.gray400 }}>{item.uom?.abbreviation || ''}</p>
                </div>
              </button>
            )
          })}
          {filtered.length === 0 && <p style={{ textAlign: 'center', color: COLORS.gray400, marginTop: 60, fontSize: 15 }}>No items found</p>}
          <div style={{ height: 24 }} />
        </div>
      )}

      {/* Adjust Modal */}
      {adjustItem && (
        <div className="modal-overlay" onClick={() => setAdjustItem(null)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 18, fontWeight: 900, color: COLORS.gray900, marginBottom: 4 }}>Adjust Stock</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: BRAND, marginBottom: 2 }}>{adjustItem.name}</p>
            <p style={{ fontSize: 13, color: COLORS.gray500, marginBottom: 20 }}>Current: {Number(adjustItem.currentStock || 0).toFixed(1)} {adjustItem.uom?.abbreviation}</p>
            <label className="form-label">Quantity to add (+) or remove (−)</label>
            <input className="form-input" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} placeholder="e.g. 5 or -2" type="number" autoFocus />
            <label className="form-label">Note (optional)</label>
            <input className="form-input" style={{ marginBottom: 20 }} value={adjustNote} onChange={e => setAdjustNote(e.target.value)} placeholder="e.g. Received from Makro" />
            <button className="btn-primary" onClick={handleAdjust} disabled={saving}>{saving ? 'Saving…' : 'Save Adjustment'}</button>
          </div>
        </div>
      )}

      <AdminNavBar />
    </div>
  )
}
