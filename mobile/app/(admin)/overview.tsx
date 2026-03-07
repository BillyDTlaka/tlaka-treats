import { useEffect, useState, useMemo } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, Alert, FlatList,
} from 'react-native'
import { ordersApi, ambassadorsApi, customersApi, productsApi, authApi } from '../../services/api'
import { useAuthStore } from '../../store/auth.store'

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#F59E0B',
  CONFIRMED: '#3B82F6',
  BAKING: '#8B5CF6',
  READY: '#10B981',
  DELIVERED: '#6B7280',
  CANCELLED: '#EF4444',
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

type FilterPreset = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM_MONTH'
type CartItem = { variantId: string; productName: string; variantName: string; unitPrice: number; quantity: number }

function getDateRange(preset: FilterPreset, selectedMonth: number, selectedYear: number) {
  const now = new Date()
  switch (preset) {
    case 'TODAY': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const end = new Date(start); end.setDate(end.getDate() + 1)
      return { start, end }
    }
    case 'WEEK': {
      const start = new Date(now)
      const dayOfWeek = start.getDay()
      start.setDate(start.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
      start.setHours(0, 0, 0, 0)
      const end = new Date(start); end.setDate(end.getDate() + 7)
      return { start, end }
    }
    case 'MONTH': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      return { start, end }
    }
    case 'CUSTOM_MONTH': {
      const start = new Date(selectedYear, selectedMonth, 1)
      const end = new Date(selectedYear, selectedMonth + 1, 1)
      return { start, end }
    }
    default: return null
  }
}

export default function AdminOverview() {
  const { user, logout } = useAuthStore()
  const [orders, setOrders] = useState<any[]>([])
  const [ambassadors, setAmbassadors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Date filter
  const [activeFilter, setActiveFilter] = useState<FilterPreset>('ALL')
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  // ── Place Order Flow ────────────────────────────────────────────────────────
  const [showOrderFlow, setShowOrderFlow] = useState(false)
  const [orderStep, setOrderStep] = useState(1)
  const [flowLoading, setFlowLoading] = useState(false)

  // Step 1 – customer
  const [customers, setCustomers] = useState<any[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [custSearch, setCustSearch] = useState('')
  const [showCreateCust, setShowCreateCust] = useState(false)
  const [newCust, setNewCust] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '' })
  const [creatingCust, setCreatingCust] = useState(false)

  // Step 2 – cart
  const [flowProducts, setFlowProducts] = useState<any[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [prodSearch, setProdSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  // Step 3 – review
  const [ambassadorCode, setAmbassadorCode] = useState('')
  const [orderNotes, setOrderNotes] = useState('')
  const [showAmbPicker, setShowAmbPicker] = useState(false)
  const [ambSearch, setAmbSearch] = useState('')
  const [placingOrder, setPlacingOrder] = useState(false)

  // ── Data loading ────────────────────────────────────────────────────────────
  const load = () => {
    Promise.all([ordersApi.getAll(), ambassadorsApi.getAll()])
      .then(([ords, ambs]) => { setOrders(ords); setAmbassadors(ambs) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  // ── Filtered orders ─────────────────────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    const range = getDateRange(activeFilter, selectedMonth, selectedYear)
    if (!range) return orders
    return orders.filter(o => {
      const d = new Date(o.createdAt)
      return d >= range.start && d < range.end
    })
  }, [orders, activeFilter, selectedMonth, selectedYear])

  const revenue = filteredOrders.reduce((s, o) => s + Number(o.total), 0)
  const pendingCount = filteredOrders.filter(o => o.status === 'PENDING').length
  const activeAmbassadors = ambassadors.filter(a => a.status === 'ACTIVE').length

  const customMonthLabel = activeFilter === 'CUSTOM_MONTH'
    ? `${MONTH_NAMES[selectedMonth].slice(0, 3)} ${selectedYear}`
    : 'Month'

  // ── Cart helpers ────────────────────────────────────────────────────────────
  const cartTotal = () => cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const cartCount = () => cart.reduce((s, i) => s + i.quantity, 0)
  const getCartQty = (variantId: string) => cart.find(i => i.variantId === variantId)?.quantity ?? 0

  const addToCart = (variantId: string, productName: string, variantName: string, unitPrice: number) => {
    setCart(prev => {
      const ex = prev.find(i => i.variantId === variantId)
      if (ex) return prev.map(i => i.variantId === variantId ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { variantId, productName, variantName, unitPrice, quantity: 1 }]
    })
  }

  const decFromCart = (variantId: string) => {
    setCart(prev => {
      const ex = prev.find(i => i.variantId === variantId)
      if (!ex) return prev
      if (ex.quantity === 1) return prev.filter(i => i.variantId !== variantId)
      return prev.map(i => i.variantId === variantId ? { ...i, quantity: i.quantity - 1 } : i)
    })
  }

  // ── Open flow ───────────────────────────────────────────────────────────────
  const openOrderFlow = async () => {
    setOrderStep(1)
    setSelectedCustomer(null)
    setCart([])
    setCustSearch('')
    setProdSearch('')
    setActiveCategory(null)
    setAmbassadorCode('')
    setOrderNotes('')
    setShowCreateCust(false)
    setNewCust({ firstName: '', lastName: '', email: '', phone: '', password: '' })
    setShowOrderFlow(true)
    setFlowLoading(true)
    try {
      const [custs, prods] = await Promise.all([customersApi.getAll(), productsApi.getAllAdmin()])
      setCustomers(custs)
      setFlowProducts(prods)
    } catch {
      Alert.alert('Error', 'Failed to load customers or products')
      setShowOrderFlow(false)
    } finally {
      setFlowLoading(false)
    }
  }

  // ── Memos for flow ──────────────────────────────────────────────────────────
  const categories = useMemo(() => {
    const m = new Map<string, any>()
    flowProducts.forEach(p => { if (p.category) m.set(p.category.id, p.category) })
    return [...m.values()]
  }, [flowProducts])

  const filteredCustomers = useMemo(() => {
    const q = custSearch.toLowerCase().trim()
    const list = q
      ? customers.filter(c => {
          const name = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase()
          return name.includes(q) || (c.email || '').toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q)
        })
      : customers.slice().sort((a, b) => `${a.firstName}${a.lastName}`.localeCompare(`${b.firstName}${b.lastName}`))
    return list.slice(0, 40)
  }, [customers, custSearch])

  const filteredProducts = useMemo(() => {
    const q = prodSearch.toLowerCase().trim()
    return flowProducts.filter(p => {
      if (!p.isActive) return false
      if (q && !p.name.toLowerCase().includes(q)) return false
      if (activeCategory && p.categoryId !== activeCategory) return false
      return (p.variants || []).some((v: any) => v.isActive !== false)
    })
  }, [flowProducts, prodSearch, activeCategory])

  const activeAmbs = useMemo(() => {
    const q = ambSearch.toLowerCase().trim()
    return ambassadors.filter(a =>
      a.status === 'ACTIVE' && (!q || (a.code || '').toLowerCase().includes(q))
    )
  }, [ambassadors, ambSearch])

  // ── Create customer ─────────────────────────────────────────────────────────
  const handleCreateCustomer = async () => {
    if (!newCust.firstName || !newCust.lastName || !newCust.email || !newCust.password) {
      return Alert.alert('Missing Fields', 'First name, last name, email and password are required')
    }
    setCreatingCust(true)
    try {
      const { user: created } = await authApi.register(newCust)
      setCustomers(prev => [...prev, created])
      setSelectedCustomer(created)
      setShowCreateCust(false)
      setNewCust({ firstName: '', lastName: '', email: '', phone: '', password: '' })
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'Failed to create customer')
    } finally {
      setCreatingCust(false)
    }
  }

  // ── Place order ─────────────────────────────────────────────────────────────
  const handlePlaceOrder = async () => {
    if (!selectedCustomer || !cart.length) return
    setPlacingOrder(true)
    try {
      await ordersApi.createAdmin({
        customerId: selectedCustomer.id,
        items: cart.map(i => ({ variantId: i.variantId, quantity: i.quantity })),
        ...(ambassadorCode.trim() ? { ambassadorCode: ambassadorCode.trim() } : {}),
        ...(orderNotes.trim() ? { notes: orderNotes.trim() } : {}),
      })
      Alert.alert('Order Placed! 🎉', `Order created for ${selectedCustomer.firstName} ${selectedCustomer.lastName}`)
      setShowOrderFlow(false)
      load()
    } catch (err: any) {
      Alert.alert('Failed', err?.response?.data?.message || 'Something went wrong')
    } finally {
      setPlacingOrder(false)
    }
  }

  const updateOrderStatus = async (id: string, status: string) => {
    await ordersApi.updateStatus(id, status)
    load()
  }

  if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#8B3A3A" />

  return (
    <ScrollView style={styles.container}>
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Admin 🛠️</Text>
        <Text style={styles.subtitle}>Tlaka Treats Operations</Text>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* ─── Date Filter Pills ──────────────────────────────────────────── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {(['ALL', 'TODAY', 'WEEK', 'MONTH'] as FilterPreset[]).map((preset) => {
          const labels: Record<string, string> = { ALL: 'All Time', TODAY: 'Today', WEEK: 'This Week', MONTH: 'This Month' }
          const isActive = activeFilter === preset
          return (
            <TouchableOpacity
              key={preset}
              style={[styles.filterPill, isActive && styles.filterPillActive]}
              onPress={() => setActiveFilter(preset)}
            >
              <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{labels[preset]}</Text>
            </TouchableOpacity>
          )
        })}
        <TouchableOpacity
          style={[styles.filterPill, activeFilter === 'CUSTOM_MONTH' && styles.filterPillActive]}
          onPress={() => setShowMonthPicker(true)}
        >
          <Text style={[styles.filterText, activeFilter === 'CUSTOM_MONTH' && styles.filterTextActive]}>
            {customMonthLabel} ▾
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ─── Stats ──────────────────────────────────────────────────────── */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>R{revenue.toFixed(0)}</Text>
          <Text style={styles.statLabel}>Revenue</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{filteredOrders.length}</Text>
          <Text style={styles.statLabel}>Orders</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{activeAmbassadors}</Text>
          <Text style={styles.statLabel}>Ambassadors</Text>
        </View>
      </View>

      {/* ─── Place Order Card ────────────────────────────────────────────── */}
      <TouchableOpacity style={styles.placeOrderCard} onPress={openOrderFlow}>
        <Text style={styles.placeOrderCardIcon}>🛒</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.placeOrderCardTitle}>Place Order for Client</Text>
          <Text style={styles.placeOrderCardSub}>Browse products & order on behalf of a customer</Text>
        </View>
        <Text style={styles.placeOrderCardArrow}>→</Text>
      </TouchableOpacity>

      {/* ─── Orders ─────────────────────────────────────────────────────── */}
      <Text style={styles.sectionTitle}>
        {activeFilter === 'ALL' ? 'Recent Orders' : `Orders (${filteredOrders.length})`}
      </Text>
      {filteredOrders.length === 0 && (
        <View style={styles.emptyState}><Text style={styles.emptyText}>No orders for this period</Text></View>
      )}
      {(activeFilter === 'ALL' ? filteredOrders.slice(0, 10) : filteredOrders).map((order) => (
        <View key={order.id} style={styles.orderCard}>
          <View style={styles.orderRow}>
            <Text style={styles.customerName}>{order.customer?.firstName} {order.customer?.lastName}</Text>
            <Text style={styles.orderAmount}>R{Number(order.total).toFixed(2)}</Text>
          </View>
          <Text style={styles.orderDate}>
            {new Date(order.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
          {order.ambassador && <Text style={styles.ambassador}>via {order.ambassador.code}</Text>}
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[order.status] || '#999' }]}>
            <Text style={styles.statusText}>{order.status}</Text>
          </View>
          {order.status === 'PENDING' && (
            <TouchableOpacity style={styles.confirmBtn} onPress={() => updateOrderStatus(order.id, 'CONFIRMED')}>
              <Text style={styles.confirmBtnText}>✓ Confirm Order</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}

      <View style={{ height: 40 }} />

      {/* ─── Month Picker Modal ─────────────────────────────────────────── */}
      <Modal visible={showMonthPicker} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMonthPicker(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Month</Text>
            <View style={styles.yearRow}>
              <TouchableOpacity onPress={() => setSelectedYear(y => y - 1)}>
                <Text style={styles.yearArrow}>◀</Text>
              </TouchableOpacity>
              <Text style={styles.yearText}>{selectedYear}</Text>
              <TouchableOpacity onPress={() => setSelectedYear(y => y + 1)}>
                <Text style={styles.yearArrow}>▶</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.monthGrid}>
              {MONTH_NAMES.map((name, idx) => {
                const isSelected = activeFilter === 'CUSTOM_MONTH' && selectedMonth === idx
                return (
                  <TouchableOpacity
                    key={name}
                    style={[styles.monthCell, isSelected && styles.monthCellActive]}
                    onPress={() => { setSelectedMonth(idx); setActiveFilter('CUSTOM_MONTH'); setShowMonthPicker(false) }}
                  >
                    <Text style={[styles.monthCellText, isSelected && styles.monthCellTextActive]}>
                      {name.slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowMonthPicker(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Place Order Flow Modal ─────────────────────────────────────── */}
      <Modal visible={showOrderFlow} animationType="slide">
        <View style={styles.flowContainer}>
          {/* Flow header */}
          <View style={styles.flowHeader}>
            <TouchableOpacity
              style={styles.flowBackBtn}
              onPress={() => orderStep === 1 ? setShowOrderFlow(false) : setOrderStep(s => s - 1)}
            >
              <Text style={styles.flowBackText}>{orderStep === 1 ? '✕' : '←'}</Text>
            </TouchableOpacity>
            <Text style={styles.flowTitle}>Place Order for Client</Text>
            <View style={styles.flowStepBar}>
              {[1, 2, 3].map(s => (
                <View key={s} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={[styles.flowStepDot, orderStep >= s && styles.flowStepDotActive]}>
                    <Text style={[styles.flowStepNum, orderStep >= s && styles.flowStepNumActive]}>
                      {orderStep > s ? '✓' : s}
                    </Text>
                  </View>
                  {s < 3 && <View style={styles.flowStepLine} />}
                </View>
              ))}
            </View>
          </View>

          {flowLoading ? (
            <ActivityIndicator style={{ flex: 1 }} color="#8B3A3A" />
          ) : (
            <>
              {/* ── STEP 1: Customer ────────────────────────────────────── */}
              {orderStep === 1 && (
                <View style={{ flex: 1 }}>
                  {selectedCustomer && (
                    <View style={styles.selectedCustomerBanner}>
                      <Text style={styles.selectedCustomerText}>
                        ✓ {selectedCustomer.firstName} {selectedCustomer.lastName}
                      </Text>
                      <TouchableOpacity onPress={() => setSelectedCustomer(null)}>
                        <Text style={styles.selectedCustomerClear}>✕ Change</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  <TextInput
                    style={styles.flowSearch}
                    placeholder="🔍  Search by name, email or phone…"
                    placeholderTextColor="#bbb"
                    value={custSearch}
                    onChangeText={setCustSearch}
                  />
                  <FlatList
                    data={filteredCustomers}
                    keyExtractor={item => item.id}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item: c }) => {
                      const name = `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unknown'
                      const isSelected = selectedCustomer?.id === c.id
                      return (
                        <TouchableOpacity
                          style={[styles.custRow, isSelected && styles.custRowSelected]}
                          onPress={() => setSelectedCustomer(isSelected ? null : c)}
                        >
                          <View style={[styles.custAvatar, isSelected && styles.custAvatarSelected]}>
                            <Text style={[styles.custAvatarText, isSelected && { color: '#fff' }]}>
                              {((c.firstName?.[0] || '') + (c.lastName?.[0] || '')).toUpperCase() || '?'}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.custName}>{name}</Text>
                            {c.email ? <Text style={styles.custEmail}>{c.email}</Text> : null}
                          </View>
                          {isSelected && <Text style={styles.custCheck}>✓</Text>}
                        </TouchableOpacity>
                      )
                    }}
                    ListFooterComponent={
                      <View>
                        <TouchableOpacity
                          style={styles.createCustToggle}
                          onPress={() => setShowCreateCust(v => !v)}
                        >
                          <Text style={styles.createCustToggleText}>
                            {showCreateCust ? '− Cancel' : '+ Create New Customer'}
                          </Text>
                        </TouchableOpacity>
                        {showCreateCust && (
                          <View style={styles.createCustForm}>
                            <Text style={styles.createCustLabel}>NEW CUSTOMER</Text>
                            <View style={styles.createCustRow}>
                              <TextInput
                                style={[styles.createCustInput, { flex: 1, marginRight: 6 }]}
                                placeholder="First Name *"
                                placeholderTextColor="#bbb"
                                value={newCust.firstName}
                                onChangeText={v => setNewCust(p => ({ ...p, firstName: v }))}
                              />
                              <TextInput
                                style={[styles.createCustInput, { flex: 1 }]}
                                placeholder="Last Name *"
                                placeholderTextColor="#bbb"
                                value={newCust.lastName}
                                onChangeText={v => setNewCust(p => ({ ...p, lastName: v }))}
                              />
                            </View>
                            <TextInput
                              style={styles.createCustInput}
                              placeholder="Email *"
                              placeholderTextColor="#bbb"
                              value={newCust.email}
                              onChangeText={v => setNewCust(p => ({ ...p, email: v }))}
                              keyboardType="email-address"
                              autoCapitalize="none"
                            />
                            <TextInput
                              style={styles.createCustInput}
                              placeholder="Phone (optional)"
                              placeholderTextColor="#bbb"
                              value={newCust.phone}
                              onChangeText={v => setNewCust(p => ({ ...p, phone: v }))}
                              keyboardType="phone-pad"
                            />
                            <TextInput
                              style={styles.createCustInput}
                              placeholder="Password *"
                              placeholderTextColor="#bbb"
                              value={newCust.password}
                              onChangeText={v => setNewCust(p => ({ ...p, password: v }))}
                              secureTextEntry
                            />
                            <TouchableOpacity
                              style={[styles.createCustBtn, creatingCust && { opacity: 0.6 }]}
                              onPress={handleCreateCustomer}
                              disabled={creatingCust}
                            >
                              {creatingCust
                                ? <ActivityIndicator color="#fff" />
                                : <Text style={styles.createCustBtnText}>Create Customer</Text>
                              }
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    }
                  />
                  <View style={styles.flowFooter}>
                    <TouchableOpacity
                      style={[styles.flowNextBtn, !selectedCustomer && styles.flowNextBtnDisabled]}
                      disabled={!selectedCustomer}
                      onPress={() => setOrderStep(2)}
                    >
                      <Text style={styles.flowNextBtnText}>Next: Build Order →</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ── STEP 2: Build Cart ──────────────────────────────────── */}
              {orderStep === 2 && (
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={styles.flowSearch}
                    placeholder="🔍  Search products…"
                    placeholderTextColor="#bbb"
                    value={prodSearch}
                    onChangeText={setProdSearch}
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catRow}>
                    {[{ id: null, name: 'All' }, ...categories].map(cat => (
                      <TouchableOpacity
                        key={cat.id || 'all'}
                        style={[styles.catChip, activeCategory === cat.id && styles.catChipActive]}
                        onPress={() => setActiveCategory(cat.id)}
                      >
                        <Text style={[styles.catChipText, activeCategory === cat.id && styles.catChipTextActive]}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
                    {filteredProducts.length === 0 && (
                      <Text style={styles.emptyText2}>No products found</Text>
                    )}
                    {filteredProducts.map(p => (
                      <View key={p.id} style={styles.productCard}>
                        <Text style={styles.productName}>{p.name}</Text>
                        {(p.variants || []).filter((v: any) => v.isActive !== false).map((v: any) => {
                          const price = Number(
                            v.prices?.find((px: any) => px.tier === 'RETAIL')?.price
                            ?? v.prices?.[0]?.price
                            ?? v.retailPrice
                            ?? 0
                          )
                          const qty = getCartQty(v.id)
                          return (
                            <View key={v.id} style={styles.variantRow}>
                              <View style={{ flex: 1 }}>
                                {v.name ? <Text style={styles.variantName}>{v.name}</Text> : null}
                                <Text style={styles.variantPrice}>R{price.toFixed(2)}</Text>
                              </View>
                              {qty > 0 ? (
                                <View style={styles.qtyControls}>
                                  <TouchableOpacity style={styles.qtyBtn} onPress={() => decFromCart(v.id)}>
                                    <Text style={styles.qtyBtnText}>−</Text>
                                  </TouchableOpacity>
                                  <Text style={styles.qtyVal}>{qty}</Text>
                                  <TouchableOpacity style={styles.qtyBtn} onPress={() => addToCart(v.id, p.name, v.name || '', price)}>
                                    <Text style={styles.qtyBtnText}>+</Text>
                                  </TouchableOpacity>
                                </View>
                              ) : (
                                <TouchableOpacity style={styles.addBtn} onPress={() => addToCart(v.id, p.name, v.name || '', price)}>
                                  <Text style={styles.addBtnText}>+ Add</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          )
                        })}
                      </View>
                    ))}
                    <View style={{ height: 100 }} />
                  </ScrollView>
                  <View style={styles.flowFooter}>
                    {cart.length > 0 && (
                      <Text style={styles.cartSummary}>
                        {cartCount()} item{cartCount() !== 1 ? 's' : ''} · R{cartTotal().toFixed(2)}
                      </Text>
                    )}
                    <TouchableOpacity
                      style={[styles.flowNextBtn, !cart.length && styles.flowNextBtnDisabled]}
                      disabled={!cart.length}
                      onPress={() => setOrderStep(3)}
                    >
                      <Text style={styles.flowNextBtnText}>
                        {cart.length ? `Review Order →` : 'Add items to continue'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ── STEP 3: Review & Place ──────────────────────────────── */}
              {orderStep === 3 && (
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
                  {/* Customer */}
                  <View style={styles.reviewChip}>
                    <Text style={styles.reviewChipLabel}>👤 Placing for</Text>
                    <Text style={styles.reviewChipValue}>
                      {selectedCustomer?.firstName} {selectedCustomer?.lastName}
                    </Text>
                    {selectedCustomer?.email
                      ? <Text style={styles.reviewChipSub}>{selectedCustomer.email}</Text>
                      : null
                    }
                  </View>

                  {/* Items */}
                  <View style={styles.reviewCard}>
                    <Text style={styles.reviewCardTitle}>🛒 Order Items</Text>
                    {cart.map(item => (
                      <View key={item.variantId} style={styles.reviewItem}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.reviewItemName}>{item.quantity}× {item.productName}</Text>
                          {item.variantName ? <Text style={styles.reviewItemVariant}>{item.variantName}</Text> : null}
                        </View>
                        <Text style={styles.reviewItemTotal}>R{(item.unitPrice * item.quantity).toFixed(2)}</Text>
                      </View>
                    ))}
                    <View style={styles.reviewDivider} />
                    <View style={styles.reviewItem}>
                      <Text style={styles.reviewTotalLabel}>Total</Text>
                      <Text style={styles.reviewTotalValue}>R{cartTotal().toFixed(2)}</Text>
                    </View>
                  </View>

                  {/* Ambassador Code — searchable picker */}
                  <Text style={styles.reviewFieldLabel}>Ambassador Code (optional)</Text>
                  <TouchableOpacity
                    style={styles.pickerBtn}
                    onPress={() => { setAmbSearch(''); setShowAmbPicker(true) }}
                  >
                    <Text style={ambassadorCode ? styles.pickerBtnValue : styles.pickerBtnPlaceholder}>
                      {ambassadorCode || 'Select ambassador code…'}
                    </Text>
                    {ambassadorCode ? (
                      <TouchableOpacity onPress={() => setAmbassadorCode('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Text style={styles.pickerClear}>✕</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.pickerChevron}>▾</Text>
                    )}
                  </TouchableOpacity>

                  {/* Notes */}
                  <Text style={styles.reviewFieldLabel}>Notes (optional)</Text>
                  <TextInput
                    style={styles.notesInput}
                    placeholder="Special instructions, allergies, delivery notes…"
                    placeholderTextColor="#bbb"
                    value={orderNotes}
                    onChangeText={setOrderNotes}
                    multiline
                  />

                  <View style={{ height: 100 }} />
                </ScrollView>
              )}
              {orderStep === 3 && (
                <View style={styles.flowFooter}>
                  <TouchableOpacity
                    style={[styles.flowNextBtn, placingOrder && { opacity: 0.6 }]}
                    onPress={handlePlaceOrder}
                    disabled={placingOrder}
                  >
                    {placingOrder
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.flowNextBtnText}>Place Order · R{cartTotal().toFixed(2)}</Text>
                    }
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>

        {/* Ambassador Picker sub-modal */}
        <Modal visible={showAmbPicker} animationType="slide" transparent>
          <TouchableOpacity style={styles.ambOverlay} activeOpacity={1} onPress={() => setShowAmbPicker(false)}>
            <View style={styles.ambSheet}>
              <Text style={styles.ambTitle}>Select Ambassador</Text>
              <TextInput
                style={styles.ambSearch}
                placeholder="Search by code…"
                placeholderTextColor="#bbb"
                value={ambSearch}
                onChangeText={setAmbSearch}
                autoCapitalize="characters"
                autoFocus
              />
              <ScrollView keyboardShouldPersistTaps="handled">
                {activeAmbs.length === 0 ? (
                  <Text style={styles.ambEmpty}>
                    {ambassadors.filter(a => a.status === 'ACTIVE').length === 0
                      ? 'No active ambassadors'
                      : 'No results'}
                  </Text>
                ) : (
                  activeAmbs.map(a => (
                    <TouchableOpacity
                      key={a.id}
                      style={styles.ambItem}
                      onPress={() => { setAmbassadorCode(a.code); setAmbSearch(''); setShowAmbPicker(false) }}
                    >
                      <Text style={styles.ambItemCode}>{a.code}</Text>
                      {a.user && <Text style={styles.ambItemName}>{a.user.firstName} {a.user.lastName}</Text>}
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
              <TouchableOpacity style={styles.ambCancel} onPress={() => setShowAmbPicker(false)}>
                <Text style={styles.ambCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF6F0' },
  header: { backgroundColor: '#1a1a1a', padding: 24, paddingTop: 60 },
  greeting: { fontSize: 22, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 14, color: '#999', marginTop: 2 },
  logoutBtn: { position: 'absolute', top: 60, right: 24, backgroundColor: '#333', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  logoutText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  filterRow: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, gap: 8 },
  filterPill: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e0d5cf' },
  filterPillActive: { backgroundColor: '#8B3A3A', borderColor: '#8B3A3A' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#666' },
  filterTextActive: { color: '#fff' },

  statsRow: { flexDirection: 'row', padding: 16, gap: 8, flexWrap: 'wrap' },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1, marginBottom: 8 },
  statValue: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  statLabel: { fontSize: 11, color: '#999', marginTop: 4 },

  // Place Order card
  placeOrderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B3A3A',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  placeOrderCardIcon: { fontSize: 28 },
  placeOrderCardTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  placeOrderCardSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  placeOrderCardArrow: { fontSize: 20, color: '#fff', fontWeight: '700' },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', paddingHorizontal: 16, marginBottom: 10 },
  orderCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 10, borderRadius: 12, padding: 14 },
  orderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  customerName: { fontWeight: '600', color: '#1a1a1a', fontSize: 15 },
  orderAmount: { fontWeight: '700', color: '#1a1a1a', fontSize: 15 },
  orderDate: { fontSize: 12, color: '#999', marginBottom: 4 },
  ambassador: { fontSize: 12, color: '#8B3A3A', marginBottom: 8 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  confirmBtn: { marginTop: 10, backgroundColor: '#8B3A3A', borderRadius: 8, padding: 10, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  emptyState: { alignItems: 'center', padding: 30, marginHorizontal: 16 },
  emptyText: { fontSize: 14, color: '#999' },

  // Month picker
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', textAlign: 'center', marginBottom: 16 },
  yearRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 24, marginBottom: 20 },
  yearArrow: { fontSize: 18, color: '#8B3A3A', paddingHorizontal: 12 },
  yearText: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  monthCell: { width: '28%', paddingVertical: 12, backgroundColor: '#f5f0eb', borderRadius: 10, alignItems: 'center' },
  monthCellActive: { backgroundColor: '#8B3A3A' },
  monthCellText: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  monthCellTextActive: { color: '#fff' },
  modalClose: { marginTop: 20, alignItems: 'center', padding: 12 },
  modalCloseText: { fontSize: 15, color: '#999', fontWeight: '600' },

  // ── Place Order Flow ────────────────────────────────────────────────────────
  flowContainer: { flex: 1, backgroundColor: '#FDF6F0', paddingTop: 50 },
  flowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0e0e0',
    gap: 10,
  },
  flowBackBtn: { padding: 4 },
  flowBackText: { fontSize: 22, color: '#8B3A3A', fontWeight: '700' },
  flowTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  flowStepBar: { flexDirection: 'row', alignItems: 'center' },
  flowStepDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#e0d5cf', justifyContent: 'center', alignItems: 'center' },
  flowStepDotActive: { backgroundColor: '#8B3A3A' },
  flowStepNum: { fontSize: 11, fontWeight: '700', color: '#999' },
  flowStepNumActive: { color: '#fff' },
  flowStepLine: { width: 12, height: 2, backgroundColor: '#e0d5cf', marginHorizontal: 2 },

  flowSearch: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0e0e0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1a1a1a',
  },

  // Customer list
  selectedCustomerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#a7f3d0',
  },
  selectedCustomerText: { fontSize: 14, fontWeight: '700', color: '#065f46' },
  selectedCustomerClear: { fontSize: 12, color: '#065f46', fontWeight: '600' },

  custRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f0eb', gap: 12 },
  custRowSelected: { backgroundColor: '#fff7f0' },
  custAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f0e8e8', justifyContent: 'center', alignItems: 'center' },
  custAvatarSelected: { backgroundColor: '#8B3A3A' },
  custAvatarText: { fontSize: 13, fontWeight: '700', color: '#8B3A3A' },
  custName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  custEmail: { fontSize: 12, color: '#999', marginTop: 1 },
  custCheck: { fontSize: 16, color: '#10B981', fontWeight: '700' },

  createCustToggle: { paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#f0e0e0' },
  createCustToggleText: { fontSize: 14, fontWeight: '700', color: '#8B3A3A' },
  createCustForm: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  createCustLabel: { fontSize: 11, fontWeight: '700', color: '#999', letterSpacing: 1, marginBottom: 4 },
  createCustRow: { flexDirection: 'row' },
  createCustInput: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e8d5d5', padding: 12, fontSize: 14, color: '#1a1a1a', marginBottom: 8 },
  createCustBtn: { backgroundColor: '#8B3A3A', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 4 },
  createCustBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Category chips
  catRow: { paddingHorizontal: 12, paddingVertical: 10, maxHeight: 52 },
  catChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#e0d5cf', marginRight: 8, backgroundColor: '#fff' },
  catChipActive: { backgroundColor: '#8B3A3A', borderColor: '#8B3A3A' },
  catChipText: { fontSize: 13, fontWeight: '600', color: '#666' },
  catChipTextActive: { color: '#fff' },

  // Product cards
  emptyText2: { textAlign: 'center', color: '#999', paddingVertical: 40, fontSize: 14 },
  productCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 10, borderRadius: 12, padding: 14 },
  productName: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  variantRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#f5f0eb' },
  variantName: { fontSize: 13, color: '#555', marginBottom: 2 },
  variantPrice: { fontSize: 14, fontWeight: '700', color: '#8B3A3A' },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f0e8e8', justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { fontSize: 16, color: '#8B3A3A', fontWeight: '700', lineHeight: 20 },
  qtyVal: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', minWidth: 20, textAlign: 'center' },
  addBtn: { backgroundColor: '#8B3A3A', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Flow footer
  flowFooter: { backgroundColor: '#fff', padding: 16, borderTopWidth: 1, borderTopColor: '#f0e0e0' },
  cartSummary: { textAlign: 'center', fontSize: 13, color: '#666', fontWeight: '600', marginBottom: 8 },
  flowNextBtn: { backgroundColor: '#8B3A3A', borderRadius: 12, padding: 16, alignItems: 'center' },
  flowNextBtnDisabled: { opacity: 0.4 },
  flowNextBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Review step
  reviewChip: { backgroundColor: '#d1fae5', borderRadius: 12, padding: 14, marginBottom: 12 },
  reviewChipLabel: { fontSize: 11, color: '#065f46', fontWeight: '700', marginBottom: 4 },
  reviewChipValue: { fontSize: 15, fontWeight: '700', color: '#065f46' },
  reviewChipSub: { fontSize: 12, color: '#059669', marginTop: 2 },
  reviewCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  reviewCardTitle: { fontSize: 13, fontWeight: '700', color: '#999', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  reviewItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  reviewItemName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  reviewItemVariant: { fontSize: 12, color: '#999', marginTop: 1 },
  reviewItemTotal: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginLeft: 8 },
  reviewDivider: { height: 1, backgroundColor: '#f0e0e0', marginVertical: 8 },
  reviewTotalLabel: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  reviewTotalValue: { fontSize: 17, fontWeight: '800', color: '#8B3A3A' },
  reviewFieldLabel: { fontSize: 13, fontWeight: '700', color: '#555', marginBottom: 8, marginTop: 4 },
  notesInput: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e8d5d5', padding: 14, fontSize: 14, color: '#1a1a1a', marginBottom: 12, height: 90, textAlignVertical: 'top' },

  // Picker (ambassador dropdown)
  pickerBtn: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e8d5d5', padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  pickerBtnValue: { flex: 1, fontSize: 15, color: '#8B3A3A', fontWeight: '600' },
  pickerBtnPlaceholder: { flex: 1, fontSize: 15, color: '#bbb' },
  pickerClear: { fontSize: 14, color: '#bbb', paddingLeft: 8 },
  pickerChevron: { fontSize: 16, color: '#999' },

  // Ambassador picker modal
  ambOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  ambSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '65%' },
  ambTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a', textAlign: 'center', marginBottom: 14 },
  ambSearch: { backgroundColor: '#f5f0eb', borderRadius: 10, padding: 12, fontSize: 15, color: '#1a1a1a', marginBottom: 12 },
  ambEmpty: { textAlign: 'center', color: '#999', paddingVertical: 24, fontSize: 14 },
  ambItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f5f0eb' },
  ambItemCode: { fontSize: 16, fontWeight: '700', color: '#8B3A3A' },
  ambItemName: { fontSize: 13, color: '#999' },
  ambCancel: { alignItems: 'center', paddingTop: 16 },
  ambCancelText: { fontSize: 15, color: '#999', fontWeight: '600' },
})
