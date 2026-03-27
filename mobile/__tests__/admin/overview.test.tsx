/**
 * Tests: app/(admin)/overview.tsx
 * Role: Admin — overview of orders, revenue, and ambassadors
 */
import React from 'react'
import { render, waitFor } from '@testing-library/react-native'
import AdminOverview from '../../app/(admin)/overview'

jest.mock('../../services/api', () => ({
  ordersApi:      { getAll: jest.fn(), create: jest.fn(), createAdmin: jest.fn() },
  ambassadorsApi: { getAll: jest.fn(), getActive: jest.fn() },
  productsApi:    { getAll: jest.fn().mockResolvedValue([]), getAllAdmin: jest.fn().mockResolvedValue([]) },
  customersApi:   { getAll: jest.fn().mockResolvedValue([]), create: jest.fn() },
  authApi:        {},
}))

jest.mock('../../store/auth.store', () => ({
  useAuthStore: () => ({
    user: { firstName: 'Admin', role: 'ADMIN' },
    logout: jest.fn(),
  }),
}))

import { ordersApi, ambassadorsApi } from '../../services/api'
const mockOrdersGetAll = ordersApi.getAll as jest.Mock
const mockAmbassadorsGetAll = ambassadorsApi.getAll as jest.Mock

const makeOrder = (overrides = {}) => ({
  id: 'ord-1',
  status: 'PENDING',
  total: '150.00',
  createdAt: new Date().toISOString(),
  customer: { firstName: 'Nomsa', lastName: 'D', phone: '082' },
  items: [],
  ...overrides,
})

const makeAmbassador = (overrides = {}) => ({
  id: 'amb-1',
  fullName: 'Zanele',
  status: 'ACTIVE',
  code: 'TT-TEST0001',
  ...overrides,
})

describe('AdminOverview screen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('DASH-01 — calls ordersApi.getAll and ambassadorsApi.getAll on mount', async () => {
    mockOrdersGetAll.mockResolvedValueOnce([])
    mockAmbassadorsGetAll.mockResolvedValueOnce([])

    render(<AdminOverview />)

    await waitFor(() => {
      expect(mockOrdersGetAll).toHaveBeenCalledTimes(1)
      expect(mockAmbassadorsGetAll).toHaveBeenCalledTimes(1)
    })
  })

  it('DASH-02 — shows total revenue from all orders', async () => {
    mockOrdersGetAll.mockResolvedValueOnce([
      makeOrder({ id: 'o1', total: '100.00' }),
      makeOrder({ id: 'o2', total: '250.00' }),
    ])
    mockAmbassadorsGetAll.mockResolvedValueOnce([])

    const { findByText } = render(<AdminOverview />)

    expect(await findByText('R350')).toBeTruthy()
  })

  it('DASH-03 — shows count of pending orders', async () => {
    mockOrdersGetAll.mockResolvedValueOnce([
      makeOrder({ id: 'o1', status: 'PENDING' }),
      makeOrder({ id: 'o2', status: 'PENDING' }),
      makeOrder({ id: 'o3', status: 'DELIVERED' }),
    ])
    mockAmbassadorsGetAll.mockResolvedValueOnce([])

    const { findAllByText } = render(<AdminOverview />)

    // 2 pending — this number should appear as a KPI
    const twos = await findAllByText('2')
    expect(twos.length).toBeGreaterThan(0)
  })

  it('DASH-04 — shows count of active ambassadors', async () => {
    mockOrdersGetAll.mockResolvedValueOnce([])
    mockAmbassadorsGetAll.mockResolvedValueOnce([
      makeAmbassador({ id: 'a1', status: 'ACTIVE' }),
      makeAmbassador({ id: 'a2', status: 'ACTIVE' }),
      makeAmbassador({ id: 'a3', status: 'INACTIVE' }),
    ])

    const { findAllByText } = render(<AdminOverview />)

    const twos = await findAllByText('2')
    expect(twos.length).toBeGreaterThan(0)
  })

  it('shows date filter buttons', async () => {
    mockOrdersGetAll.mockResolvedValueOnce([])
    mockAmbassadorsGetAll.mockResolvedValueOnce([])

    const { findByText } = render(<AdminOverview />)

    expect(await findByText('All Time')).toBeTruthy()
    expect(await findByText('Today')).toBeTruthy()
    expect(await findByText('This Week')).toBeTruthy()
  })
})
