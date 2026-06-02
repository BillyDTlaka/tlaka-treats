import { useState, useEffect, useCallback } from 'react'
import { api } from '../../services/api'
import { BRAND, COLORS } from '../../lib/theme'
import AdminNavBar from '../../components/AdminNavBar'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Price    { id?: string; tier: string; price: number }
interface Variant  { id: string; name: string; isActive: boolean; prices: Price[] }
interface Category { id: string; name: string }
interface Product  {
  id: string; name: string; description: string | null; isActive: boolean
  category?: Category | null; variants: Variant[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function retailPrice(v: Variant): number | undefined {
  const p = v.prices.find(p => p.tier === 'RETAIL')?.price
  return p != null ? Number(p) : undefined
}

function priceLabel(product: Product): string {
  const prices = product.variants
    .filter(v => v.isActive)
    .map(v => retailPrice(v))
    .filter((p): p is number => p != null)
  if (!prices.length) return 'No price set'
  const min = Math.min(...prices), max = Math.max(...prices)
  return min === max ? `R${min.toFixed(2)}` : `R${min.toFixed(2)} – R${max.toFixed(2)}`
}

// ── Product form (create + edit) ──────────────────────────────────────────────

interface FormRow { name: string; price: string }

function ProductForm({
  initial, categories, onSave, onClose, onCategoryCreated,
}: {
  initial?: Product; categories: Category[]
  onSave: (data: any) => Promise<void>
  onClose: () => void
  onCategoryCreated: (cat: Category) => void
}) {
  const [name, setName]           = useState(initial?.name ?? '')
  const [desc, setDesc]           = useState(initial?.description ?? '')
  const [catId, setCatId]         = useState(initial?.category?.id ?? '')
  const [newCat, setNewCat]       = useState('')
  const [showNewCat, setShowNewCat] = useState(false)
  const [rows, setRows]           = useState<FormRow[]>(
    initial?.variants.filter(v => v.isActive).map(v => ({
      name: v.name, price: String(retailPrice(v) ?? ''),
    })) ?? [{ name: '', price: '' }]
  )
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  const setRow = (i: number, field: keyof FormRow, val: string) =>
    setRows(rs => rs.map((r, idx) => idx === i ? { ...r, [field]: val } : r))

  const handleSave = async () => {
    if (!name.trim()) { setError('Product name is required'); return }
    const badRow = rows.find(r => r.name.trim() && r.price && isNaN(Number(r.price)))
    if (badRow) { setError(`"${badRow.price}" is not a valid price`); return }
    setSaving(true); setError('')
    try {
      await onSave({
        name: name.trim(),
        description: desc.trim() || undefined,
        categoryId: catId || undefined,
        variants: rows.filter(r => r.name.trim()).map(r => ({
          name: r.name.trim(),
          prices: r.price ? [{ tier: 'RETAIL', price: Number(r.price) }] : [],
        })),
      })
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Save failed — please try again')
      setSaving(false)
    }
  }

  const createCategory = async () => {
    if (!newCat.trim()) return
    try {
      const cat = await api.productsAdmin.createCategory(newCat.trim())
      onCategoryCreated(cat)
      setCatId(cat.id)
      setNewCat(''); setShowNewCat(false)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Could not create category')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: '20px 20px 0 0', padding: 24,
        maxHeight: '92vh', overflowY: 'auto', width: '100%',
        paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <p style={{ fontSize: 18, fontWeight: 800, color: COLORS.gray900 }}>
            {initial ? 'Edit Product' : '+ New Product'}
          </p>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', background: COLORS.gray100, border: 'none', cursor: 'pointer', fontSize: 16, color: COLORS.gray500 }}>✕</button>
        </div>

        {error && (
          <div style={{ background: '#FEE2E2', borderRadius: 10, padding: '10px 14px', color: COLORS.danger, fontSize: 14, marginBottom: 16 }}>
            ⚠️ {error}
          </div>
        )}

        {/* Name */}
        <label style={{ fontSize: 12, fontWeight: 700, color: COLORS.gray500, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>
          Product Name *
        </label>
        <input
          className="form-input"
          value={name} onChange={e => setName(e.target.value)}
          placeholder="e.g. Chocolate Chip Cookies"
          style={{ marginBottom: 16 }}
          autoFocus={!initial}
        />

        {/* Description */}
        <label style={{ fontSize: 12, fontWeight: 700, color: COLORS.gray500, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>
          Description
        </label>
        <textarea
          value={desc} onChange={e => setDesc(e.target.value)}
          placeholder="Brief description for customers…"
          style={{ width: '100%', border: `1px solid ${COLORS.gray200}`, borderRadius: 12, padding: '10px 14px', fontSize: 14, color: COLORS.gray900, resize: 'none', height: 76, fontFamily: 'inherit', outline: 'none', marginBottom: 16, boxSizing: 'border-box' }}
        />

        {/* Category */}
        <label style={{ fontSize: 12, fontWeight: 700, color: COLORS.gray500, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>
          Category
        </label>
        {showNewCat ? (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              className="form-input" style={{ flex: 1 }}
              placeholder="New category name…"
              value={newCat} onChange={e => setNewCat(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createCategory()}
              autoFocus
            />
            <button onClick={createCategory} style={{ padding: '0 16px', borderRadius: 12, background: BRAND, color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>
              Add
            </button>
            <button onClick={() => setShowNewCat(false)} style={{ padding: '0 12px', borderRadius: 12, border: `1px solid ${COLORS.gray200}`, background: '#fff', cursor: 'pointer', fontSize: 13, color: COLORS.gray500 }}>
              ✕
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <select
              value={catId} onChange={e => setCatId(e.target.value)}
              style={{ flex: 1, border: `1px solid ${COLORS.gray200}`, borderRadius: 12, padding: '10px 14px', fontSize: 14, color: COLORS.gray900, background: '#fff', outline: 'none' }}
            >
              <option value="">No category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button
              onClick={() => setShowNewCat(true)}
              style={{ padding: '0 14px', borderRadius: 12, border: `1px solid ${COLORS.gray200}`, background: '#fff', fontSize: 13, fontWeight: 700, color: BRAND, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              + New
            </button>
          </div>
        )}

        {/* Variants */}
        <label style={{ fontSize: 12, fontWeight: 700, color: COLORS.gray500, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>
          Sizes & Prices
        </label>
        <div style={{ background: COLORS.gray50, borderRadius: 12, padding: 12, marginBottom: 6 }}>
          {/* Header */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <span style={{ flex: 2, fontSize: 11, fontWeight: 700, color: COLORS.gray400, textTransform: 'uppercase' }}>Size / Name</span>
            <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: COLORS.gray400, textTransform: 'uppercase' }}>Retail Price</span>
            <span style={{ width: 32 }} />
          </div>
          {rows.map((row, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input
                style={{ flex: 2, border: `1px solid ${COLORS.gray200}`, borderRadius: 10, padding: '9px 12px', fontSize: 14, color: COLORS.gray900, outline: 'none', background: '#fff' }}
                placeholder={`e.g. ${['6 Pack', '12 Pack', '24 Pack', 'Whole Cake'][i % 4]}`}
                value={row.name} onChange={e => setRow(i, 'name', e.target.value)}
              />
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', border: `1px solid ${COLORS.gray200}`, borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
                <span style={{ paddingLeft: 10, fontSize: 14, color: COLORS.gray400 }}>R</span>
                <input
                  style={{ flex: 1, border: 'none', padding: '9px 8px', fontSize: 14, color: COLORS.gray900, outline: 'none' }}
                  placeholder="0.00" type="number" min="0" step="0.50"
                  value={row.price} onChange={e => setRow(i, 'price', e.target.value)}
                />
              </div>
              <button
                onClick={() => rows.length > 1 ? setRows(rs => rs.filter((_, idx) => idx !== i)) : null}
                style={{ width: 32, height: 32, borderRadius: '50%', background: rows.length > 1 ? COLORS.gray100 : 'transparent', border: 'none', cursor: rows.length > 1 ? 'pointer' : 'default', fontSize: 14, color: rows.length > 1 ? COLORS.danger : 'transparent', flexShrink: 0 }}
              >✕</button>
            </div>
          ))}
          <button
            onClick={() => setRows(rs => [...rs, { name: '', price: '' }])}
            style={{ width: '100%', padding: 9, border: `1.5px dashed ${COLORS.gray200}`, borderRadius: 10, background: 'none', fontSize: 13, fontWeight: 600, color: COLORS.gray400, cursor: 'pointer', marginTop: 4 }}
          >
            + Add size
          </button>
        </div>

        <p style={{ fontSize: 12, color: COLORS.gray400, marginBottom: 24 }}>
          Add one row per size (e.g. 6 Pack, 12 Pack). Leave price blank if not yet decided.
        </p>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 14, borderRadius: 14, border: `1px solid ${COLORS.gray200}`, background: '#fff', fontSize: 15, fontWeight: 600, color: COLORS.gray500, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 14, borderRadius: 14, background: saving ? COLORS.gray400 : BRAND, border: 'none', fontSize: 15, fontWeight: 800, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Product'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Variant manager ───────────────────────────────────────────────────────────

function VariantManager({ product, onDone }: { product: Product; onDone: () => void }) {
  const [rows, setRows]       = useState(
    product.variants.filter(v => v.isActive).map(v => ({
      id: v.id, name: v.name, price: String(retailPrice(v) ?? ''), dirty: false,
    }))
  )
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [saving, setSaving]   = useState(false)

  const updatePrice = async (vid: string, price: string) => {
    if (!price || isNaN(Number(price))) return
    try {
      await api.productsAdmin.updateVariantPrice(product.id, vid, { tier: 'RETAIL', price: Number(price) })
    } catch { /* ignore */ }
  }

  const remove = async (vid: string) => {
    if (!window.confirm('Remove this size? It will be hidden from customers.')) return
    try {
      await api.productsAdmin.removeVariant(product.id, vid)
      setRows(rs => rs.filter(r => r.id !== vid))
    } catch (err: any) { alert(err?.response?.data?.message || 'Failed') }
  }

  const addVariant = async () => {
    if (!newName.trim()) { alert('Enter a size name'); return }
    setSaving(true)
    try {
      const v = await api.productsAdmin.addVariant(product.id, {
        name: newName.trim(),
        prices: newPrice ? [{ tier: 'RETAIL', price: Number(newPrice) }] : [],
      })
      setRows(rs => [...rs, { id: v.id, name: v.name, price: newPrice, dirty: false }])
      setNewName(''); setNewPrice('')
    } catch (err: any) { alert(err?.response?.data?.message || 'Failed') }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onDone}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: 24, maxHeight: '80vh', overflowY: 'auto', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p style={{ fontSize: 17, fontWeight: 800, color: COLORS.gray900 }}>Sizes — {product.name}</p>
          <button onClick={onDone} style={{ width: 32, height: 32, borderRadius: '50%', background: COLORS.gray100, border: 'none', cursor: 'pointer', fontSize: 16, color: COLORS.gray500 }}>✕</button>
        </div>

        {rows.length === 0 && <p style={{ textAlign: 'center', color: COLORS.gray400, padding: '16px 0' }}>No sizes yet — add one below</p>}

        {rows.map(row => (
          <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <p style={{ flex: 2, fontSize: 14, fontWeight: 600, color: COLORS.gray900 }}>{row.name}</p>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', border: `1px solid ${COLORS.gray200}`, borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
              <span style={{ paddingLeft: 10, fontSize: 14, color: COLORS.gray400 }}>R</span>
              <input
                style={{ flex: 1, border: 'none', padding: '9px 6px', fontSize: 14, color: COLORS.gray900, outline: 'none' }}
                defaultValue={row.price} type="number" min="0" step="0.50" placeholder="—"
                onBlur={e => updatePrice(row.id, e.target.value)}
              />
            </div>
            <button onClick={() => remove(row.id)} style={{ width: 30, height: 30, borderRadius: '50%', background: '#FEE2E2', border: 'none', cursor: 'pointer', fontSize: 13, color: COLORS.danger, flexShrink: 0 }}>✕</button>
          </div>
        ))}

        <div style={{ borderTop: `1px solid ${COLORS.gray100}`, paddingTop: 16, marginTop: 8 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: COLORS.gray500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Add Size</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="form-input" style={{ flex: 2 }} placeholder="Size name (e.g. 12 Pack)" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addVariant()} />
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', border: `1px solid ${COLORS.gray200}`, borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
              <span style={{ paddingLeft: 10, fontSize: 14, color: COLORS.gray400 }}>R</span>
              <input style={{ flex: 1, border: 'none', padding: '10px 6px', fontSize: 14, outline: 'none' }} placeholder="0.00" type="number" min="0" step="0.50" value={newPrice} onChange={e => setNewPrice(e.target.value)} />
            </div>
            <button onClick={addVariant} disabled={saving} style={{ padding: '10px 16px', borderRadius: 12, background: BRAND, border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13, flexShrink: 0, opacity: saving ? 0.7 : 1 }}>
              {saving ? '…' : 'Add'}
            </button>
          </div>
        </div>

        <button onClick={onDone} style={{ width: '100%', marginTop: 20, padding: 14, borderRadius: 14, background: BRAND, border: 'none', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
          Done
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const [products, setProducts]     = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [filterCat, setFilterCat]   = useState('')
  const [showAll, setShowAll]       = useState(false)
  const [search, setSearch]         = useState('')
  const [showForm, setShowForm]     = useState(false)
  const [editing, setEditing]       = useState<Product | null>(null)
  const [managingVariants, setManagingVariants] = useState<Product | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const [prods, cats] = await Promise.all([
        api.productsAdmin.list(),
        api.productsAdmin.listCategories(),
      ])
      setProducts(prods ?? [])
      setCategories(cats ?? [])
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Could not load products'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const displayed = products
    .filter(p => showAll || p.isActive)
    .filter(p => !filterCat || p.category?.id === filterCat)
    .filter(p => !search.trim() || p.name.toLowerCase().includes(search.toLowerCase()))

  const handleCreate = async (data: any) => {
    await api.productsAdmin.create(data)
    setShowForm(false)
    await load()
  }

  const handleEdit = async (data: any) => {
    if (!editing) return
    await api.productsAdmin.update(editing.id, {
      name: data.name,
      description: data.description ?? null,
      categoryId: data.categoryId || null,
    })
    setEditing(null)
    await load()
  }

  const toggleActive = async (p: Product) => {
    try {
      await api.productsAdmin.update(p.id, { isActive: !p.isActive })
      // Optimistic update
      setProducts(ps => ps.map(x => x.id === p.id ? { ...x, isActive: !p.isActive } : x))
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to update')
    }
  }

  const activeCount   = products.filter(p => p.isActive).length
  const inactiveCount = products.length - activeCount

  if (loading) return (
    <div className="screen" style={{ background: COLORS.gray50 }}>
      <div style={{ paddingTop: 52, paddingInline: 16, paddingBottom: 60, background: '#fff', borderBottom: `1px solid ${COLORS.gray100}` }}>
        <p style={{ fontSize: 22, fontWeight: 900, color: COLORS.gray900 }}>Products</p>
      </div>
      <div className="spinner-wrap" style={{ flex: 1 }}><div className="spinner" /></div>
      <AdminNavBar />
    </div>
  )

  return (
    <div className="screen" style={{ background: COLORS.gray50 }}>
      {/* ── Header ── */}
      <div style={{ paddingTop: 52, paddingInline: 16, paddingBottom: 12, background: '#fff', borderBottom: `1px solid ${COLORS.gray100}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <p style={{ fontSize: 22, fontWeight: 900, color: COLORS.gray900 }}>Products</p>
            <p style={{ fontSize: 12, color: COLORS.gray400, marginTop: 2 }}>
              {activeCount} active{inactiveCount > 0 ? ` · ${inactiveCount} hidden` : ''}
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            style={{ background: BRAND, color: '#fff', borderRadius: 12, padding: '10px 16px', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
          >
            + New Product
          </button>
        </div>

        {/* Search */}
        <input
          className="form-input"
          placeholder="🔍  Search by name…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ marginBottom: 10 }}
        />

        {/* Category filter chips */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          <button
            onClick={() => setFilterCat('')}
            style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${filterCat === '' ? BRAND : COLORS.gray200}`, background: filterCat === '' ? BRAND : '#fff', color: filterCat === '' ? '#fff' : COLORS.gray600, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setFilterCat(filterCat === cat.id ? '' : cat.id)}
              style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${filterCat === cat.id ? BRAND : COLORS.gray200}`, background: filterCat === cat.id ? BRAND : '#fff', color: filterCat === cat.id ? '#fff' : COLORS.gray600, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              {cat.name}
            </button>
          ))}
          <button
            onClick={() => setShowAll(s => !s)}
            style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${showAll ? COLORS.gray400 : COLORS.gray200}`, background: showAll ? COLORS.gray700 : '#fff', color: showAll ? '#fff' : COLORS.gray400, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {showAll ? 'Showing all' : 'Show hidden'}
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ padding: 16, paddingBottom: 100 }}>
        {/* Error state */}
        {error && (
          <div style={{ background: '#FEE2E2', borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: COLORS.danger }}>Could not load products</p>
              <p style={{ fontSize: 13, color: '#991B1B', marginTop: 4 }}>{error}</p>
              <button onClick={load} style={{ marginTop: 10, padding: '8px 14px', background: COLORS.danger, color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!error && displayed.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 48 }}>
            <p style={{ fontSize: 52, marginBottom: 16 }}>🛒</p>
            <p style={{ fontSize: 18, fontWeight: 800, color: COLORS.gray700, marginBottom: 8 }}>
              {products.length === 0 ? 'No products yet' : 'No products match your filter'}
            </p>
            <p style={{ fontSize: 14, color: COLORS.gray400, marginBottom: 24 }}>
              {products.length === 0
                ? 'Add your first product to make it available in your store.'
                : 'Try a different category or show hidden products.'}
            </p>
            {products.length === 0 && (
              <button
                onClick={() => setShowForm(true)}
                style={{ background: BRAND, color: '#fff', borderRadius: 14, padding: '14px 28px', border: 'none', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}
              >
                + Add First Product
              </button>
            )}
          </div>
        )}

        {/* Product list */}
        {displayed.map(product => {
          const activeVariants = (product.variants ?? []).filter(v => v.isActive)
          return (
            <div
              key={product.id}
              style={{
                background: '#fff', borderRadius: 16,
                border: `1px solid ${product.isActive ? COLORS.gray100 : COLORS.gray200}`,
                marginBottom: 12, overflow: 'hidden',
                opacity: product.isActive ? 1 : 0.65,
              }}
            >
              {/* Product header */}
              <div style={{ padding: '14px 14px 10px', display: 'flex', gap: 12 }}>
                <div style={{ width: 52, height: 52, borderRadius: 12, background: '#FFF8E1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>
                  🍪
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: COLORS.gray900 }}>{product.name}</p>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                      background: product.isActive ? '#D1FAE5' : COLORS.gray100,
                      color: product.isActive ? '#065F46' : COLORS.gray400,
                    }}>
                      {product.isActive ? '● Active' : '○ Hidden'}
                    </span>
                  </div>
                  {product.category && (
                    <span style={{ fontSize: 11, background: '#EEF2FF', color: '#3730A3', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>
                      {product.category.name}
                    </span>
                  )}
                  {product.description && (
                    <p style={{ fontSize: 13, color: COLORS.gray500, marginTop: 4, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                      {product.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Variants summary */}
              <div style={{ padding: '8px 14px 10px', background: COLORS.gray50, borderTop: `1px solid ${COLORS.gray100}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: COLORS.gray400, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {activeVariants.length} size{activeVariants.length !== 1 ? 's' : ''} · {priceLabel(product)}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {activeVariants.length > 0 ? activeVariants.map(v => {
                    const p = retailPrice(v)
                    return (
                      <span key={v.id} style={{ background: '#fff', border: `1px solid ${COLORS.gray200}`, borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600, color: COLORS.gray700 }}>
                        {v.name}{p != null ? ` · R${p.toFixed(2)}` : ''}
                      </span>
                    )
                  }) : (
                    <span style={{ fontSize: 12, color: COLORS.gray400, fontStyle: 'italic' }}>
                      No sizes — tap Sizes to add
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', borderTop: `1px solid ${COLORS.gray100}` }}>
                {[
                  { label: '✏️ Edit',   color: BRAND,          action: () => setEditing(product) },
                  { label: '📦 Sizes',  color: COLORS.info,    action: () => setManagingVariants(product) },
                  { label: product.isActive ? '🙈 Hide' : '👁 Show',
                    color: product.isActive ? COLORS.danger : COLORS.success,
                    action: () => toggleActive(product) },
                ].map((btn, i) => (
                  <button
                    key={i}
                    onClick={btn.action}
                    style={{
                      flex: 1, padding: '11px 0', border: 'none', background: 'none',
                      fontSize: 13, fontWeight: 700, color: btn.color, cursor: 'pointer',
                      borderRight: i < 2 ? `1px solid ${COLORS.gray100}` : 'none',
                    }}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <AdminNavBar />

      {/* Modals */}
      {showForm && (
        <ProductForm
          categories={categories}
          onSave={handleCreate}
          onClose={() => setShowForm(false)}
          onCategoryCreated={cat => setCategories(cs => [...cs, cat].sort((a, b) => a.name.localeCompare(b.name)))}
        />
      )}

      {editing && (
        <ProductForm
          initial={editing}
          categories={categories}
          onSave={handleEdit}
          onClose={() => setEditing(null)}
          onCategoryCreated={cat => setCategories(cs => [...cs, cat].sort((a, b) => a.name.localeCompare(b.name)))}
        />
      )}

      {managingVariants && (
        <VariantManager
          product={managingVariants}
          onDone={async () => { setManagingVariants(null); await load() }}
        />
      )}
    </div>
  )
}
