import { useState, useEffect, useCallback } from 'react'
import { api } from '../../services/api'
import { BRAND, COLORS } from '../../lib/theme'
import AdminNavBar from '../../components/AdminNavBar'

interface Variant { id: string; name: string; isActive: boolean; prices: { tier: string; price: number }[] }
interface Product {
  id: string; name: string; description: string | null; isActive: boolean;
  category?: { id: string; name: string } | null
  variants: Variant[]
}
interface Category { id: string; name: string }

// ── Small helpers ─────────────────────────────────────────────────────────────

function retailPrice(v: Variant) {
  return v.prices.find(p => p.tier === 'RETAIL')?.price
}

function priceRange(product: Product) {
  const prices = product.variants
    .filter(v => v.isActive)
    .map(v => retailPrice(v))
    .filter(Boolean) as number[]
  if (!prices.length) return 'No price'
  const min = Math.min(...prices), max = Math.max(...prices)
  return min === max ? `R${min.toFixed(2)}` : `R${min.toFixed(2)} – R${max.toFixed(2)}`
}

// ── Product form ──────────────────────────────────────────────────────────────

interface FormVariant { name: string; price: string }
const emptyVariant = (): FormVariant => ({ name: '', price: '' })

function ProductForm({
  initial, categories, onSave, onClose,
}: {
  initial?: Product
  categories: Category[]
  onSave: (data: any) => Promise<void>
  onClose: () => void
}) {
  const [name, setName]           = useState(initial?.name ?? '')
  const [desc, setDesc]           = useState(initial?.description ?? '')
  const [categoryId, setCategoryId] = useState(initial?.category?.id ?? '')
  const [newCatName, setNewCatName] = useState('')
  const [showNewCat, setShowNewCat] = useState(false)
  const [variants, setVariants]   = useState<FormVariant[]>(
    initial?.variants.filter(v => v.isActive).map(v => ({
      name: v.name,
      price: String(retailPrice(v) ?? ''),
    })) ?? [emptyVariant()]
  )
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const addVariant = () => setVariants(vs => [...vs, emptyVariant()])
  const removeVariant = (i: number) => setVariants(vs => vs.filter((_, idx) => idx !== i))
  const setVariantField = (i: number, field: keyof FormVariant, val: string) =>
    setVariants(vs => vs.map((v, idx) => idx === i ? { ...v, [field]: val } : v))

  const handleSave = async () => {
    if (!name.trim()) { setError('Product name is required'); return }
    if (variants.some(v => !v.name.trim())) { setError('All sizes need a name'); return }
    if (variants.some(v => v.price && isNaN(Number(v.price)))) { setError('Prices must be numbers'); return }
    setSaving(true); setError('')
    try {
      await onSave({
        name: name.trim(),
        description: desc.trim() || undefined,
        categoryId: categoryId || undefined,
        variants: variants.filter(v => v.name.trim()).map(v => ({
          name: v.name.trim(),
          prices: v.price ? [{ tier: 'RETAIL', price: Number(v.price) }] : [],
        })),
      })
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return
    try {
      const cat = await api.productsAdmin.createCategory(newCatName.trim())
      setCategoryId(cat.id)
      setNewCatName('')
      setShowNewCat(false)
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Could not create category')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" style={{ maxHeight: '90vh', borderRadius: '20px 20px 0 0' }} onClick={e => e.stopPropagation()}>
        <p style={{ fontSize: 18, fontWeight: 800, color: COLORS.gray900, marginBottom: 20 }}>
          {initial ? 'Edit Product' : 'New Product'}
        </p>

        {error && <div style={{ background: '#FEE2E2', borderRadius: 10, padding: '10px 14px', color: COLORS.danger, fontSize: 14, marginBottom: 16 }}>{error}</div>}

        {/* Name */}
        <label className="form-label">Product Name *</label>
        <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rusks" style={{ marginBottom: 14 }} />

        {/* Description */}
        <label className="form-label">Description</label>
        <textarea
          style={{ width: '100%', border: `1px solid ${COLORS.gray200}`, borderRadius: 12, padding: '10px 14px', fontSize: 14, color: COLORS.gray900, resize: 'none', height: 72, fontFamily: 'inherit', outline: 'none', marginBottom: 14 }}
          value={desc} onChange={e => setDesc(e.target.value)}
          placeholder="Short description for customers…"
        />

        {/* Category */}
        <label className="form-label">Category</label>
        {!showNewCat ? (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              style={{ flex: 1, border: `1px solid ${COLORS.gray200}`, borderRadius: 12, padding: '10px 14px', fontSize: 14, color: COLORS.gray900, background: '#fff', outline: 'none' }}
            >
              <option value="">No category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button
              onClick={() => setShowNewCat(true)}
              style={{ padding: '10px 14px', borderRadius: 12, border: `1px solid ${COLORS.gray200}`, background: '#fff', fontSize: 13, fontWeight: 700, color: BRAND, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              + New
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input
              className="form-input"
              placeholder="Category name…"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateCategory()}
              autoFocus
              style={{ flex: 1 }}
            />
            <button onClick={handleCreateCategory} style={{ padding: '10px 14px', borderRadius: 12, background: BRAND, color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>Add</button>
            <button onClick={() => setShowNewCat(false)} style={{ padding: '10px 12px', borderRadius: 12, border: `1px solid ${COLORS.gray200}`, background: '#fff', cursor: 'pointer', fontSize: 13, color: COLORS.gray500 }}>✕</button>
          </div>
        )}

        {/* Variants / Sizes */}
        <label className="form-label">Sizes & Prices</label>
        {variants.map((v, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
            <input
              className="form-input"
              placeholder="Size name (e.g. 6 Pack)"
              value={v.name}
              onChange={e => setVariantField(i, 'name', e.target.value)}
              style={{ flex: 2 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', flex: 1, border: `1px solid ${COLORS.gray200}`, borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
              <span style={{ padding: '0 8px 0 12px', color: COLORS.gray500, fontSize: 14 }}>R</span>
              <input
                style={{ flex: 1, border: 'none', padding: '10px 8px', fontSize: 14, color: COLORS.gray900, outline: 'none' }}
                placeholder="0.00"
                value={v.price}
                onChange={e => setVariantField(i, 'price', e.target.value)}
                type="number"
                min="0"
                step="0.01"
              />
            </div>
            {variants.length > 1 && (
              <button onClick={() => removeVariant(i)} style={{ width: 34, height: 34, borderRadius: 17, background: COLORS.gray100, border: 'none', cursor: 'pointer', fontSize: 14, color: COLORS.gray500, flexShrink: 0 }}>✕</button>
            )}
          </div>
        ))}
        <button
          onClick={addVariant}
          style={{ width: '100%', padding: '10px', border: `1.5px dashed ${COLORS.gray200}`, borderRadius: 12, background: 'none', fontSize: 13, fontWeight: 700, color: COLORS.gray500, cursor: 'pointer', marginBottom: 24 }}
        >
          + Add another size
        </button>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 14, borderRadius: 14, border: `1px solid ${COLORS.gray200}`, background: '#fff', fontSize: 15, fontWeight: 600, color: COLORS.gray500, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: 14, borderRadius: 14, background: BRAND, border: 'none', fontSize: 15, fontWeight: 800, color: '#fff', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Product'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Variant manager panel (shown after product is created) ────────────────────

function VariantPanel({ product, onRefresh, onClose }: { product: Product; onRefresh: () => void; onClose: () => void }) {
  const [newName, setNewName]   = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [adding, setAdding]     = useState(false)

  const handleAdd = async () => {
    if (!newName.trim()) { alert('Enter a size name'); return }
    setAdding(true)
    try {
      await api.productsAdmin.addVariant(product.id, {
        name: newName.trim(),
        prices: newPrice ? [{ tier: 'RETAIL', price: Number(newPrice) }] : [],
      })
      setNewName(''); setNewPrice('')
      onRefresh()
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to add')
    } finally { setAdding(false) }
  }

  const handleRemove = async (vid: string) => {
    if (!window.confirm('Remove this size?')) return
    try {
      await api.productsAdmin.removeVariant(product.id, vid)
      onRefresh()
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to remove')
    }
  }

  const handlePriceBlur = async (vid: string, price: string) => {
    if (!price || isNaN(Number(price))) return
    try {
      await api.productsAdmin.updateVariantPrice(product.id, vid, { tier: 'RETAIL', price: Number(price) })
      onRefresh()
    } catch { /* silent */ }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" style={{ maxHeight: '85vh', borderRadius: '20px 20px 0 0' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p style={{ fontSize: 17, fontWeight: 800, color: COLORS.gray900 }}>Sizes — {product.name}</p>
          <button onClick={onClose} style={{ background: COLORS.gray100, border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontSize: 14, color: COLORS.gray500 }}>✕</button>
        </div>

        {/* Existing variants */}
        {product.variants.filter(v => v.isActive).map(v => {
          const p = retailPrice(v)
          return (
            <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <p style={{ flex: 2, fontSize: 14, fontWeight: 600, color: COLORS.gray900 }}>{v.name}</p>
              <div style={{ display: 'flex', alignItems: 'center', flex: 1, border: `1px solid ${COLORS.gray200}`, borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
                <span style={{ padding: '0 6px 0 10px', color: COLORS.gray500, fontSize: 13 }}>R</span>
                <input
                  style={{ flex: 1, border: 'none', padding: '8px 6px', fontSize: 14, color: COLORS.gray900, outline: 'none' }}
                  defaultValue={p != null ? String(p) : ''}
                  onBlur={e => handlePriceBlur(v.id, e.target.value)}
                  type="number" min="0" step="0.01"
                  placeholder="—"
                />
              </div>
              <button onClick={() => handleRemove(v.id)} style={{ width: 30, height: 30, borderRadius: 15, background: COLORS.gray100, border: 'none', cursor: 'pointer', fontSize: 12, color: COLORS.danger, flexShrink: 0 }}>✕</button>
            </div>
          )
        })}

        {/* Add new */}
        <p style={{ fontSize: 12, fontWeight: 700, color: COLORS.gray500, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 }}>Add Size</p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input className="form-input" placeholder="Size name" value={newName} onChange={e => setNewName(e.target.value)} style={{ flex: 2 }} />
          <div style={{ display: 'flex', alignItems: 'center', flex: 1, border: `1px solid ${COLORS.gray200}`, borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
            <span style={{ padding: '0 6px 0 12px', color: COLORS.gray500, fontSize: 14 }}>R</span>
            <input style={{ flex: 1, border: 'none', padding: '10px 6px', fontSize: 14, color: COLORS.gray900, outline: 'none' }} placeholder="0.00" value={newPrice} onChange={e => setNewPrice(e.target.value)} type="number" min="0" step="0.01" />
          </div>
          <button onClick={handleAdd} disabled={adding} style={{ padding: '10px 14px', borderRadius: 12, background: BRAND, border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13, flexShrink: 0, opacity: adding ? 0.7 : 1 }}>
            {adding ? '…' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const [products, setProducts]     = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading]       = useState(true)
  const [showAll, setShowAll]       = useState(false)
  const [search, setSearch]         = useState('')
  const [showForm, setShowForm]     = useState(false)
  const [editing, setEditing]       = useState<Product | null>(null)
  const [managingVariants, setManagingVariants] = useState<Product | null>(null)

  const load = useCallback(async () => {
    try {
      const [prods, cats] = await Promise.all([
        api.productsAdmin.list(),
        api.productsAdmin.listCategories(),
      ])
      setProducts(prods)
      setCategories(cats)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const displayed = products
    .filter(p => showAll ? true : p.isActive)
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
      description: data.description,
      categoryId: data.categoryId || null,
    })
    setEditing(null)
    await load()
  }

  const handleToggleActive = async (product: Product) => {
    const action = product.isActive ? 'hide from the store' : 'show in the store'
    if (!window.confirm(`${product.isActive ? 'Deactivate' : 'Activate'} "${product.name}"? This will ${action}.`)) return
    await api.productsAdmin.update(product.id, { isActive: !product.isActive })
    await load()
  }

  if (loading) return <div className="spinner-wrap" style={{ minHeight: '100vh' }}><div className="spinner" /></div>

  const activeCount = products.filter(p => p.isActive).length

  return (
    <div className="screen" style={{ background: COLORS.gray50 }}>
      {/* Header */}
      <div style={{ paddingTop: 52, paddingInline: 16, paddingBottom: 12, background: '#fff', borderBottom: `1px solid ${COLORS.gray100}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <p style={{ fontSize: 22, fontWeight: 900, color: COLORS.gray900 }}>Products</p>
            <p style={{ fontSize: 12, color: COLORS.gray400, marginTop: 2 }}>{activeCount} active · {products.length} total</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            style={{ background: BRAND, color: '#fff', borderRadius: 12, padding: '10px 16px', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            + New Product
          </button>
        </div>

        {/* Search + filter */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className="form-input"
            placeholder="Search products…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            onClick={() => setShowAll(s => !s)}
            style={{ padding: '9px 14px', borderRadius: 12, border: `1px solid ${COLORS.gray200}`, background: showAll ? BRAND : '#fff', color: showAll ? '#fff' : COLORS.gray600, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {showAll ? 'All' : 'Active'}
          </button>
        </div>
      </div>

      {/* List */}
      <div style={{ padding: 16, paddingBottom: 100 }}>
        {displayed.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 60, color: COLORS.gray400 }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>🛒</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: COLORS.gray700, marginBottom: 6 }}>No products yet</p>
            <p style={{ fontSize: 14 }}>Tap "New Product" to add your first item</p>
          </div>
        )}

        {displayed.map(product => (
          <div key={product.id} style={{ background: '#fff', borderRadius: 16, border: `1px solid ${COLORS.gray100}`, marginBottom: 12, overflow: 'hidden' }}>
            {/* Top row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', padding: '14px 14px 10px', gap: 12 }}>
              {/* Emoji placeholder */}
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#FFF0E6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>🍪</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: COLORS.gray900 }}>{product.name}</p>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                    background: product.isActive ? '#D1FAE5' : COLORS.gray100,
                    color: product.isActive ? '#065F46' : COLORS.gray500,
                  }}>
                    {product.isActive ? 'Active' : 'Hidden'}
                  </span>
                </div>
                {product.category && <p style={{ fontSize: 12, color: COLORS.gray400, marginTop: 2 }}>{product.category.name}</p>}
                {product.description && <p style={{ fontSize: 13, color: COLORS.gray500, marginTop: 4, lineHeight: 1.4 }}>{product.description}</p>}
              </div>
            </div>

            {/* Variants summary */}
            <div style={{ padding: '8px 14px', background: COLORS.gray50, borderTop: `1px solid ${COLORS.gray100}` }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {product.variants.filter(v => v.isActive).map(v => {
                  const p = retailPrice(v)
                  return (
                    <span key={v.id} style={{ background: '#fff', border: `1px solid ${COLORS.gray200}`, borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600, color: COLORS.gray700 }}>
                      {v.name}{p != null ? ` · R${p.toFixed(2)}` : ''}
                    </span>
                  )
                })}
                {product.variants.filter(v => v.isActive).length === 0 && (
                  <span style={{ fontSize: 12, color: COLORS.gray400 }}>No sizes added yet</span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', borderTop: `1px solid ${COLORS.gray100}` }}>
              <button onClick={() => setEditing(product)} style={{ flex: 1, padding: '12px', border: 'none', background: 'none', fontSize: 13, fontWeight: 700, color: BRAND, cursor: 'pointer', borderRight: `1px solid ${COLORS.gray100}` }}>
                ✏️ Edit
              </button>
              <button onClick={() => setManagingVariants(product)} style={{ flex: 1, padding: '12px', border: 'none', background: 'none', fontSize: 13, fontWeight: 700, color: COLORS.info, cursor: 'pointer', borderRight: `1px solid ${COLORS.gray100}` }}>
                📦 Sizes
              </button>
              <button onClick={() => handleToggleActive(product)} style={{ flex: 1, padding: '12px', border: 'none', background: 'none', fontSize: 13, fontWeight: 700, color: product.isActive ? COLORS.danger : COLORS.success, cursor: 'pointer' }}>
                {product.isActive ? '🙈 Hide' : '👁 Show'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <AdminNavBar />

      {/* Create form */}
      {showForm && (
        <ProductForm
          categories={categories}
          onSave={handleCreate}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Edit form */}
      {editing && (
        <ProductForm
          initial={editing}
          categories={categories}
          onSave={handleEdit}
          onClose={() => setEditing(null)}
        />
      )}

      {/* Variant manager */}
      {managingVariants && (
        <VariantPanel
          product={managingVariants}
          onRefresh={async () => {
            await load()
            // Keep panel open with fresh data
            const fresh = products.find(p => p.id === managingVariants.id)
            if (fresh) setManagingVariants(fresh)
          }}
          onClose={() => setManagingVariants(null)}
        />
      )}
    </div>
  )
}
