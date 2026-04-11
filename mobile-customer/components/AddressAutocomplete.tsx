import { useState, useRef, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, StyleSheet, Keyboard,
} from 'react-native'

interface NominatimResult {
  place_id: number
  display_name: string
  address: {
    road?: string
    suburb?: string
    neighbourhood?: string
    village?: string
    town?: string
    city?: string
    municipality?: string
    county?: string
    state?: string
    province?: string
    postcode?: string
    country?: string
  }
}

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function AddressAutocomplete({ value, onChange, placeholder }: Props) {
  const [query, setQuery] = useState(value)
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [manualMode, setManualMode] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const searchAddress = useCallback(async (text: string) => {
    if (text.length < 3) { setSuggestions([]); setShowDropdown(false); return }
    setLoading(true)
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&countrycodes=za&addressdetails=1&limit=6`
      const res = await fetch(url, { headers: { 'Accept-Language': 'en', 'User-Agent': 'TlakaTreats-App/1.0' } })
      const data: NominatimResult[] = await res.json()
      setSuggestions(data)
      setShowDropdown(data.length > 0)
    } catch {
      setSuggestions([]); setShowDropdown(false)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (text: string) => {
    setQuery(text); onChange(text)
    if (manualMode) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchAddress(text), 400)
  }

  const buildCleanAddress = (item: NominatimResult): string => {
    const a = item.address
    const parts = [a.road, a.suburb || a.neighbourhood, a.village || a.town || a.city || a.municipality, a.county, a.state || a.province, a.postcode].filter(Boolean)
    if (parts.length >= 2) return parts.join(', ')
    return item.display_name.split(', ').slice(0, 4).join(', ')
  }

  const handleSelect = (item: NominatimResult) => {
    const clean = buildCleanAddress(item)
    setQuery(clean); onChange(clean)
    setSuggestions([]); setShowDropdown(false)
    Keyboard.dismiss()
  }

  const enableManualMode = () => {
    setManualMode(true); setSuggestions([]); setShowDropdown(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }

  const exitManualMode = () => {
    setManualMode(false); setQuery(''); onChange('')
    setSuggestions([]); setShowDropdown(false)
  }

  const showManualHint = !manualMode && !showDropdown && !loading && query.length >= 3

  return (
    <View style={styles.wrapper}>
      <View style={[styles.inputContainer, showDropdown && styles.inputContainerOpen, manualMode && styles.inputContainerManual]}>
        <Text style={styles.inputIcon}>{manualMode ? '✏️' : '📍'}</Text>
        <TextInput
          style={[styles.input, manualMode && styles.inputManual]}
          value={query}
          onChangeText={handleChange}
          placeholder={manualMode ? 'Type your full address\n(e.g. Farm 42, Limpopo, 0600)' : (placeholder || 'Start typing your street or area...')}
          placeholderTextColor="#bbb"
          multiline={manualMode}
          numberOfLines={manualMode ? 3 : 1}
          textAlignVertical={manualMode ? 'top' : 'center'}
          onFocus={() => { if (!manualMode && suggestions.length > 0) setShowDropdown(true) }}
        />
        {loading && <ActivityIndicator size="small" color="#8B3A3A" style={styles.spinner} />}
      </View>

      {showDropdown && (
        <View style={styles.dropdown}>
          {suggestions.map((item, idx) => (
            <TouchableOpacity
              key={item.place_id}
              style={[styles.suggestionRow, idx < suggestions.length - 1 && styles.suggestionBorder]}
              onPress={() => handleSelect(item)}
              activeOpacity={0.7}
            >
              <Text style={styles.pinIcon}>📍</Text>
              <View style={styles.suggestionTextWrap}>
                <Text style={styles.suggestionMain} numberOfLines={1}>{buildCleanAddress(item)}</Text>
                <Text style={styles.suggestionSub} numberOfLines={1}>{item.display_name.split(', ').slice(2, 5).join(', ')}</Text>
              </View>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.manualDropdownRow} onPress={enableManualMode} activeOpacity={0.7}>
            <Text style={styles.manualDropdownIcon}>✏️</Text>
            <Text style={styles.manualDropdownText}>My address isn't listed — enter manually</Text>
          </TouchableOpacity>
        </View>
      )}

      {showManualHint && (
        <TouchableOpacity style={styles.hintRow} onPress={enableManualMode}>
          <Text style={styles.hintText}>Rural area or address not found? <Text style={styles.hintLink}>Enter manually</Text></Text>
        </TouchableOpacity>
      )}

      {manualMode && (
        <View style={styles.manualBadge}>
          <Text style={styles.manualBadgeText}>Manual entry — type your address in full</Text>
          <TouchableOpacity onPress={exitManualMode}>
            <Text style={styles.manualBadgeClear}>✕ Clear</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 16, zIndex: 100 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e8d5d5', paddingHorizontal: 12, paddingVertical: 4, minHeight: 50 },
  inputContainerOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomColor: '#f0e0e0' },
  inputContainerManual: { alignItems: 'flex-start', paddingVertical: 10, borderColor: '#8B3A3A', borderWidth: 1.5 },
  inputIcon: { fontSize: 16, marginRight: 8, marginTop: 2 },
  input: { flex: 1, fontSize: 15, color: '#1a1a1a', paddingVertical: 8 },
  inputManual: { minHeight: 64, paddingTop: 4 },
  spinner: { marginLeft: 8 },
  dropdown: { backgroundColor: '#fff', borderWidth: 1, borderTopWidth: 0, borderColor: '#e8d5d5', borderBottomLeftRadius: 12, borderBottomRightRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, backgroundColor: '#fff' },
  suggestionBorder: { borderBottomWidth: 1, borderBottomColor: '#f7efef' },
  pinIcon: { fontSize: 14, marginRight: 10 },
  suggestionTextWrap: { flex: 1 },
  suggestionMain: { fontSize: 14, color: '#1a1a1a', fontWeight: '600' },
  suggestionSub: { fontSize: 12, color: '#999', marginTop: 1 },
  manualDropdownRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, backgroundColor: '#fdf6f0', borderTopWidth: 1, borderTopColor: '#f0e0e0' },
  manualDropdownIcon: { fontSize: 14, marginRight: 10 },
  manualDropdownText: { fontSize: 13, color: '#8B3A3A', fontWeight: '600' },
  hintRow: { marginTop: 6, paddingHorizontal: 4 },
  hintText: { fontSize: 12, color: '#999' },
  hintLink: { color: '#8B3A3A', fontWeight: '700', textDecorationLine: 'underline' },
  manualBadge: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, paddingHorizontal: 4 },
  manualBadgeText: { fontSize: 12, color: '#8B3A3A', fontWeight: '600' },
  manualBadgeClear: { fontSize: 12, color: '#999', fontWeight: '600' },
})
