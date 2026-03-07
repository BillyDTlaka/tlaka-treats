import { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  Alert, ActivityIndicator, Modal,
} from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useCartStore } from '../../store/cart.store'
import { useAuthStore } from '../../store/auth.store'
import { ordersApi, ambassadorsApi } from '../../services/api'
import AddressAutocomplete from '../../components/AddressAutocomplete'

export default function AmbassadorCheckout() {
  const insets = useSafeAreaInsets()
  const { user } = useAuthStore()
  const {
    items, ambassadorCode, notes,
    setAmbassadorCode, setNotes, removeItem, updateQuantity, getTotal, clearCart,
  } = useCartStore()

  const [placing, setPlacing] = useState(false)
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [ambassadors, setAmbassadors] = useState<any[]>([])
  const [showAmbPicker, setShowAmbPicker] = useState(false)
  const [ambSearch, setAmbSearch] = useState('')

  useEffect(() => {
    ambassadorsApi.getAll()
      .then(list => setAmbassadors(list.filter((a: any) => a.status === 'ACTIVE')))
      .catch(() => {})
  }, [])

  const filteredAmbs = ambassadors.filter(a =>
    !ambSearch.trim() || a.code?.toLowerCase().includes(ambSearch.toLowerCase())
  )

  const handlePlaceOrder = async () => {
    if (items.length === 0) return Alert.alert('Empty Cart', 'Add some items first!')
    if (!deliveryAddress.trim()) return Alert.alert('Delivery Address', 'Please enter your delivery address')

    setPlacing(true)
    try {
      await ordersApi.create({
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        ambassadorCode: ambassadorCode.trim() || undefined,
        notes: `Delivery: ${deliveryAddress.trim()}${notes.trim() ? ` | ${notes.trim()}` : ''}`,
      })
      clearCart()
      Alert.alert(
        'Order Placed! 🎉',
        "We've received your order and will start preparing it shortly.",
        [{ text: 'View My Orders', onPress: () => router.replace('/(ambassador)/orders' as any) }]
      )
    } catch (err: any) {
      Alert.alert('Order Failed', err?.response?.data?.message || 'Something went wrong. Please try again.')
    } finally {
      setPlacing(false)
    }
  }

  const total = getTotal()

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: (insets.top || 44) + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Cart</Text>
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
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.sectionTitle}>Items ({items.length})</Text>
          {items.map((item) => (
            <View key={item.variantId} style={styles.cartItem}>
              <View style={styles.cartItemEmoji}>
                <Text style={{ fontSize: 28 }}>🍪</Text>
              </View>
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

          <Text style={styles.sectionTitle}>Delivery Address *</Text>
          <AddressAutocomplete
            value={deliveryAddress}
            onChange={setDeliveryAddress}
            placeholder="e.g. 12 Rose Street, Soweto, 1804"
          />

          {/* Ambassador Code */}
          <Text style={styles.sectionTitle}>Ambassador Code (optional)</Text>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => { setAmbSearch(''); setShowAmbPicker(true) }}>
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

          <Text style={styles.sectionTitle}>Special Instructions (optional)</Text>
          <TextInput
            style={[styles.textInput, { height: 80 }]}
            placeholder="e.g. No nuts, extra packaging..."
            placeholderTextColor="#bbb"
            value={notes}
            onChangeText={setNotes}
            multiline
          />

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Order Summary</Text>
            <Text style={styles.ambassadorNote}>✓ Ambassador pricing applied</Text>
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
            <Text style={styles.summaryNote}>💳 Payment collected on delivery</Text>
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
            {placing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.placeOrderText}>Place Order · R{total.toFixed(2)}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Ambassador Picker Modal */}
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
              {filteredAmbs.length === 0 ? (
                <Text style={styles.ambEmpty}>{ambassadors.length === 0 ? 'No active ambassadors' : 'No results'}</Text>
              ) : (
                filteredAmbs.map(a => (
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
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 10, marginTop: 8 },
  cartItem: { backgroundColor: '#fff', borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  cartItemEmoji: { width: 52, height: 52, backgroundColor: '#FFF0E6', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  cartItemInfo: { flex: 1 },
  cartItemName: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  cartItemVariant: { fontSize: 12, color: '#999', marginTop: 1 },
  cartItemPrice: { fontSize: 13, color: '#8B3A3A', fontWeight: '600', marginTop: 2 },
  cartItemControls: { flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 8 },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#f0e8e8', justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { fontSize: 16, color: '#8B3A3A', fontWeight: '700', lineHeight: 20 },
  qtyValue: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', minWidth: 20, textAlign: 'center' },
  removeBtn: { padding: 4 },
  removeBtnText: { fontSize: 14, color: '#ccc' },
  textInput: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e8d5d5', padding: 14, fontSize: 15, color: '#1a1a1a', marginBottom: 16 },
  summaryCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1, marginTop: 8 },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 6 },
  ambassadorNote: { fontSize: 12, color: '#10B981', fontWeight: '600', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryItemName: { fontSize: 13, color: '#555', flex: 1 },
  summaryItemPrice: { fontSize: 13, color: '#1a1a1a', fontWeight: '600' },
  summaryDivider: { height: 1, backgroundColor: '#f0e0e0', marginVertical: 10 },
  summaryTotal: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  summaryTotalPrice: { fontSize: 17, fontWeight: '800', color: '#8B3A3A' },
  summaryNote: { fontSize: 12, color: '#999', marginTop: 10, textAlign: 'center' },
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
  // Ambassador picker
  pickerBtn: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e8d5d5', padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  pickerBtnValue: { flex: 1, fontSize: 15, color: '#8B3A3A', fontWeight: '600' },
  pickerBtnPlaceholder: { flex: 1, fontSize: 15, color: '#bbb' },
  pickerClear: { fontSize: 14, color: '#bbb', paddingLeft: 8 },
  pickerChevron: { fontSize: 16, color: '#999' },
  ambOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  ambSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '70%' },
  ambTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a', textAlign: 'center', marginBottom: 14 },
  ambSearch: { backgroundColor: '#f5f0eb', borderRadius: 10, padding: 12, fontSize: 15, color: '#1a1a1a', marginBottom: 12 },
  ambEmpty: { textAlign: 'center', color: '#999', paddingVertical: 24, fontSize: 14 },
  ambItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f5f0eb' },
  ambItemCode: { fontSize: 16, fontWeight: '700', color: '#8B3A3A' },
  ambItemName: { fontSize: 13, color: '#999' },
  ambCancel: { alignItems: 'center', paddingTop: 16 },
  ambCancelText: { fontSize: 15, color: '#999', fontWeight: '600' },
})
