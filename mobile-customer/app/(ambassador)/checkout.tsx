import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  Alert, ActivityIndicator, Modal, Linking,
} from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCartStore } from '../../store/cart.store'
import { ordersApi, paymentsApi } from '../../services/api'
import AddressAutocomplete from '../../components/AddressAutocomplete'

type PaymentMethod = 'CASH' | 'EFT' | 'CARD'
type FulfillmentType = 'DELIVERY' | 'COLLECT'

interface LinkedCustomer {
  id: string
  firstName: string
  lastName: string
  phone: string | null
  email: string
}

interface SavedAddress {
  id: string
  label: string | null
  street: string
  suburb: string | null
  city: string
  province: string
  postalCode: string
  isDefault: boolean
}

interface EftDetails {
  bankName: string
  accountName: string
  accountNumber: string
  branchCode: string
  accountType: string
}

function formatAddress(a: SavedAddress): string {
  const parts = [a.street, a.suburb, a.city !== '—' ? a.city : null].filter(Boolean)
  return parts.join(', ')
}

export default function AmbassadorCheckout() {
  const insets = useSafeAreaInsets()
  const { items, notes, setNotes, removeItem, updateQuantity, getTotal, clearCart } = useCartStore()

  // ── Customer ────────────────────────────────────────────────────────────────
  const [linkedCustomers, setLinkedCustomers] = useState<LinkedCustomer[]>([])
  const [customersLoading, setCustomersLoading] = useState(true)
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<LinkedCustomer | null>(null)
  const [isNewCustomer, setIsNewCustomer] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')

  // ── Address ─────────────────────────────────────────────────────────────────
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('DELIVERY')
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([])
  const [addressesLoading, setAddressesLoading] = useState(false)
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [useNewAddress, setUseNewAddress] = useState(false)
  const [newAddressText, setNewAddressText] = useState('')

  // ── Payment ─────────────────────────────────────────────────────────────────
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [placing, setPlacing] = useState(false)

  // ── EFT modal ───────────────────────────────────────────────────────────────
  const [showEftModal, setShowEftModal] = useState(false)
  const [eftDetails, setEftDetails] = useState<EftDetails | null>(null)
  const [eftOrderRef, setEftOrderRef] = useState('')

  // ── Fetch linked customers ──────────────────────────────────────────────────
  const fetchLinkedCustomers = useCallback(async () => {
    try {
      const data = await ordersApi.getAmbassadorCustomers()
      setLinkedCustomers(data)
    } catch { /* non-fatal */ }
    finally { setCustomersLoading(false) }
  }, [])

  useEffect(() => { fetchLinkedCustomers() }, [fetchLinkedCustomers])

  // ── Fetch saved addresses when customer is selected ─────────────────────────
  const loadCustomerAddresses = useCallback(async (customerId: string) => {
    setAddressesLoading(true)
    setSavedAddresses([])
    setSelectedAddressId(null)
    setUseNewAddress(false)
    setNewAddressText('')
    try {
      const data: SavedAddress[] = await ordersApi.getCustomerAddresses(customerId)
      setSavedAddresses(data)
      // Auto-select default address if available
      const def = data.find(a => a.isDefault) ?? data[0]
      if (def) setSelectedAddressId(def.id)
      else setUseNewAddress(true)
    } catch { setUseNewAddress(true) }
    finally { setAddressesLoading(false) }
  }, [])

  const selectExistingCustomer = (c: LinkedCustomer) => {
    setSelectedCustomer(c)
    setIsNewCustomer(false)
    setFirstName(c.firstName)
    setLastName(c.lastName)
    setPhone(c.phone ?? '')
    setCustomerSearch('')
    setShowCustomerPicker(false)
    loadCustomerAddresses(c.id)
  }

  const switchToNewCustomer = () => {
    setSelectedCustomer(null)
    setIsNewCustomer(true)
    setFirstName('')
    setLastName('')
    setPhone('')
    setSavedAddresses([])
    setSelectedAddressId(null)
    setUseNewAddress(true)
    setNewAddressText('')
  }

  const filteredCustomers = linkedCustomers.filter((c) => {
    if (!customerSearch.trim()) return true
    const q = customerSearch.toLowerCase()
    return (
      c.firstName.toLowerCase().includes(q) ||
      c.lastName.toLowerCase().includes(q) ||
      (c.phone ?? '').includes(q)
    )
  })

  // ── Place order ─────────────────────────────────────────────────────────────
  const handlePlaceOrder = async () => {
    if (items.length === 0) return Alert.alert('Empty Cart', 'Add some items first!')

    const fName = isNewCustomer || !selectedCustomer ? firstName.trim() : selectedCustomer.firstName
    const lName = isNewCustomer || !selectedCustomer ? lastName.trim() : selectedCustomer.lastName
    const pNumber = isNewCustomer || !selectedCustomer ? phone.trim() : (selectedCustomer.phone ?? '')

    if (!fName) return Alert.alert('Missing Info', "Please enter the customer's first name")
    if (!lName) return Alert.alert('Missing Info', "Please enter the customer's last name")
    if (!pNumber) return Alert.alert('Missing Info', "Please enter the customer's contact number")

    if (fulfillmentType === 'DELIVERY') {
      if (!selectedAddressId && !newAddressText.trim()) {
        return Alert.alert('Delivery Address', 'Please select or enter a delivery address')
      }
    }

    setPlacing(true)
    try {
      const order = await ordersApi.createForCustomer({
        firstName: fName,
        lastName: lName,
        phone: pNumber,
        fulfillmentType,
        addressId: selectedAddressId ?? undefined,
        address: (!selectedAddressId && fulfillmentType === 'DELIVERY') ? newAddressText.trim() : undefined,
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        notes: notes.trim() || undefined,
        paymentMethod,
      })

      const orderRef = `TT-${order.id.slice(-8).toUpperCase()}`
      clearCart()

      if (paymentMethod === 'EFT') {
        try {
          const details = await paymentsApi.getEftDetails()
          setEftDetails(details)
        } catch {
          setEftDetails({ bankName: 'Standard Bank', accountName: 'Tlaka Treats (Pty) Ltd', accountNumber: '000 000 0000', branchCode: '051001', accountType: 'Current Account' })
        }
        setEftOrderRef(orderRef)
        setShowEftModal(true)
      } else if (paymentMethod === 'CARD') {
        try {
          const { paymentUrl } = await paymentsApi.initiatePayFast(order.id)
          await Linking.openURL(paymentUrl)
          Alert.alert('Payment Opened', `Complete payment in your browser. Ref: ${orderRef}`, [
            { text: 'Done', onPress: () => router.replace('/(ambassador)/orders' as any) },
          ])
        } catch {
          Alert.alert('Link Failed', `Order placed (${orderRef}) but payment link failed. Retry from orders.`, [
            { text: 'OK', onPress: () => router.replace('/(ambassador)/orders' as any) },
          ])
        }
      } else {
        Alert.alert('Order Placed! 🎉', `Order ${orderRef} for ${fName} ${lName}.\n${fulfillmentType === 'COLLECT' ? 'Customer will collect.' : 'Payment collected on delivery.'}`, [
          { text: 'View Orders', onPress: () => router.replace('/(ambassador)/orders' as any) },
        ])
      }
    } catch (err: any) {
      Alert.alert('Order Failed', err?.response?.data?.message || 'Something went wrong. Please try again.')
    } finally {
      setPlacing(false)
    }
  }

  const total = getTotal()
  const customerName = selectedCustomer && !isNewCustomer
    ? `${selectedCustomer.firstName} ${selectedCustomer.lastName}` : null

  const selectedAddress = savedAddresses.find(a => a.id === selectedAddressId)

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: (insets.top || 44) + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Place Order</Text>
        <View style={{ width: 40 }} />
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🛒</Text>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>Browse our treats and add them here</Text>
          <TouchableOpacity style={styles.shopBtn} onPress={() => router.replace('/(ambassador)/shop' as any)}>
            <Text style={styles.shopBtnText}>Browse Products</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* ── Customer ─────────────────────────────────────────────── */}
          <Text style={styles.sectionTitle}>Customer</Text>

          {!isNewCustomer && (
            <TouchableOpacity
              style={[styles.pickerBtn, selectedCustomer && styles.pickerBtnFilled]}
              onPress={() => { setCustomerSearch(''); setShowCustomerPicker(true) }}
            >
              <Text style={styles.pickerIcon}>👤</Text>
              <Text style={[styles.pickerValue, !selectedCustomer && styles.pickerPlaceholder]}>
                {customerName ?? (customersLoading ? 'Loading…' : 'Select existing customer…')}
              </Text>
              {selectedCustomer
                ? <TouchableOpacity onPress={() => { setSelectedCustomer(null); setSavedAddresses([]); setSelectedAddressId(null); setUseNewAddress(false) }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.clearBtn}>✕</Text>
                  </TouchableOpacity>
                : <Text style={styles.chevron}>▾</Text>
              }
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.toggleLink} onPress={() => isNewCustomer ? setIsNewCustomer(false) : switchToNewCustomer()}>
            <Text style={styles.toggleLinkText}>{isNewCustomer ? '← Select existing customer' : '+ New customer'}</Text>
          </TouchableOpacity>

          {isNewCustomer && (
            <>
              <View style={styles.row}>
                <TextInput style={[styles.textInput, { flex: 1, marginRight: 8 }]} placeholder="First name *" placeholderTextColor="#bbb" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
                <TextInput style={[styles.textInput, { flex: 1 }]} placeholder="Last name *" placeholderTextColor="#bbb" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
              </View>
              <TextInput style={styles.textInput} placeholder="Contact number *" placeholderTextColor="#bbb" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            </>
          )}

          {selectedCustomer && !isNewCustomer && (
            <View style={styles.customerCard}>
              <Text style={styles.customerCardName}>{selectedCustomer.firstName} {selectedCustomer.lastName}</Text>
              {selectedCustomer.phone && <Text style={styles.customerCardDetail}>📞 {selectedCustomer.phone}</Text>}
            </View>
          )}

          {/* ── Fulfillment type ─────────────────────────────────────── */}
          <Text style={styles.sectionTitle}>Order Type</Text>
          <View style={styles.fulfillmentRow}>
            <TouchableOpacity
              style={[styles.fulfillmentBtn, fulfillmentType === 'DELIVERY' && styles.fulfillmentBtnActive]}
              onPress={() => setFulfillmentType('DELIVERY')}
            >
              <Text style={styles.fulfillmentIcon}>🚚</Text>
              <Text style={[styles.fulfillmentLabel, fulfillmentType === 'DELIVERY' && styles.fulfillmentLabelActive]}>Delivery</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.fulfillmentBtn, fulfillmentType === 'COLLECT' && styles.fulfillmentBtnActive]}
              onPress={() => setFulfillmentType('COLLECT')}
            >
              <Text style={styles.fulfillmentIcon}>🏪</Text>
              <Text style={[styles.fulfillmentLabel, fulfillmentType === 'COLLECT' && styles.fulfillmentLabelActive]}>Collect</Text>
            </TouchableOpacity>
          </View>

          {/* ── Delivery address ─────────────────────────────────────── */}
          {fulfillmentType === 'DELIVERY' && (
            <>
              <Text style={styles.sectionTitle}>Delivery Address</Text>

              {addressesLoading && (
                <View style={styles.addressLoading}>
                  <ActivityIndicator color="#8B3A3A" size="small" />
                  <Text style={styles.addressLoadingText}>Loading saved addresses…</Text>
                </View>
              )}

              {!addressesLoading && savedAddresses.length > 0 && (
                <>
                  {savedAddresses.map((addr) => (
                    <TouchableOpacity
                      key={addr.id}
                      style={[styles.addressCard, selectedAddressId === addr.id && !useNewAddress && styles.addressCardSelected]}
                      onPress={() => { setSelectedAddressId(addr.id); setUseNewAddress(false) }}
                      activeOpacity={0.8}
                    >
                      <View style={styles.addressCardLeft}>
                        <Text style={styles.addressPin}>📍</Text>
                        <View style={{ flex: 1 }}>
                          {addr.label && <Text style={styles.addressLabel}>{addr.label}</Text>}
                          <Text style={styles.addressText}>{formatAddress(addr)}</Text>
                          {addr.isDefault && <Text style={styles.defaultBadge}>Default</Text>}
                        </View>
                      </View>
                      <View style={[styles.radioOuter, selectedAddressId === addr.id && !useNewAddress && styles.radioOuterActive]}>
                        {selectedAddressId === addr.id && !useNewAddress && <View style={styles.radioInner} />}
                      </View>
                    </TouchableOpacity>
                  ))}

                  {/* Different address option */}
                  <TouchableOpacity
                    style={[styles.addressCard, useNewAddress && styles.addressCardSelected]}
                    onPress={() => { setUseNewAddress(true); setSelectedAddressId(null) }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.addressCardLeft}>
                      <Text style={styles.addressPin}>✏️</Text>
                      <Text style={[styles.addressText, { fontWeight: '600' }]}>Different address…</Text>
                    </View>
                    <View style={[styles.radioOuter, useNewAddress && styles.radioOuterActive]}>
                      {useNewAddress && <View style={styles.radioInner} />}
                    </View>
                  </TouchableOpacity>
                </>
              )}

              {/* New address input */}
              {(!addressesLoading && (savedAddresses.length === 0 || useNewAddress)) && (
                <AddressAutocomplete
                  value={newAddressText}
                  onChange={setNewAddressText}
                  placeholder="e.g. 12 Rose Street, Soweto, 1804"
                />
              )}
            </>
          )}

          {fulfillmentType === 'COLLECT' && (
            <View style={styles.collectNote}>
              <Text style={styles.collectNoteText}>🏪 Customer will collect from your location. No delivery address needed.</Text>
            </View>
          )}

          {/* ── Items ────────────────────────────────────────────────── */}
          <Text style={styles.sectionTitle}>Items ({items.length})</Text>
          {items.map((item) => (
            <View key={item.variantId} style={styles.cartItem}>
              <View style={styles.cartItemEmoji}><Text style={{ fontSize: 26 }}>🍪</Text></View>
              <View style={styles.cartItemInfo}>
                <Text style={styles.cartItemName}>{item.productName}</Text>
                <Text style={styles.cartItemVariant}>{item.variantName}</Text>
                <Text style={styles.cartItemPrice}>R{item.price.toFixed(2)} each</Text>
              </View>
              <View style={styles.cartItemControls}>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.variantId, item.quantity - 1)}>
                  <Text style={styles.qtyBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.qtyValue}>{item.quantity}</Text>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQuantity(item.variantId, item.quantity + 1)}>
                  <Text style={styles.qtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => removeItem(item.variantId)} style={styles.removeBtn}>
                <Text style={styles.removeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* ── Payment method ───────────────────────────────────────── */}
          <Text style={styles.sectionTitle}>Payment Method</Text>
          {([
            { key: 'CASH', label: 'Cash on Delivery', icon: '💵', desc: 'Payment collected when order arrives' },
            { key: 'EFT',  label: 'EFT / Bank Transfer', icon: '🏦', desc: "Bank details shared after order is placed" },
            { key: 'CARD', label: 'Debit / Credit Card', icon: '💳', desc: 'Secure online payment via PayFast' },
          ] as { key: PaymentMethod; label: string; icon: string; desc: string }[]).map((pm) => (
            <TouchableOpacity
              key={pm.key}
              style={[styles.paymentOption, paymentMethod === pm.key && styles.paymentOptionActive]}
              onPress={() => setPaymentMethod(pm.key)}
              activeOpacity={0.8}
            >
              <View style={styles.paymentOptionLeft}>
                <Text style={styles.paymentOptionIcon}>{pm.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.paymentOptionLabel, paymentMethod === pm.key && styles.paymentOptionLabelActive]}>{pm.label}</Text>
                  <Text style={styles.paymentOptionDesc}>{pm.desc}</Text>
                </View>
              </View>
              <View style={[styles.radioOuter, paymentMethod === pm.key && styles.radioOuterActive]}>
                {paymentMethod === pm.key && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          ))}

          {/* ── Notes ───────────────────────────────────────────────── */}
          <Text style={styles.sectionTitle}>Special Instructions (optional)</Text>
          <TextInput style={[styles.textInput, { height: 72 }]} placeholder="e.g. No nuts, extra packaging..." placeholderTextColor="#bbb" value={notes} onChangeText={setNotes} multiline />

          {/* ── Summary ──────────────────────────────────────────────── */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Order Summary</Text>
            <Text style={styles.ambassadorNote}>✓ Ambassador pricing — commission earned on confirmation</Text>
            {items.map((item) => (
              <View key={item.variantId} style={styles.summaryRow}>
                <Text style={styles.summaryItemName}>{item.productName} × {item.quantity}</Text>
                <Text style={styles.summaryItemPrice}>R{(item.price * item.quantity).toFixed(2)}</Text>
              </View>
            ))}
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryTotal}>Total</Text>
              <Text style={styles.summaryTotalPrice}>R{total.toFixed(2)}</Text>
            </View>
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>
      )}

      {items.length > 0 && (
        <View style={[styles.bottomBar, { paddingBottom: (insets.bottom || 16) + 8 }]}>
          <TouchableOpacity
            style={[styles.placeOrderBtn, placing && styles.placeOrderBtnDisabled]}
            onPress={handlePlaceOrder}
            disabled={placing}
          >
            {placing
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.placeOrderText}>
                  {paymentMethod === 'CARD' ? '🔒 Pay via PayFast · ' : 'Place Order · '}R{total.toFixed(2)}
                </Text>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* ── Customer Picker Modal ─────────────────────────────────── */}
      <Modal visible={showCustomerPicker} animationType="slide" transparent>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCustomerPicker(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select Customer</Text>
            <TextInput style={styles.modalSearch} placeholder="Search by name or phone…" placeholderTextColor="#bbb" value={customerSearch} onChangeText={setCustomerSearch} autoFocus />
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 340 }}>
              {filteredCustomers.length === 0 ? (
                <Text style={styles.modalEmpty}>{linkedCustomers.length === 0 ? 'No previous customers — orders you place will appear here' : 'No results'}</Text>
              ) : (
                filteredCustomers.map((c) => (
                  <TouchableOpacity key={c.id} style={styles.customerRow} onPress={() => selectExistingCustomer(c)}>
                    <View style={styles.customerInitial}>
                      <Text style={styles.customerInitialText}>{c.firstName[0].toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.customerRowName}>{c.firstName} {c.lastName}</Text>
                      {c.phone && <Text style={styles.customerRowPhone}>{c.phone}</Text>}
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowCustomerPicker(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── EFT Modal ─────────────────────────────────────────────── */}
      <Modal visible={showEftModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.eftTitle}>🏦 EFT Payment Details</Text>
            <Text style={styles.eftSubtitle}>Share these banking details with your customer</Text>
            {eftDetails && (
              <View style={styles.eftDetailsCard}>
                {[
                  { label: 'Bank',           value: eftDetails.bankName },
                  { label: 'Account Name',   value: eftDetails.accountName },
                  { label: 'Account Number', value: eftDetails.accountNumber },
                  { label: 'Branch Code',    value: eftDetails.branchCode },
                  { label: 'Account Type',   value: eftDetails.accountType },
                ].map(({ label, value }) => (
                  <View key={label} style={styles.eftRow}>
                    <Text style={styles.eftLabel}>{label}</Text>
                    <Text style={styles.eftValue}>{value}</Text>
                  </View>
                ))}
                <View style={[styles.eftRow, { borderBottomWidth: 0, marginTop: 4 }]}>
                  <Text style={styles.eftLabel}>Reference</Text>
                  <Text style={[styles.eftValue, styles.eftRef]}>{eftOrderRef}</Text>
                </View>
              </View>
            )}
            <Text style={styles.eftNote}>
              ⚠️ Customer must use <Text style={{ fontWeight: '800' }}>{eftOrderRef}</Text> as the payment reference
            </Text>
            <TouchableOpacity style={styles.eftDoneBtn} onPress={() => { setShowEftModal(false); router.replace('/(ambassador)/orders' as any) }}>
              <Text style={styles.eftDoneText}>Done — View Orders</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF6F0' },
  header: { backgroundColor: '#8B3A3A', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16 },
  backBtn: { padding: 8, marginRight: 8 },
  backIcon: { fontSize: 22, color: '#fff' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#fff', textAlign: 'center' },
  scrollContent: { padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 10, marginTop: 14 },
  row: { flexDirection: 'row' },

  pickerBtn: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e8d5d5', padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 },
  pickerBtnFilled: { borderColor: '#8B3A3A' },
  pickerIcon: { fontSize: 18 },
  pickerValue: { flex: 1, fontSize: 15, color: '#1a1a1a', fontWeight: '600' },
  pickerPlaceholder: { color: '#bbb', fontWeight: '400' },
  clearBtn: { fontSize: 14, color: '#bbb', paddingLeft: 8 },
  chevron: { fontSize: 16, color: '#999' },
  toggleLink: { marginBottom: 12 },
  toggleLinkText: { fontSize: 13, color: '#8B3A3A', fontWeight: '600' },
  customerCard: { backgroundColor: '#FFF0E6', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#f5d0d0' },
  customerCardName: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  customerCardDetail: { fontSize: 13, color: '#666', marginTop: 3 },

  textInput: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e8d5d5', padding: 14, fontSize: 15, color: '#1a1a1a', marginBottom: 12 },

  // Fulfillment toggle
  fulfillmentRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  fulfillmentBtn: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1.5, borderColor: '#e8d5d5', gap: 6 },
  fulfillmentBtnActive: { borderColor: '#8B3A3A', backgroundColor: '#FFF8F5' },
  fulfillmentIcon: { fontSize: 26 },
  fulfillmentLabel: { fontSize: 14, fontWeight: '700', color: '#999' },
  fulfillmentLabelActive: { color: '#8B3A3A' },

  // Address cards
  addressLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  addressLoadingText: { fontSize: 13, color: '#999' },
  addressCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: '#e8d5d5' },
  addressCardSelected: { borderColor: '#8B3A3A', backgroundColor: '#FFF8F5' },
  addressCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  addressPin: { fontSize: 18 },
  addressLabel: { fontSize: 12, fontWeight: '700', color: '#8B3A3A', marginBottom: 2 },
  addressText: { fontSize: 14, color: '#333', lineHeight: 20 },
  defaultBadge: { fontSize: 11, color: '#10B981', fontWeight: '700', marginTop: 3 },

  collectNote: { backgroundColor: '#FFF0E6', borderRadius: 14, padding: 16, marginBottom: 4, borderWidth: 1, borderColor: '#f5d0d0' },
  collectNoteText: { fontSize: 13, color: '#666', lineHeight: 20 },

  // Cart items
  cartItem: { backgroundColor: '#fff', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  cartItemEmoji: { width: 46, height: 46, backgroundColor: '#FFF0E6', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  cartItemInfo: { flex: 1 },
  cartItemName: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },
  cartItemVariant: { fontSize: 11, color: '#999', marginTop: 1 },
  cartItemPrice: { fontSize: 12, color: '#8B3A3A', fontWeight: '600', marginTop: 2 },
  cartItemControls: { flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 6 },
  qtyBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#f0e8e8', justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { fontSize: 15, color: '#8B3A3A', fontWeight: '700', lineHeight: 18 },
  qtyValue: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', minWidth: 18, textAlign: 'center' },
  removeBtn: { padding: 4 },
  removeBtnText: { fontSize: 13, color: '#ccc' },

  // Payment method
  paymentOption: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: '#e8d5d5' },
  paymentOptionActive: { borderColor: '#8B3A3A', backgroundColor: '#FFF8F5' },
  paymentOptionLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  paymentOptionIcon: { fontSize: 24 },
  paymentOptionLabel: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  paymentOptionLabelActive: { color: '#8B3A3A' },
  paymentOptionDesc: { fontSize: 11, color: '#aaa', marginTop: 2 },

  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#ccc', justifyContent: 'center', alignItems: 'center' },
  radioOuterActive: { borderColor: '#8B3A3A' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#8B3A3A' },

  summaryCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1, marginTop: 4 },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  ambassadorNote: { fontSize: 12, color: '#10B981', fontWeight: '600', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryItemName: { fontSize: 13, color: '#555', flex: 1 },
  summaryItemPrice: { fontSize: 13, color: '#1a1a1a', fontWeight: '600' },
  summaryDivider: { height: 1, backgroundColor: '#f0e0e0', marginVertical: 10 },
  summaryTotal: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  summaryTotalPrice: { fontSize: 17, fontWeight: '800', color: '#8B3A3A' },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#999', textAlign: 'center', marginBottom: 24 },
  shopBtn: { backgroundColor: '#8B3A3A', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14 },
  shopBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  bottomBar: { backgroundColor: '#fff', padding: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f0e0e0', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 8 },
  placeOrderBtn: { backgroundColor: '#8B3A3A', borderRadius: 14, padding: 16, alignItems: 'center' },
  placeOrderBtnDisabled: { opacity: 0.6 },
  placeOrderText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a', textAlign: 'center', marginBottom: 12 },
  modalSearch: { backgroundColor: '#f5f0eb', borderRadius: 10, padding: 12, fontSize: 15, color: '#1a1a1a', marginBottom: 10 },
  modalEmpty: { textAlign: 'center', color: '#999', paddingVertical: 24, fontSize: 13 },
  modalCancelBtn: { alignItems: 'center', paddingTop: 16 },
  modalCancelText: { fontSize: 15, color: '#999', fontWeight: '600' },

  customerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f0eb', gap: 12 },
  customerInitial: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF0E6', justifyContent: 'center', alignItems: 'center' },
  customerInitialText: { fontSize: 16, fontWeight: '700', color: '#8B3A3A' },
  customerRowName: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  customerRowPhone: { fontSize: 12, color: '#999', marginTop: 2 },

  eftTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', textAlign: 'center', marginBottom: 4 },
  eftSubtitle: { fontSize: 13, color: '#999', textAlign: 'center', marginBottom: 16 },
  eftDetailsCard: { backgroundColor: '#FDF6F0', borderRadius: 14, padding: 16, marginBottom: 16 },
  eftRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0e8e8' },
  eftLabel: { fontSize: 13, color: '#999', flex: 1 },
  eftValue: { fontSize: 13, fontWeight: '700', color: '#1a1a1a', textAlign: 'right', flex: 1 },
  eftRef: { color: '#8B3A3A', fontSize: 15 },
  eftNote: { fontSize: 12, color: '#666', textAlign: 'center', marginBottom: 20, lineHeight: 18 },
  eftDoneBtn: { backgroundColor: '#8B3A3A', borderRadius: 14, padding: 16, alignItems: 'center' },
  eftDoneText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
