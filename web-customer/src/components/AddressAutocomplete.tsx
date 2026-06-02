import { useState, useRef, useCallback } from 'react'

interface NominatimResult {
  place_id: number
  display_name: string
  address: {
    road?: string; suburb?: string; neighbourhood?: string;
    village?: string; town?: string; city?: string; municipality?: string;
    county?: string; state?: string; province?: string; postcode?: string;
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
  }

  const enableManualMode = () => {
    setManualMode(true); setSuggestions([]); setShowDropdown(false)
  }

  const exitManualMode = () => {
    setManualMode(false); setQuery(''); onChange('')
  }

  const showManualHint = !manualMode && !showDropdown && !loading && query.length >= 3

  return (
    <div style={{ marginBottom: 16, position: 'relative', zIndex: 100 }}>
      <div style={{
        display: 'flex', alignItems: 'center',
        background: '#fff', borderRadius: 12,
        border: `${showDropdown ? '1px solid #f0e0e0' : '1px solid #e8d5d5'}`,
        borderBottomLeftRadius: showDropdown ? 0 : 12,
        borderBottomRightRadius: showDropdown ? 0 : 12,
        borderColor: manualMode ? '#8B3A3A' : undefined,
        borderWidth: manualMode ? 1.5 : undefined,
        paddingLeft: 12, minHeight: 50,
      }}>
        <span style={{ fontSize: 16, marginRight: 8 }}>{manualMode ? '✏️' : '📍'}</span>
        {manualMode ? (
          <textarea
            style={{ flex: 1, background: 'none', border: 'none', padding: '10px 8px', fontSize: 15, color: '#1a1a1a', outline: 'none', resize: 'none', minHeight: 64, fontFamily: 'inherit' }}
            value={query}
            onChange={e => handleChange(e.target.value)}
            placeholder="Type your full address (e.g. Farm 42, Limpopo, 0600)"
            rows={3}
          />
        ) : (
          <input
            style={{ flex: 1, background: 'none', border: 'none', padding: '10px 8px', fontSize: 15, color: '#1a1a1a', outline: 'none' }}
            value={query}
            onChange={e => handleChange(e.target.value)}
            placeholder={placeholder || 'Start typing your street or area...'}
            onFocus={() => { if (!manualMode && suggestions.length > 0) setShowDropdown(true) }}
          />
        )}
        {loading && <div style={{ width: 18, height: 18, border: '2px solid #f5d0d0', borderTopColor: '#8B3A3A', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: 8 }} />}
      </div>

      {showDropdown && (
        <div style={{
          background: '#fff', border: '1px solid #e8d5d5', borderTop: 'none',
          borderRadius: '0 0 12px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        }}>
          {suggestions.map((item, idx) => (
            <button
              key={item.place_id}
              style={{
                display: 'flex', alignItems: 'center', width: '100%',
                padding: '11px 14px', background: '#fff', border: 'none',
                borderBottom: idx < suggestions.length - 1 ? '1px solid #f7efef' : 'none',
                cursor: 'pointer', textAlign: 'left',
              }}
              onClick={() => handleSelect(item)}
            >
              <span style={{ fontSize: 14, marginRight: 10 }}>📍</span>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 14, color: '#1a1a1a', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {buildCleanAddress(item)}
                </div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.display_name.split(', ').slice(2, 5).join(', ')}
                </div>
              </div>
            </button>
          ))}
          <button
            style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '11px 14px', background: '#fdf6f0', border: 'none', borderTop: '1px solid #f0e0e0', cursor: 'pointer' }}
            onClick={enableManualMode}
          >
            <span style={{ fontSize: 14, marginRight: 10 }}>✏️</span>
            <span style={{ fontSize: 13, color: '#8B3A3A', fontWeight: 600 }}>My address isn't listed — enter manually</span>
          </button>
        </div>
      )}

      {showManualHint && (
        <button style={{ background: 'none', border: 'none', marginTop: 6, padding: '0 4px', fontSize: 12, color: '#999', cursor: 'pointer' }} onClick={enableManualMode}>
          Rural area or address not found? <span style={{ color: '#8B3A3A', fontWeight: 700, textDecoration: 'underline' }}>Enter manually</span>
        </button>
      )}

      {manualMode && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, padding: '0 4px' }}>
          <span style={{ fontSize: 12, color: '#8B3A3A', fontWeight: 600 }}>Manual entry — type your address in full</span>
          <button onClick={exitManualMode} style={{ background: 'none', border: 'none', fontSize: 12, color: '#999', fontWeight: 600, cursor: 'pointer' }}>✕ Clear</button>
        </div>
      )}
    </div>
  )
}
