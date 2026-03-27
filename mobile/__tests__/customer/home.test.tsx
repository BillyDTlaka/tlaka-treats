/**
 * Tests: app/(customer)/home.tsx
 * Role: Customer — browse products with search and category filter
 */
import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import CustomerHome from '../../app/(customer)/home'

jest.mock('../../services/api', () => ({
  productsApi:    { getAll: jest.fn() },
  ordersApi:      { getAmbassador: jest.fn() },
  ambassadorsApi: { me: jest.fn() },
  customersApi:   { getAll: jest.fn() },
  authApi:        {},
}))

jest.mock('../../store/auth.store', () => ({
  useAuthStore: () => ({ user: { firstName: 'Nomsa' }, logout: jest.fn() }),
}))

jest.mock('../../store/cart.store', () => ({
  useCartStore: (selector: any) =>
    selector({ getItemCount: () => 0 }),
}))

jest.mock('../../components/CustomerTabBar', () => () => null)

import { productsApi } from '../../services/api'
const mockGetAll = productsApi.getAll as jest.Mock

const makeProduct = (overrides = {}) => ({
  id: 'p1',
  name: 'Choc Chip Cookies',
  description: 'Delicious',
  category: { name: 'Cookies' },
  variants: [
    {
      id: 'v1',
      name: '12 Pack',
      prices: [{ tier: 'RETAIL', price: '85.00' }],
      images: [],
    },
  ],
  images: [],
  ...overrides,
})

describe('CustomerHome screen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('PROD-01 — calls productsApi.getAll on mount', async () => {
    mockGetAll.mockResolvedValueOnce([])

    render(<CustomerHome />)

    await waitFor(() => {
      expect(mockGetAll).toHaveBeenCalledTimes(1)
    })
  })

  it('PROD-01 — renders product list after data loads', async () => {
    mockGetAll.mockResolvedValueOnce([makeProduct()])

    const { findByText } = render(<CustomerHome />)

    expect(await findByText('Choc Chip Cookies')).toBeTruthy()
  })

  it('PROD-01 — shows greeting with user first name', async () => {
    mockGetAll.mockResolvedValueOnce([])

    const { findByText } = render(<CustomerHome />)

    expect(await findByText(/Nomsa/)).toBeTruthy()
  })

  it('PROD-01 — renders category filter chip', async () => {
    mockGetAll.mockResolvedValueOnce([
      makeProduct({ id: 'p1', name: 'Cookies', category: { name: 'Cookies' } }),
      makeProduct({ id: 'p2', name: 'Scones',  category: { name: 'Scones' } }),
    ])

    const { findAllByText } = render(<CustomerHome />)

    // Category chips appear alongside product cards; at least one "Cookies" text
    const cookiesEls = await findAllByText('Cookies')
    expect(cookiesEls.length).toBeGreaterThan(0)
  })

  it('PROD-01 — filters by search text', async () => {
    mockGetAll.mockResolvedValueOnce([
      makeProduct({ id: 'p1', name: 'Choc Chip Cookies' }),
      makeProduct({ id: 'p2', name: 'Lemon Scones' }),
    ])

    const { findByText, getByPlaceholderText, queryByText } = render(<CustomerHome />)

    await findByText('Choc Chip Cookies')

    fireEvent.changeText(getByPlaceholderText(/search/i), 'scone')

    await waitFor(() => {
      expect(queryByText('Choc Chip Cookies')).toBeNull()
    })
    expect(queryByText('Lemon Scones')).toBeTruthy()
  })

  it('PROD-02 — shows \"From R\" price for product with retail price', async () => {
    mockGetAll.mockResolvedValueOnce([makeProduct()])

    const { findByText } = render(<CustomerHome />)

    // Rendered as `From R{price.toFixed(2)}` — no space between R and number
    expect(await findByText('From R85.00')).toBeTruthy()
  })

  it('renders multiple products', async () => {
    mockGetAll.mockResolvedValueOnce([
      makeProduct({ id: 'p1', name: 'Choc Chip Cookies' }),
      makeProduct({ id: 'p2', name: 'Lemon Scones' }),
    ])

    const { findByText } = render(<CustomerHome />)

    expect(await findByText('Choc Chip Cookies')).toBeTruthy()
    expect(await findByText('Lemon Scones')).toBeTruthy()
  })
})
