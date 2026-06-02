export const BRAND = '#8B3A3A'
export const BRAND_DARK = '#5C1A1A'
export const BRAND_LIGHT = '#f5d0d0'

export const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  PENDING:   { bg: '#FFF3CD', text: '#856404', label: 'Pending' },
  CONFIRMED: { bg: '#D1ECF1', text: '#0C5460', label: 'Confirmed' },
  BAKING:    { bg: '#FFE0B2', text: '#E65100', label: '🔥 Baking' },
  READY:     { bg: '#D4EDDA', text: '#155724', label: '✅ Ready' },
  DELIVERED: { bg: '#E2D9F3', text: '#432874', label: '🚚 Delivered' },
  CANCELLED: { bg: '#F8D7DA', text: '#721C24', label: 'Cancelled' },
  COMPLETED: { bg: '#D4EDDA', text: '#155724', label: 'Completed' },
}
