/**
 * Tests: app/(ambassador)/dashboard.tsx
 * Role: Ambassador — view earnings, referral code, recent orders
 */
import React from 'react'
import { render, waitFor } from '@testing-library/react-native'
import AmbassadorDashboard from '../../app/(ambassador)/dashboard'

jest.mock('../../services/api', () => ({
  ambassadorsApi: { me: jest.fn() },
  ordersApi:      { getAmbassador: jest.fn() },
  productsApi:    { getAll: jest.fn() },
  customersApi:   { getAll: jest.fn() },
  authApi:        {},
}))

jest.mock('../../store/auth.store', () => ({
  useAuthStore: () => ({ user: { firstName: 'Zanele', role: 'AMBASSADOR' }, logout: jest.fn() }),
}))

jest.mock('../../components/AmbassadorTabBar', () => () => null)

import { ambassadorsApi, ordersApi } from '../../services/api'
const mockMe = ambassadorsApi.me as jest.Mock
const mockGetAmbassador = ordersApi.getAmbassador as jest.Mock

const makeAmbassador = (overrides = {}) => ({
  id: 'amb-1',
  code: 'TT-ZANE1234',
  status: 'ACTIVE',
  fullName: 'Zanele Mokoena',
  commissionRate: 0.1,
  ...overrides,
})

const makeOrder = (overrides = {}) => ({
  id: 'ord-1',
  status: 'DELIVERED',
  total: 150,
  commission: { amount: '15.00', status: 'PENDING' },
  ...overrides,
})

describe('AmbassadorDashboard screen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('calls ambassadorsApi.me and ordersApi.getAmbassador on mount', async () => {
    mockMe.mockResolvedValueOnce(makeAmbassador())
    mockGetAmbassador.mockResolvedValueOnce([])

    render(<AmbassadorDashboard />)

    await waitFor(() => {
      expect(mockMe).toHaveBeenCalledTimes(1)
      expect(mockGetAmbassador).toHaveBeenCalledTimes(1)
    })
  })

  it('AMB-05 — displays ambassador referral code after loading', async () => {
    mockMe.mockResolvedValueOnce(makeAmbassador())
    mockGetAmbassador.mockResolvedValueOnce([])

    const { findByText } = render(<AmbassadorDashboard />)

    expect(await findByText('TT-ZANE1234')).toBeTruthy()
  })

  it('AMB-06 — shows total earnings from commissions', async () => {
    mockMe.mockResolvedValueOnce(makeAmbassador())
    mockGetAmbassador.mockResolvedValueOnce([
      makeOrder({ id: 'o1', commission: { amount: '15.00', status: 'PAID' } }),
      makeOrder({ id: 'o2', commission: { amount: '20.00', status: 'PAID' } }),
    ])

    const { findByText } = render(<AmbassadorDashboard />)

    // Total earnings: R35.00 (no space — rendered as R{total.toFixed(2)})
    expect(await findByText('R35.00')).toBeTruthy()
  })

  it('shows paid commission count', async () => {
    mockMe.mockResolvedValueOnce(makeAmbassador())
    mockGetAmbassador.mockResolvedValueOnce([
      makeOrder({ id: 'o1', commission: { amount: '10.00', status: 'PENDING' } }),
      makeOrder({ id: 'o2', commission: { amount: '10.00', status: 'PENDING' } }),
      makeOrder({ id: 'o3', commission: { amount: '10.00', status: 'PAID' } }),
    ])

    const { findByText } = render(<AmbassadorDashboard />)

    await waitFor(async () => {
      expect(await findByText('1')).toBeTruthy() // 1 paid
    })
  })

  it('shows ACTIVE status badge', async () => {
    mockMe.mockResolvedValueOnce(makeAmbassador({ status: 'ACTIVE' }))
    mockGetAmbassador.mockResolvedValueOnce([])

    const { findByText } = render(<AmbassadorDashboard />)

    expect(await findByText('✅ Active')).toBeTruthy()
  })
})
