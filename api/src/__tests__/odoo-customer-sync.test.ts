import { syncCustomerToOdoo } from '../shared/services/odoo.service'
import { _resetOdooClientCacheForTests } from '../shared/services/odoo-client'
import { createMockPrisma } from './helpers/mock-prisma'
import { installMockOdoo } from './helpers/mock-odoo'

jest.mock('../config', () => ({
  config: {
    odoo: {
      url: 'https://fake-odoo.test',
      db: 'test-db',
      username: 'bot@test.com',
      apiKey: 'fake-key',
      companyName: 'Tlaka Treats',
      autoCreateProducts: false,
      deliveryProductRef: 'DELIVERY-FEE',
      discountProductRef: 'DISCOUNT',
    },
  },
}))

describe('syncCustomerToOdoo — sync status tracking', () => {
  let prisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    prisma = createMockPrisma()
    prisma.user.update.mockResolvedValue(undefined)
    installMockOdoo()
    _resetOdooClientCacheForTests()
  })

  const user = { id: 'user-1', email: 'new@example.com', firstName: 'New', lastName: 'Customer', phone: null, odooPartnerId: null }

  it('persists SYNCED + the partner id on success', async () => {
    await syncCustomerToOdoo(prisma, user)

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({ odooSyncStatus: 'SYNCED', odooSyncError: null }),
    })
  })

  it('persists FAILED + the error message, and still throws, when Odoo rejects the call', async () => {
    ;(global.fetch as jest.Mock).mockImplementationOnce(async () => ({
      json: async () => ({ jsonrpc: '2.0', id: 1, error: { message: 'Access Denied', data: { message: 'invalid credentials' } } }),
    }))

    await expect(syncCustomerToOdoo(prisma, user)).rejects.toThrow(/invalid credentials/i)

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({ odooSyncStatus: 'FAILED', odooSyncError: expect.stringMatching(/invalid credentials/i) }),
    })
  })

  it('does nothing if the customer already has an odooPartnerId', async () => {
    await syncCustomerToOdoo(prisma, { ...user, odooPartnerId: '42' })

    expect(global.fetch).not.toHaveBeenCalled()
    expect(prisma.user.update).not.toHaveBeenCalled()
  })
})
