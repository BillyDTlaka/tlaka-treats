import { syncProductToOdoo, _resetAccountIdCacheForTests, _resetVariantAttributeCacheForTests } from '../shared/services/odoo-product.service'
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

describe('syncProductToOdoo — proper Odoo variants (one template, generated product.product per variant)', () => {
  let prisma: ReturnType<typeof createMockPrisma>
  let odoo: ReturnType<typeof installMockOdoo>

  beforeEach(() => {
    prisma = createMockPrisma()
    odoo = installMockOdoo()
    _resetOdooClientCacheForTests()
    _resetAccountIdCacheForTests()
    _resetVariantAttributeCacheForTests()
    prisma.productVariant.update.mockResolvedValue(undefined)
    prisma.product.update.mockResolvedValue(undefined)
  })

  const product = {
    id: 'product-1',
    name: 'Choc Chip Biscuits',
    classification: 'SELLABLE',
    odooTemplateId: null,
    category: { odooIncomeAccountCode: '500010' },
    variants: [
      { id: 'v-5l',  name: '5L Bucket',  odooProductId: null, odooProductReference: null, prices: [{ tier: 'RETAIL', price: 280 }] },
      { id: 'v-10l', name: '10L Bucket', odooProductId: null, odooProductReference: null, prices: [{ tier: 'RETAIL', price: 350 }] },
      { id: 'v-20l', name: '20L Bucket', odooProductId: null, odooProductReference: null, prices: [{ tier: 'RETAIL', price: 800 }] },
    ],
  }

  it('creates one template with 3 attribute values, and matches each generated product.product back to its variant', async () => {
    odoo.accountsByCode.set('500010', { id: 42 })
    prisma.product.findUnique.mockResolvedValueOnce(product)

    await syncProductToOdoo(prisma, 'product-1')

    // Exactly one template created
    expect(odoo.templatesById.size).toBe(1)
    const [template] = [...odoo.templatesById.values()]
    expect(template.name).toBe('Choc Chip Biscuits')

    // Exactly 3 product.product variants generated under it
    const generated = [...odoo.productsById.values()].filter((p: any) => p._templateId === template.id)
    expect(generated).toHaveLength(3)

    // product.update persisted the template id
    expect(prisma.product.update).toHaveBeenCalledWith({ where: { id: 'product-1' }, data: { odooTemplateId: template.id } })

    // Each local variant was updated with a distinct odooProductId and a SKU
    const calls = prisma.productVariant.update.mock.calls.map((c: any) => c[0])
    const updatedIds = calls.map((c: any) => c.data.odooProductId)
    expect(new Set(updatedIds).size).toBe(3) // all distinct
    calls.forEach((c: any) => {
      expect(c.data.odooProductSyncStatus).toBe('SYNCED')
      expect(c.data.odooProductReference).toBeTruthy()
    })
  })

  it('never applies a default sales tax — Tlaka Treats is not VAT registered', async () => {
    odoo.accountsByCode.set('500010', { id: 42 })
    prisma.product.findUnique.mockResolvedValueOnce(product)

    await syncProductToOdoo(prisma, 'product-1')

    const createCall = (global.fetch as jest.Mock).mock.calls.find((call) => {
      const params = JSON.parse(call[1].body).params
      return params.args?.[3] === 'product.template' && params.args?.[4] === 'create'
    })
    const vals = JSON.parse(createCall[1].body).params.args[5][0]
    expect(vals.taxes_id).toEqual([[6, 0, []]])
  })

  it('sets each variant\'s real RETAIL price as price_extra, with the template base at 0', async () => {
    odoo.accountsByCode.set('500010', { id: 42 })
    prisma.product.findUnique.mockResolvedValueOnce(product)

    await syncProductToOdoo(prisma, 'product-1')

    const [template] = [...odoo.templatesById.values()]
    const createCall = (global.fetch as jest.Mock).mock.calls.find((call) => {
      const params = JSON.parse(call[1].body).params
      return params.args?.[3] === 'product.template' && params.args?.[4] === 'create'
    })
    expect(JSON.parse(createCall[1].body).params.args[5][0].list_price).toBe(0)

    const priceExtras = [...odoo.templateAttributeValuesById.values()]
      .filter((v: any) => v.product_tmpl_id === template.id)
      .map((v: any) => v.price_extra)
      .sort((a: number, b: number) => a - b)
    expect(priceExtras).toEqual([280, 350, 800])
  })

  it('sets the category income account on the template (once), not per variant', async () => {
    odoo.accountsByCode.set('500010', { id: 42 })
    prisma.product.findUnique.mockResolvedValueOnce(product)

    await syncProductToOdoo(prisma, 'product-1')

    const createCall = (global.fetch as jest.Mock).mock.calls.find((call) => {
      const params = JSON.parse(call[1].body).params
      return params.args?.[3] === 'product.template' && params.args?.[4] === 'create'
    })
    const vals = JSON.parse(createCall[1].body).params.args[5][0]
    expect(vals.property_account_income_id).toBe(42)
  })

  it('adds a new variant to an already-templated product without recreating the template', async () => {
    odoo.accountsByCode.set('500010', { id: 42 })
    // First sync: 5L and 10L already exist and are synced; 20L is new
    prisma.product.findUnique.mockResolvedValueOnce({
      ...product,
      odooTemplateId: null,
      variants: product.variants.slice(0, 2),
    })
    await syncProductToOdoo(prisma, 'product-1')
    expect(odoo.templatesById.size).toBe(1)
    const [{ id: templateId }] = [...odoo.templatesById.values()]

    // Second sync: template now exists locally, plus the new 20L variant
    prisma.product.findUnique.mockResolvedValueOnce({
      ...product,
      odooTemplateId: templateId,
      variants: [
        { id: 'v-5l', name: '5L Bucket', odooProductId: 555, odooProductReference: 'X' }, // already synced
        { id: 'v-20l', name: '20L Bucket', odooProductId: null, odooProductReference: null },
      ],
    })
    await syncProductToOdoo(prisma, 'product-1')

    // Still exactly one template — no second one created
    expect(odoo.templatesById.size).toBe(1)
    const generated = [...odoo.productsById.values()].filter((p: any) => p._templateId === templateId)
    expect(generated.length).toBeGreaterThanOrEqual(3) // 5L, 10L from first sync + 20L from second
  })

  it('never syncs a non-SELLABLE product', async () => {
    prisma.product.findUnique.mockResolvedValueOnce({ ...product, classification: 'INGREDIENT' })

    await syncProductToOdoo(prisma, 'product-1')

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('does nothing once every variant already has an odooProductId', async () => {
    prisma.product.findUnique.mockResolvedValueOnce({
      ...product,
      variants: product.variants.map(v => ({ ...v, odooProductId: 111 })),
    })

    await syncProductToOdoo(prisma, 'product-1')

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('throws and marks pending variants FAILED when the income account code is misconfigured', async () => {
    prisma.product.findUnique.mockResolvedValueOnce(product) // no account seeded for 500010

    await expect(syncProductToOdoo(prisma, 'product-1')).rejects.toThrow(/account "500010" not found/)

    const failCalls = prisma.productVariant.update.mock.calls.filter((c: any) => c[0].data.odooProductSyncStatus === 'FAILED')
    expect(failCalls).toHaveLength(3)
  })
})
