import { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { productsApi } from '../../../services/api'
import { useCartStore } from '../../../store/cart.store'

export default function AmbassadorProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedVariant, setSelectedVariant] = useState<any>(null)
  const [quantity, setQuantity] = useState(1)
  const addItem = useCartStore((s) => s.addItem)
  const cartCount = useCartStore((s) => s.getItemCount())

  useEffect(() => {
    productsApi.getById(id).then((p) => {
      setProduct(p)
      if (p.variants?.length > 0) setSelectedVariant(p.variants[0])
    }).finally(() => setLoading(false))
  }, [id])

  const getAmbassadorPrice = (variant: any) => {
    const price = variant?.prices?.find((p: any) => p.tier === 'AMBASSADOR')
      ?? variant?.prices?.find((p: any) => p.tier === 'RETAIL')
      ?? variant?.prices?.[0]
    return price ? Number(price.price) : null
  }

  const handleAddToCart = () => {
    if (!selectedVariant) return Alert.alert('Select a size', 'Please choose a size first')
    const price = getAmbassadorPrice(selectedVariant)
    if (!price) return Alert.alert('Unavailable', 'No price available for this option')

    addItem({
      productId: product.id,
      variantId: selectedVariant.id,
      quantity,
      productName: product.name,
      variantName: selectedVariant.name,
      price,
    })
    setQuantity(1)
    Alert.alert('Added! 🛍️', `${quantity}× ${product.name} added to your cart`, [
      { text: 'Keep Shopping', onPress: () => router.back() },
      { text: 'View Cart', onPress: () => router.push('/(ambassador)/checkout' as any) },
    ])
  }

  if (loading) return <View style={styles.loading}><ActivityIndicator color="#8B3A3A" size="large" /></View>
  if (!product) return <View style={styles.loading}><Text style={styles.errorText}>Product not found</Text></View>

  const price = selectedVariant ? getAmbassadorPrice(selectedVariant) : null

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: (insets.top || 44) + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Product Details</Text>
        <TouchableOpacity onPress={() => router.push('/(ambassador)/checkout' as any)} style={styles.cartBtn}>
          <Text style={styles.cartIcon}>🛍️</Text>
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartCount > 9 ? '9+' : cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.imageContainer}>
          <Text style={styles.productEmoji}>🍪</Text>
          {product.category?.name && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{product.category.name}</Text>
            </View>
          )}
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.productName}>{product.name}</Text>
          {product.description && <Text style={styles.description}>{product.description}</Text>}
          {price && (
            <View>
              <Text style={styles.price}>R{price.toFixed(2)}</Text>
              <Text style={styles.pricingBadge}>✓ Ambassador rate applied</Text>
            </View>
          )}
        </View>

        {product.variants?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Choose Size</Text>
            <View style={styles.variantRow}>
              {product.variants.map((variant: any) => {
                const vPrice = getAmbassadorPrice(variant)
                const isSelected = selectedVariant?.id === variant.id
                return (
                  <TouchableOpacity
                    key={variant.id}
                    style={[styles.variantChip, isSelected && styles.variantChipSelected]}
                    onPress={() => setSelectedVariant(variant)}
                  >
                    <Text style={[styles.variantName, isSelected && styles.variantNameSelected]}>{variant.name}</Text>
                    {vPrice && (
                      <Text style={[styles.variantPrice, isSelected && styles.variantPriceSelected]}>
                        R{vPrice.toFixed(2)}
                      </Text>
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quantity</Text>
          <View style={styles.quantityRow}>
            <TouchableOpacity style={styles.quantityBtn} onPress={() => setQuantity((q) => Math.max(1, q - 1))}>
              <Text style={styles.quantityBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.quantityValue}>{quantity}</Text>
            <TouchableOpacity style={styles.quantityBtn} onPress={() => setQuantity((q) => q + 1)}>
              <Text style={styles.quantityBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: (insets.bottom || 16) + 8 }]}>
        {price && <Text style={styles.totalText}>Total: R{(price * quantity).toFixed(2)}</Text>}
        <TouchableOpacity style={styles.addToCartBtn} onPress={handleAddToCart}>
          <Text style={styles.addToCartText}>Add to Cart 🛍️</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF6F0' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF6F0' },
  errorText: { fontSize: 16, color: '#999' },
  header: { backgroundColor: '#8B3A3A', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16 },
  backBtn: { padding: 8, marginRight: 8 },
  backIcon: { fontSize: 22, color: '#fff' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: '#fff' },
  cartBtn: { padding: 8, position: 'relative' },
  cartIcon: { fontSize: 22 },
  cartBadge: { position: 'absolute', top: 2, right: 2, backgroundColor: '#fff', borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  cartBadgeText: { color: '#8B3A3A', fontSize: 9, fontWeight: '800' },
  scrollContent: { paddingBottom: 20 },
  imageContainer: { backgroundColor: '#FFF0E6', height: 220, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  productEmoji: { fontSize: 80 },
  categoryBadge: { position: 'absolute', bottom: 12, left: 16, backgroundColor: '#8B3A3A', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  categoryBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  infoSection: { padding: 20 },
  productName: { fontSize: 24, fontWeight: '800', color: '#1a1a1a', marginBottom: 8 },
  description: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 12 },
  price: { fontSize: 26, fontWeight: '800', color: '#8B3A3A' },
  pricingBadge: { fontSize: 12, color: '#10B981', fontWeight: '600', marginTop: 4 },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  variantRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  variantChip: { borderWidth: 2, borderColor: '#e0c8c8', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff' },
  variantChipSelected: { borderColor: '#8B3A3A', backgroundColor: '#8B3A3A' },
  variantName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  variantNameSelected: { color: '#fff' },
  variantPrice: { fontSize: 13, color: '#8B3A3A', marginTop: 2, fontWeight: '600' },
  variantPriceSelected: { color: '#f5d0d0' },
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  quantityBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#8B3A3A', justifyContent: 'center', alignItems: 'center' },
  quantityBtnText: { fontSize: 22, color: '#fff', fontWeight: '700', lineHeight: 26 },
  quantityValue: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', minWidth: 32, textAlign: 'center' },
  bottomBar: { backgroundColor: '#fff', padding: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f0e0e0', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 8 },
  totalText: { fontSize: 14, color: '#666', marginBottom: 10, textAlign: 'center' },
  addToCartBtn: { backgroundColor: '#8B3A3A', borderRadius: 14, padding: 16, alignItems: 'center' },
  addToCartText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
