import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEmployees, useLeave, useApproveLeave, useRejectLeave } from '../../lib/hooks';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { COLORS, BRAND, STATUS_COLORS } from '../../lib/theme';

export default function PeopleScreen() {
  const [tab, setTab] = useState<'staff' | 'leave'>('staff');
  const { data: employees = [], isLoading: empLoading, refetch: refetchEmp, isRefetching: refetchingEmp } = useEmployees({ status: 'ACTIVE' });
  const { data: leaveRequests = [], isLoading: leaveLoading, refetch: refetchLeave, isRefetching: refetchingLeave } = useLeave({ status: 'PENDING' });
  const approveLeave = useApproveLeave();
  const rejectLeave  = useRejectLeave();

  const EMP_TYPE_COLOR: Record<string, string> = {
    FULL_TIME: '#059669', PART_TIME: '#2563EB', CONTRACT: '#7C3AED', CASUAL: '#D97706',
  };

  function onApprove(lr: any) {
    const name = `${lr.employee?.user?.firstName || ''} ${lr.employee?.user?.lastName || ''}`.trim();
    Alert.alert('Approve Leave?', `${name} — ${lr.leaveType} (${lr.days} day${lr.days !== 1 ? 's' : ''})`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: () => approveLeave.mutate(lr.id) },
    ]);
  }

  function onReject(lr: any) {
    Alert.alert('Reject Leave?', 'This will notify the employee.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: () => rejectLeave.mutate(lr.id) },
    ]);
  }

  const isLoading = tab === 'staff' ? empLoading : leaveLoading;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>People</Text>
        {tab === 'leave' && leaveRequests.length > 0 && (
          <View style={styles.badge}><Text style={styles.badgeText}>{leaveRequests.length}</Text></View>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {([['staff', 'Staff'], ['leave', 'Leave Requests']] as const).map(([id, label]) => (
          <TouchableOpacity key={id} style={[styles.tab, tab === id && styles.tabActive]} onPress={() => setTab(id)}>
            <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={BRAND} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={tab === 'staff' ? refetchingEmp : refetchingLeave}
              onRefresh={tab === 'staff' ? refetchEmp : refetchLeave}
              tintColor={BRAND}
            />
          }
        >
          {/* Staff Tab */}
          {tab === 'staff' && (employees as any[]).map((emp: any) => {
            const name = `${emp.user?.firstName || ''} ${emp.user?.lastName || ''}`.trim() || 'Unknown';
            const tc = EMP_TYPE_COLOR[emp.employmentType] || '#6B7280';
            const rate = emp.hourlyRate
              ? `R${Number(emp.hourlyRate).toFixed(2)}/hr`
              : emp.monthlyRate
              ? `R${Number(emp.monthlyRate).toLocaleString()}/mo`
              : '';
            return (
              <Card key={emp.id} style={styles.empCard} padding={14}>
                <View style={styles.empRow}>
                  <View style={[styles.avatar, { backgroundColor: tc }]}>
                    <Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View style={styles.empInfo}>
                    <Text style={styles.empName}>{name}</Text>
                    <Text style={styles.empTitle}>{emp.jobTitle}{emp.departmentRel ? ` · ${emp.departmentRel.name}` : ''}</Text>
                  </View>
                  <View style={styles.empRight}>
                    <Badge label={emp.employmentType.replace('_', ' ')} color={tc} />
                    {rate ? <Text style={styles.rate}>{rate}</Text> : null}
                  </View>
                </View>
              </Card>
            );
          })}

          {/* Leave Tab */}
          {tab === 'leave' && (
            (leaveRequests as any[]).length === 0
              ? <Text style={styles.empty}>No pending leave requests 🎉</Text>
              : (leaveRequests as any[]).map((lr: any) => {
                  const name = `${lr.employee?.user?.firstName || ''} ${lr.employee?.user?.lastName || ''}`.trim() || 'Employee';
                  const from = new Date(lr.fromDate).toLocaleDateString('en-ZA');
                  const to   = new Date(lr.toDate).toLocaleDateString('en-ZA');
                  return (
                    <Card key={lr.id} padding={16}>
                      <View style={styles.leaveHeader}>
                        <View>
                          <Text style={styles.empName}>{name}</Text>
                          <Text style={styles.empTitle}>{lr.leaveType} · {lr.days} day(s)</Text>
                          <Text style={styles.leaveDates}>{from} → {to}</Text>
                          {lr.reason && <Text style={styles.leaveReason}>"{lr.reason}"</Text>}
                        </View>
                        <Badge label="PENDING" color={COLORS.warning} />
                      </View>
                      <View style={styles.leaveActions}>
                        <TouchableOpacity style={styles.approveBtn} onPress={() => onApprove(lr)}>
                          <Text style={styles.approveTxt}>✓ Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.rejectBtn} onPress={() => onReject(lr)}>
                          <Text style={styles.rejectTxt}>✕ Reject</Text>
                        </TouchableOpacity>
                      </View>
                    </Card>
                  );
                })
          )}

          {tab === 'staff' && employees.length === 0 && (
            <Text style={styles.empty}>No active employees</Text>
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: COLORS.gray50 },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  title:        { fontSize: 22, fontWeight: '900', color: COLORS.gray900 },
  badge:        { backgroundColor: COLORS.warning, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText:    { color: '#fff', fontSize: 12, fontWeight: '800' },
  tabRow:       { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  tab:          { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.gray100, alignItems: 'center' },
  tabActive:    { backgroundColor: BRAND },
  tabText:      { fontSize: 13, fontWeight: '700', color: COLORS.gray500 },
  tabTextActive:{ color: '#fff' },
  scroll:       { padding: 16, gap: 10 },
  empty:        { textAlign: 'center', color: COLORS.gray400, marginTop: 60, fontSize: 15 },
  empCard:      { marginBottom: 0 },
  empRow:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar:       { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText:   { color: '#fff', fontWeight: '900', fontSize: 16 },
  empInfo:      { flex: 1 },
  empName:      { fontSize: 14, fontWeight: '700', color: COLORS.gray900 },
  empTitle:     { fontSize: 12, color: COLORS.gray500, marginTop: 2 },
  empRight:     { alignItems: 'flex-end', gap: 4 },
  rate:         { fontSize: 12, fontWeight: '700', color: COLORS.gray700, marginTop: 4 },
  leaveHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  leaveDates:   { fontSize: 12, color: COLORS.gray500, marginTop: 4 },
  leaveReason:  { fontSize: 12, color: COLORS.gray400, fontStyle: 'italic', marginTop: 4 },
  leaveActions: { flexDirection: 'row', gap: 10 },
  approveBtn:   { flex: 1, backgroundColor: COLORS.success, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  approveTxt:   { color: '#fff', fontWeight: '800', fontSize: 13 },
  rejectBtn:    { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.gray200 },
  rejectTxt:    { color: COLORS.danger, fontWeight: '700', fontSize: 13 },
});
