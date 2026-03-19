import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, TextInput, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInventory } from '../../lib/hooks';
import { api } from '../../lib/api';
import { Card } from '../../components/Card';
import { COLORS, BRAND } from '../../lib/theme';

export default function StockScreen() {
  const { data: items = [], isLoading, refetch, isRefetching } = useInventory();
  const [search, setSearch]     = useState('');
  const [adjustItem, setAdjustItem] = useState<any>(null);
  const [adjustQty, setAdjustQty]   = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [saving, setSaving]         = useState(false);

  const filtered = items.filter((i: any) =>
    i.name?.toLowerCase().includes(search.toLowerCase())
  );

  const stockColor = (item: any) => {
    const q = Number(item.currentStock);
    if (q <= 2)  return COLORS.danger;
    if (q <= 10) return COLORS.warning;
    return COLORS.success;
  };

  async function handleAdjust() {
    if (!adjustQty) return;
    setSaving(true);
    try {
      await api.inventory.adjust(adjustItem.id, {
        adjustment: Number(adjustQty),
        notes: adjustNote || undefined,
        type: 'ADJUSTMENT_IN',
      });
      setAdjustItem(null); setAdjustQty(''); setAdjustNote('');
      refetch();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || 'Failed to adjust');
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <View style={styles.center}><ActivityIndicator size="large" color={BRAND} /></View>;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Stock</Text>
        <Text style={styles.count}>{items.length} items</Text>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search ingredients…"
          placeholderTextColor={COLORS.gray400}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={BRAND} />}
      >
        {filtered.map((item: any) => {
          const color = stockColor(item);
          const qty   = Number(item.currentStock);
          return (
            <TouchableOpacity key={item.id} onPress={() => { setAdjustItem(item); setAdjustQty(''); setAdjustNote(''); }}>
              <Card style={styles.itemCard} padding={14}>
                <View style={styles.itemRow}>
                  <View style={[styles.dot, { backgroundColor: color }]} />
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemSub}>
                      {item.category || item.supplier?.name || 'Ingredient'}
                    </Text>
                  </View>
                  <View style={styles.itemQty}>
                    <Text style={[styles.qtyValue, { color }]}>{qty.toFixed(1)}</Text>
                    <Text style={styles.qtyUnit}>{item.uom?.abbreviation || ''}</Text>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          );
        })}
        {filtered.length === 0 && (
          <Text style={styles.empty}>No items found</Text>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Adjust Modal */}
      <Modal visible={!!adjustItem} transparent animationType="slide" onRequestClose={() => setAdjustItem(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setAdjustItem(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <Text style={styles.sheetTitle}>Adjust Stock</Text>
            <Text style={styles.sheetItem}>{adjustItem?.name}</Text>
            <Text style={styles.sheetCurrent}>
              Current: {Number(adjustItem?.currentStock || 0).toFixed(1)} {adjustItem?.uom?.abbreviation}
            </Text>
            <Text style={styles.inputLabel}>Quantity to add (+) or remove (−)</Text>
            <TextInput
              style={styles.input}
              value={adjustQty}
              onChangeText={setAdjustQty}
              placeholder="e.g. 5 or -2"
              keyboardType="numbers-and-punctuation"
              autoFocus
            />
            <Text style={styles.inputLabel}>Note (optional)</Text>
            <TextInput
              style={styles.input}
              value={adjustNote}
              onChangeText={setAdjustNote}
              placeholder="e.g. Received from Makro"
            />
            <TouchableOpacity style={[styles.btn, saving && { opacity: 0.7 }]} onPress={handleAdjust} disabled={saving}>
              <Text style={styles.btnText}>{saving ? 'Saving…' : 'Save Adjustment'}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: COLORS.gray50 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  title:       { fontSize: 22, fontWeight: '900', color: COLORS.gray900 },
  count:       { fontSize: 13, color: COLORS.gray400, fontWeight: '600' },
  searchWrap:  { paddingHorizontal: 16, marginBottom: 8 },
  search:      { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.gray200, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: COLORS.gray900 },
  scroll:      { padding: 16, gap: 8 },
  empty:       { textAlign: 'center', color: COLORS.gray400, marginTop: 60, fontSize: 15 },
  itemCard:    { marginBottom: 0 },
  itemRow:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot:         { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  itemInfo:    { flex: 1 },
  itemName:    { fontSize: 14, fontWeight: '700', color: COLORS.gray900 },
  itemSub:     { fontSize: 11, color: COLORS.gray400, marginTop: 2 },
  itemQty:     { alignItems: 'flex-end' },
  qtyValue:    { fontSize: 18, fontWeight: '900' },
  qtyUnit:     { fontSize: 11, color: COLORS.gray400 },
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  sheetTitle:  { fontSize: 18, fontWeight: '900', color: COLORS.gray900, marginBottom: 4 },
  sheetItem:   { fontSize: 15, fontWeight: '700', color: BRAND, marginBottom: 2 },
  sheetCurrent:{ fontSize: 13, color: COLORS.gray500, marginBottom: 20 },
  inputLabel:  { fontSize: 12, fontWeight: '700', color: COLORS.gray500, textTransform: 'uppercase', marginBottom: 6, marginTop: 12 },
  input:       { borderWidth: 1, borderColor: COLORS.gray200, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.gray900 },
  btn:         { backgroundColor: BRAND, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  btnText:     { color: '#fff', fontSize: 16, fontWeight: '800' },
});
