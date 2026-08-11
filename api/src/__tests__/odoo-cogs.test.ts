import { syncOrderCogs } from '../shared/services/odoo-cogs.service'
import { _resetOdooClientCacheForTests } from '../shared/services/odoo-client'
import { _resetGeneralJournalCacheForTests } from '../shared/services/odoo-cogs.service'
import { _resetAccountIdCacheForTests } from '../shared/services/odoo-product.service'
import { createMockPrisma, makeOrder } from './helpers/mock-prisma'
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

function deliveredOrder(overrides: Record<string, any> = {}) {
  return makeOrder({
    status: 'DELIVERED',
    orderNumber: 'TT-ORD-000001',
    orderSeq: 1,
    items: [
      { id: 'item-1', quantity: 2, variant: { product: { id: 'product-1', name: 'Choc Chip Cookies' } } },
    ],
    ...overrides,
  })
}

const RECIPE = {
  id: 'recipe-1',
  outputProductId: 'product-1',
  isActive: true,
  yieldQty: 40,
  ingredients: [{ quantity: 1.4, stockItem: { costPerUnit: 16 } }], // costPerBatch 22.40, unit cost 0.56
}

describe('syncOrderCogs', () => {
  let prisma: ReturnType<typeof createMockPrisma>
  let odoo: ReturnType<typeof installMockOdoo>

  beforeEach(() => {
    prisma = createMockPrisma()
    odoo = installMockOdoo()
    _resetOdooClientCacheForTests()
    _resetGeneralJournalCacheForTests()
    _resetAccountIdCacheForTests()
    prisma.company.findFirst.mockResolvedValue({ odooCogsExpenseAccountCode: '500010', odooCogsClearingAccountCode: '500020' })
    odoo.accountsByCode.set('500010', { id: 61 })
    odoo.accountsByCode.set('500020', { id: 62 })
  })

  it('COGS-01 — refuses to post for an order that has not been delivered yet', async () => {
    prisma.order.findUnique.mockResolvedValueOnce(deliveredOrder({ status: 'CONFIRMED' }))
    const result = await syncOrderCogs(prisma, 'order-1')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/not DELIVERED/)
  })

  it('COGS-02 — order not found is reported cleanly', async () => {
    prisma.order.findUnique.mockResolvedValueOnce(null)
    const result = await syncOrderCogs(prisma, 'order-1')
    expect(result).toEqual({ ok: false, error: 'Order not found' })
  })

  it('COGS-03 — computes cost from the item\'s recipe and posts a balanced draft journal entry', async () => {
    prisma.order.findUnique
      .mockResolvedValueOnce(deliveredOrder()) // syncOrderCogs's own lookup
      .mockResolvedValueOnce(deliveredOrder()) // computeOrderCost's lookup
    prisma.recipe.findMany.mockResolvedValueOnce([RECIPE])

    const result = await syncOrderCogs(prisma, 'order-1')

    expect(result.ok).toBe(true)
    expect(result.action).toBe('CREATED')
    expect(result.state).toBe('draft')
    expect(result.amount).toBeCloseTo(1.12, 5) // 0.56 unit cost × 2

    const createCall = (global.fetch as jest.Mock).mock.calls.find((call) => {
      const params = JSON.parse(call[1].body).params
      return params.args?.[3] === 'account.move' && params.args?.[4] === 'create'
    })
    const vals = JSON.parse(createCall![1].body).params.args[5][0]
    expect(vals.move_type).toBe('entry')
    expect(vals.ref).toBe('TT-ORD-000001')
    expect(vals.line_ids[0][2].account_id).toBe(61)
    expect(vals.line_ids[0][2].debit).toBeCloseTo(1.12, 5)
    expect(vals.line_ids[1][2].account_id).toBe(62)
    expect(vals.line_ids[1][2].credit).toBeCloseTo(1.12, 5)

    const updateCalls = prisma.order.update.mock.calls
    const finalUpdate = updateCalls[updateCalls.length - 1][0]
    expect(finalUpdate.data.odooCogsStatus).toBe('DRAFT_CREATED')
    expect(finalUpdate.data.odooCogsMoveId).toBe(result.moveId)
  })

  it('COGS-04 — refuses to post (and reports which products) when no order item has a recipe to cost from', async () => {
    prisma.order.findUnique
      .mockResolvedValueOnce(deliveredOrder())
      .mockResolvedValueOnce(deliveredOrder())
    prisma.recipe.findMany.mockResolvedValueOnce([])

    const result = await syncOrderCogs(prisma, 'order-1')

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/Choc Chip Cookies/)
    const updateCalls = prisma.order.update.mock.calls
    const finalUpdate = updateCalls[updateCalls.length - 1][0]
    expect(finalUpdate.data.odooCogsStatus).toBe('FAILED')
    // Never reached Odoo — nothing to post.
    const createCalls = (global.fetch as jest.Mock).mock.calls.filter((call) => {
      const params = JSON.parse(call[1].body).params
      return params.args?.[3] === 'account.move' && params.args?.[4] === 'create'
    })
    expect(createCalls).toHaveLength(0)
  })

  it('COGS-05 — fails clearly when the expense/clearing accounts are not configured', async () => {
    prisma.company.findFirst.mockResolvedValueOnce({ odooCogsExpenseAccountCode: null, odooCogsClearingAccountCode: null })
    prisma.order.findUnique
      .mockResolvedValueOnce(deliveredOrder())
      .mockResolvedValueOnce(deliveredOrder())
    prisma.recipe.findMany.mockResolvedValueOnce([RECIPE])

    const result = await syncOrderCogs(prisma, 'order-1')

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/accounts not fully configured/)
    const updateCalls = prisma.order.update.mock.calls
    const finalUpdate = updateCalls[updateCalls.length - 1][0]
    expect(finalUpdate.data.odooCogsStatus).toBe('FAILED')
  })

  it('COGS-06 — reuses an already-linked entry instead of creating a duplicate, without recomputing cost', async () => {
    odoo.invoicesById.set(950, { id: 950, name: 'MISC/2026/0001', state: 'posted', ref: 'TT-ORD-000001' })
    prisma.order.findUnique.mockResolvedValueOnce(deliveredOrder({ odooCogsMoveId: 950, cogsAmount: 1.12 }))

    const result = await syncOrderCogs(prisma, 'order-1')

    expect(result.ok).toBe(true)
    expect(result.action).toBe('ALREADY_LINKED')
    expect(result.state).toBe('posted')
    expect(result.amount).toBeCloseTo(1.12, 5)
    // Reused the frozen amount — never recomputed via recipes.
    expect(prisma.recipe.findMany).not.toHaveBeenCalled()
    const createCalls = (global.fetch as jest.Mock).mock.calls.filter((call) => {
      const params = JSON.parse(call[1].body).params
      return params.args?.[3] === 'account.move' && params.args?.[4] === 'create'
    })
    expect(createCalls).toHaveLength(0)
  })

  it('COGS-07 — links to an existing Odoo entry found by order reference rather than creating a new one', async () => {
    odoo.searchInvoiceResults = [{ id: 951, name: false, state: 'draft', ref: 'TT-ORD-000001' }]
    prisma.order.findUnique
      .mockResolvedValueOnce(deliveredOrder())
      .mockResolvedValueOnce(deliveredOrder())
    prisma.recipe.findMany.mockResolvedValueOnce([RECIPE])

    const result = await syncOrderCogs(prisma, 'order-1')

    expect(result.ok).toBe(true)
    expect(result.action).toBe('LINKED_BY_ORDER_REFERENCE')
    expect(result.moveId).toBe(951)
  })
})
