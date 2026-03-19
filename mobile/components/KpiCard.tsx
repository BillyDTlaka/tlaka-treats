import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from './Card';
import { COLORS } from '../lib/theme';

interface Props {
  label: string;
  value: string;
  icon: string;
  color?: string;
  sub?: string;
}

export function KpiCard({ label, value, icon, color = COLORS.brand, sub }: Props) {
  return (
    <Card style={styles.card}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, alignItems: 'center', padding: 16 },
  icon:  { fontSize: 24, marginBottom: 6 },
  value: { fontSize: 22, fontWeight: '900', marginBottom: 2 },
  label: { fontSize: 11, color: COLORS.gray500, fontWeight: '700', textAlign: 'center' },
  sub:   { fontSize: 10, color: COLORS.gray400, marginTop: 2 },
});
