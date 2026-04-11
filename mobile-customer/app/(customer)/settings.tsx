import { View, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import CustomerTabBar from '../../components/CustomerTabBar'

export default function CustomerSettings() {
  const insets = useSafeAreaInsets()
  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: (insets.top || 44) + 8 }]}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.placeholder}>Settings coming soon</Text>
      </View>
      <CustomerTabBar />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF6F0' },
  header: { backgroundColor: '#8B3A3A', paddingHorizontal: 20, paddingBottom: 18 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholder: { fontSize: 16, color: '#999' },
})
