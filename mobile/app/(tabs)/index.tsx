import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useDashboard } from '../../lib/hooks';
import { KpiCard } from '../../components/KpiCard';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { COLORS, BRAND, STATUS_COLORS } from '../../lib/theme';
import { useAuth } from '../../context/AuthContext';

function fmt(n: number) {
  return `R${n.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = useDashboard();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND} />
      </View>
    );
  }

  const today  = data?.today  || {};
  const month  = data?.month  || {};
  const alerts = data?.alerts || {};
  const recentOrders   = data?.recentOrders  || [];
  const lowStockItems  = data?.lowStockItems || [];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={BRAND} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good day 👋</Text>
            <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
          </View>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        {/* Today KPIs */}
        <Text style={styles.sectionTitle}>Today</Text>
        <View style={styles.kpiRow}>
          <KpiCard label="Revenue" value={fmt(today.revenue || 0)} icon="💰" color={COLORS.success} />
          <KpiCard label="Pending Orders" value={String(alerts.pendingOrders || 0)} icon="📦" color={BRAND} />
          <KpiCard label="Production" value={String(today.production || 0)} icon="🏭" color={COLORS.purple} />
        </View>

        {/* Month KPIs */}
        <Text style={styles.sectionTitle}>This Month</Text>
        <View style={styles.kpiRow}>
          <KpiCard label="Revenue" value={fmt(month.revenue || 0)} icon="📈" color={COLORS.success} sub={`${month.orderCount || 0} orders`} />
          <KpiCard label="Low Stock" value={String(alerts.lowStock || 0)} icon="⚠️" color={alerts.lowStock > 0 ? COLORS.warning : COLORS.success} />
          <KpiCard label="Leave Requests" value={String(alerts.pendingLeave || 0)} icon="🌴" color={alerts.pendingLeave > 0 ? COLORS.warning : COLORS.gray400} />
        </View>

        {/* Alerts */}
        {(alerts.lowStock > 0 || alerts.pendingLeave > 0 || alerts.pendingOrders > 0) && (
          <Card style={styles.alertCard} padding={14}>
            <Text style={styles.alertTitle}>⚡ Needs Attention</Text>
            {alerts.pendingOrders > 0 && (
              <TouchableOpacity onPress={() => router.push('/(tabs)/orders')}>
                <Text style={styles.alertItem}>• {alerts.pendingOrders} pending order(s) waiting confirmation →</Text>
              </TouchableOpacity>
            )}
            {alerts.lowStock > 0 && (
              <TouchableOpacity onPress={() => router.push('/(tabs)/stock')}>
                <Text style={styles.alertItem}>• {alerts.lowStock} ingredient(s) running low →</Text>
              </TouchableOpacity>
            )}
            {alerts.pendingLeave > 0 && (
              <TouchableOpacity onPress={() => router.push('/(tabs)/people')}>
                <Text style={styles.alertItem}>• {alerts.pendingLeave} leave request(s) to review →</Text>
              </TouchableOpacity>
            )}
          </Card>
        )}

        {/* Recent Orders */}
        {recentOrders.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Recent Orders</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/orders')}>
                <Text style={styles.seeAll}>See all →</Text>
              </TouchableOpacity>
            </View>
            <Card padding={0}>
              {recentOrders.map((o: any, i: number) => {
                const name = `${o.customer?.firstName || ''} ${o.customer?.lastName || ''}`.trim() || 'Unknown';
                const sc   = STATUS_COLORS[o.status] || '#6B7280';
                return (
                  <TouchableOpacity
                    key={o.id}
                    style={[styles.orderRow, i < recentOrders.length - 1 && styles.orderBorder]}
                    onPress={() => router.push({ pathname: '/(tabs)/orders', params: { orderId: o.id } })}
                  >
                    <View style={styles.orderLeft}>
                      <Text style={styles.orderName}>{name}</Text>
                      <Text style={styles.orderSub}>{o.items?.[0]?.variant?.product?.name || '—'}</Text>
                    </View>
                    <View style={styles.orderRight}>
                      <Text style={styles.orderTotal}>R{Number(o.total || 0).toFixed(0)}</Text>
                      <Badge label={o.status} color={sc} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </Card>
          </>
        )}

        {/* Low Stock */}
        {lowStockItems.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Low Stock Alert</Text>
            <Card padding={0}>
              {lowStockItems.map((item: any, i: number) => (
                <View key={item.id} style={[styles.orderRow, i < lowStockItems.length - 1 && styles.orderBorder]}>
                  <Text style={styles.orderName}>{item.name}</Text>
                  <Text style={[styles.orderTotal, { color: item.currentStock <= 2 ? COLORS.danger : COLORS.warning }]}>
                    {Number(item.currentStock).toFixed(1)} {item.uom?.abbreviation || ''}
                  </Text>
                </View>
              ))}
            </Card>
          </>
        )}

        {/* Quick links */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Management</Text>
        <Card padding={0}>
          <TouchableOpacity style={[styles.orderRow, styles.orderBorder]} onPress={() => router.push('/(admin)/ambassadors' as any)}>
            <Text style={styles.orderName}>🌟 Ambassador Applications</Text>
            <Text style={styles.seeAll}>Review →</Text>
          </TouchableOpacity>
        </Card>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: COLORS.gray50 },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:       { padding: 16 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  greeting:     { fontSize: 13, color: COLORS.gray500 },
  name:         { fontSize: 20, fontWeight: '900', color: COLORS.gray900 },
  logoutBtn:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: COLORS.gray200 },
  logoutText:   { fontSize: 12, color: COLORS.gray500, fontWeight: '600' },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: COLORS.gray500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 16 },
  sectionRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 10 },
  seeAll:       { fontSize: 12, color: BRAND, fontWeight: '700' },
  kpiRow:       { flexDirection: 'row', gap: 10 },
  alertCard:    { backgroundColor: '#FFF7ED', borderColor: '#FED7AA', marginTop: 4 },
  alertTitle:   { fontSize: 13, fontWeight: '800', color: COLORS.warning, marginBottom: 8 },
  alertItem:    { fontSize: 13, color: COLORS.gray700, marginBottom: 4 },
  orderRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  orderBorder:  { borderBottomWidth: 1, borderBottomColor: COLORS.gray100 },
  orderLeft:    { flex: 1 },
  orderRight:   { alignItems: 'flex-end', gap: 4 },
  orderName:    { fontSize: 14, fontWeight: '700', color: COLORS.gray900 },
  orderSub:     { fontSize: 12, color: COLORS.gray400, marginTop: 2 },
  orderTotal:   { fontSize: 14, fontWeight: '800', color: COLORS.gray900 },
});
