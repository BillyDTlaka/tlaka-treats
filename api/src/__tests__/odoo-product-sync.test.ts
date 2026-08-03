import { syncProductVariantToOdoo, _resetIncomeAccountCacheForTests } from '../shared/services/odoo-product.service'
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
      autoCreateProducts: true,
      deliveryProductRef: 'DELIVERY-FEE',
      discountProductRef: 'DISCOUNT',
      deliveryIncomeAccountCode: '',
      discountIncomeAccountCode: '',
    },
  },
}))

describe('syncProductVariantToOdoo', () => {
  let prisma: ReturnType<typeof createMockPrisma>
  let odoo: ReturnType<typeof installMockOdoo>

  beforeEach(() => {
    prisma = createMockPrisma()
    odoo = installMockOdoo()
    _resetOdooClientCacheForTests()
    _resetIncomeAccountCacheForTests()
    prisma.productVariant.update.mockResolvedValue(undefined)
  })

  const variant = {
    id: 'variant-1',
    name: '5L Bucket',
    odooProductId: null,
    odooProductReference: null,
    product: { name: 'Melting Moments', classification: 'SELLABLE', category: { odooIncomeAccountCode: '500010' } },
  }

  it('creates the product in Odoo immediately, using the category income account', async () => {
    odoo.accountsByCode.set('500010', { id: 42 })
    prisma.productVariant.findUnique.mockResolvedValueOnce(variant)

    await syncProductVariantToOdoo(prisma, 'variant-1')

    const createCall = (global.fetch as jest.Mock).mock.calls.find((call) => {
      const params = JSON.parse(call[1].body).params
      return params.args?.[3] === 'product.product' && params.args?.[4] === 'create'
    })
    const vals = JSON.parse(createCall[1].body).params.args[5][0]
    expect(vals.property_account_income_id).toBe(42)

    expect(prisma.productVariant.update).toHaveBeenCalledWith({
      where: { id: 'variant-1' },
      data: expect.objectContaining({ odooProductSyncStatus: 'SYNCED' }),
    })
  })

  it('skips products already synced (has an odooProductId)', async () => {
    prisma.productVariant.findUnique.mockResolvedValueOnce({ ...variant, odooProductId: 999 })

    await syncProductVariantToOdoo(prisma, 'variant-1')

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('never syncs a non-SELLABLE (e.g. INGREDIENT) variant', async () => {
    prisma.productVariant.findUnique.mockResolvedValueOnce({
      ...variant,
      product: { name: 'Flour', classification: 'INGREDIENT', category: null },
    })

    await syncProductVariantToOdoo(prisma, 'variant-1')

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('throws and persists FAILED when the configured income account code does not exist in Odoo', async () => {
    prisma.productVariant.findUnique.mockResolvedValueOnce(variant)
    // account.account search_read returns nothing for any code in this test (none seeded)

    await expect(syncProductVariantToOdoo(prisma, 'variant-1')).rejects.toThrow(/income account "500010" not found/)

    expect(prisma.productVariant.update).toHaveBeenCalledWith({
      where: { id: 'variant-1' },
      data: expect.objectContaining({ odooProductSyncStatus: 'FAILED', odooProductSyncError: expect.stringMatching(/500010/) }),
    })
  })
})
