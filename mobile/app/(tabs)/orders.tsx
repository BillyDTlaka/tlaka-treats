import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOrders, useUpdateOrderStatus } from '../../lib/hooks';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { COLORS, BRAND, STATUS_COLORS } from '../../lib/theme';

const ORDER_STATUSES = ['PENDING','CONFIRMED','BAKING','READY','DELIVERED','CANCELLED'];
const NEXT_STATUS: Record<string, string> = {
  PENDING:   'CONFIRMED',
  CONFIRMED: 'BAKING',
  BAKING:    'READY',
  READY:     'DELIVERED',
};

export default function OrdersScreen() {
  const [filterStatus, setFilterStatus] = useState<string>('');
  const { data: orders = [], isLoading, refetch, isRefetching } = useOrders(filterStatus ? { status: filterStatus } : {});
  const updateStatus = useUpdateOrderStatus();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handleAdvance(order: any) {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    Alert.alert(`Mark as ${next}?`, `Order for ${order.customer?.firstName || 'customer'}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: next, onPress: () => updateStatus.mutate({ id: order.id, status: next }) },
    ]);
  }

  function handleCancel(order: any) {
    Alert.alert('Cancel Order?', 'This cannot be undone.', [
      { text: 'No', style: 'cancel' },
      { text: 'Cancel Order', style: 'destructive', onPress: () => updateStatus.mutate({ id: order.id, status: 'CANCELLED' }) },
    ]);
  }

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={BRAND} /></View>;
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Orders</Text>
        <Text style={styles.count}>{orders.length} order(s)</Text>
      </View>

      {/* Status filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={styles.filtersContent}>
        {['', ...ORDER_STATUSES].map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.pill, filterStatus === s && styles.pillActive]}
            onPress={() => setFilterStatus(s)}
          >
            <Text style={[styles.pillText, filterStatus === s && styles.pillTextActive]}>
              {s || 'All'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={BRAND} />}
      >
        {orders.length === 0 && (
          <Text style={styles.empty}>No orders found</Text>
        )}
        {orders.map((order: any) => {
          const name = `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() || 'Unknown';
          const sc   = STATUS_COLORS[order.status] || '#6B7280';
          const expanded = expandedId === order.id;
          const nextStatus = NEXT_STATUS[order.status];

          return (
            <Card key={order.id} style={styles.orderCard} padding={0}>
              <TouchableOpacity
                style={styles.orderHeader}
                onPress={() => setExpandedId(expanded ? null : order.id)}
              >
                <View style={styles.orderLeft}>
                  <View style={[styles.statusDot, { backgroundColor: sc }]} />
                  <View>
                    <Text style={styles.orderName}>{name}</Text>
                    <Text style={styles.orderDate}>{new Date(order.createdAt).toLocaleDateString('en-ZA')}</Text>
                  </View>
                </View>
                <View style={styles.orderRight}>
                  <Text style={styles.orderTotal}>R{Number(order.total || 0).toFixed(2)}</Text>
                  <Badge label={order.status} color={sc} />
                </View>
              </TouchableOpacity>

              {expanded && (
                <View style={styles.orderBody}>
                  {/* Items */}
                  {(order.items || []).map((item: any, i: number) => (
                    <View key={i} style={styles.itemRow}>
                      <Text style={styles.itemName}>{item.variant?.product?.name || 'Item'}</Text>
                      <Text style={styles.itemQty}>×{item.quantity}</Text>
                      <Text style={styles.itemPrice}>R{Number(item.subtotal || 0).toFixed(2)}</Text>
                    </View>
                  ))}
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>R{Number(order.total || 0).toFixed(2)}</Text>
                  </View>
                  {/* Notes */}
                  {order.notes && <Text style={styles.notes}>📝 {order.notes}</Text>}
                  {/* Actions */}
                  <View style={styles.actions}>
                    {nextStatus && (
                      <TouchableOpacity style={styles.advanceBtn} onPress={() => handleAdvance(order)}>
                        <Text style={styles.advanceBtnText}>→ Mark {nextStatus}</Text>
                      </TouchableOpacity>
                    )}
                    {!['DELIVERED','CANCELLED','COMPLETED'].includes(order.status) && (
                      <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancel(order)}>
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </Card>
          );
        })}
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:            { flex: 1, backgroundColor: COLORS.gray50 },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  title:           { fontSize: 22, fontWeight: '900', color: COLORS.gray900 },
  count:           { fontSize: 13, color: COLORS.gray400, fontWeight: '600' },
  filters:         { maxHeight: 44 },
  filtersContent:  { paddingHorizontal: 16, gap: 8, paddingVertical: 4 },
  pill:            { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: COLORS.gray100, borderWidth: 1, borderColor: COLORS.gray200 },
  pillActive:      { backgroundColor: BRAND, borderColor: BRAND },
  pillText:        { fontSize: 12, fontWeight: '700', color: COLORS.gray600 },
  pillTextActive:  { color: '#fff' },
  scroll:          { padding: 16, gap: 10 },
  empty:           { textAlign: 'center', color: COLORS.gray400, marginTop: 60, fontSize: 15 },
  orderCard:       { marginBottom: 0 },
  orderHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  orderLeft:       { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  orderRight:      { alignItems: 'flex-end', gap: 4 },
  statusDot:       { width: 10, height: 10, borderRadius: 5 },
  orderName:       { fontSize: 14, fontWeight: '700', color: COLORS.gray900 },
  orderDate:       { fontSize: 11, color: COLORS.gray400, marginTop: 2 },
  orderTotal:      { fontSize: 15, fontWeight: '900', color: COLORS.gray900 },
  orderBody:       { borderTopWidth: 1, borderTopColor: COLORS.gray100, padding: 14 },
  itemRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  itemName:        { flex: 1, fontSize: 13, color: COLORS.gray700 },
  itemQty:         { fontSize: 13, color: COLORS.gray500, width: 32, textAlign: 'center' },
  itemPrice:       { fontSize: 13, fontWeight: '700', color: COLORS.gray900, width: 64, textAlign: 'right' },
  totalRow:        { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: COLORS.gray100, paddingTop: 10, marginTop: 6 },
  totalLabel:      { fontSize: 13, fontWeight: '700', color: COLORS.gray500 },
  totalValue:      { fontSize: 15, fontWeight: '900', color: COLORS.gray900 },
  notes:           { fontSize: 12, color: COLORS.gray500, marginTop: 10, fontStyle: 'italic' },
  actions:         { flexDirection: 'row', gap: 10, marginTop: 14 },
  advanceBtn:      { flex: 1, backgroundColor: BRAND, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  advanceBtnText:  { color: '#fff', fontWeight: '800', fontSize: 13 },
  cancelBtn:       { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.gray200 },
  cancelBtnText:   { color: COLORS.danger, fontWeight: '700', fontSize: 13 },
});
