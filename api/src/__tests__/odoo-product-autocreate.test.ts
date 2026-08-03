import { resolveOdooProductId } from '../shared/services/odoo-product.service'
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
    },
  },
}))

describe('resolveOdooProductId with ODOO_AUTO_CREATE_PRODUCTS=true', () => {
  let prisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    prisma = createMockPrisma()
    installMockOdoo()
    _resetOdooClientCacheForTests()
  })

  it('generates a reference from the product/variant name and creates it in Odoo when none is set', async () => {
    const variant = {
      id: 'variant-1',
      name: '5L Bucket',
      odooProductId: null,
      odooProductReference: null,
      product: { name: 'Melting Moments' },
    }

    const id = await resolveOdooProductId(prisma, 1, variant)

    expect(id).toBeGreaterThan(0)
    expect(prisma.productVariant.update).toHaveBeenCalledWith({
      where: { id: 'variant-1' },
      data: expect.objectContaining({ odooProductId: id, odooProductReference: 'MELTING-MOMENTS-5L-BUCKET', odooProductSyncStatus: 'SYNCED' }),
    })
  })

  it('reuses the same Odoo product on a second, unrelated variant instance with an identical name (no duplicate created)', async () => {
    const variant = {
      id: 'variant-1',
      name: '5L Bucket',
      odooProductId: null,
      odooProductReference: null,
      product: { name: 'Melting Moments' },
    }

    const firstId = await resolveOdooProductId(prisma, 1, variant)
    // second call simulates the variant now knowing its reference (as it would after the first sync)
    const secondId = await resolveOdooProductId(prisma, 1, { ...variant, odooProductReference: 'MELTING-MOMENTS-5L-BUCKET' })

    expect(secondId).toBe(firstId)
  })
})
