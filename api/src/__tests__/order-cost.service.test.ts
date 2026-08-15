import { computeOrderCost } from '../shared/services/order-cost.service'
import { createMockPrisma } from './helpers/mock-prisma'

function makeOrderForCost(overrides: Record<string, any> = {}) {
  return {
    id: 'order-1',
    items: [
      { id: 'item-1', quantity: 2, variant: { product: { id: 'product-1' } } },
    ],
    ...overrides,
  }
}

function makeRecipe(overrides: Record<string, any> = {}) {
  return {
    id: 'recipe-1',
    outputProductId: 'product-1',
    isActive: true,
    yieldQty: 40,
    ingredients: [
      { quantity: 1.4, stockItem: { costPerUnit: 16 } }, // R22.40
    ],
    ...overrides,
  }
}

describe('computeOrderCost', () => {
  let prisma: ReturnType<typeof createMockPrisma>

  beforeEach(() => {
    prisma = createMockPrisma()
  })

  it('COST-01 — missing order is a harmless no-op', async () => {
    prisma.order.findUnique.mockResolvedValueOnce(null)
    const result = await computeOrderCost(prisma, 'order-1')
    expect(result).toEqual({ total: 0, uncostedItems: [] })
    expect(prisma.orderItem.update).not.toHaveBeenCalled()
  })

  it('COST-02 — costs a line item from its product\'s recipe and persists both the item and order snapshot', async () => {
    prisma.order.findUnique.mockResolvedValueOnce(makeOrderForCost())
    prisma.recipe.findMany.mockResolvedValueOnce([makeRecipe()])

    const result = await computeOrderCost(prisma, 'order-1')

    // unitCost = 22.40 / 40 = 0.56; line total = 0.56 × 2 = 1.12
    expect(result.total).toBeCloseTo(1.12, 5)
    expect(result.uncostedItems).toEqual([])

    const itemUpdateCall = prisma.orderItem.update.mock.calls[0][0]
    expect(itemUpdateCall.where).toEqual({ id: 'item-1' })
    expect(itemUpdateCall.data.unitCost).toBeCloseTo(0.56, 5)

    const orderUpdateCall = prisma.order.update.mock.calls[0][0]
    expect(orderUpdateCall.where).toEqual({ id: 'order-1' })
    expect(orderUpdateCall.data.cogsAmount).toBeCloseTo(1.12, 5)
    expect(orderUpdateCall.data.cogsComputedAt).toBeInstanceOf(Date)
  })

  it('COST-03 — a product with no active recipe contributes zero cost and is reported as uncosted', async () => {
    prisma.order.findUnique.mockResolvedValueOnce(makeOrderForCost({
      items: [{ id: 'item-1', quantity: 3, variant: { product: { id: 'product-1', name: 'Mystery Loaf' } } }],
    }))
    prisma.recipe.findMany.mockResolvedValueOnce([])

    const result = await computeOrderCost(prisma, 'order-1')

    expect(result.total).toBe(0)
    expect(result.uncostedItems).toEqual(['Mystery Loaf'])
    expect(prisma.orderItem.update).toHaveBeenCalledWith({ where: { id: 'item-1' }, data: { unitCost: 0 } })
  })

  it('COST-04 — sums multiple line items, each costed from its own recipe', async () => {
    prisma.order.findUnique.mockResolvedValueOnce(makeOrderForCost({
      items: [
        { id: 'item-1', quantity: 2, variant: { product: { id: 'product-1' } } },
        { id: 'item-2', quantity: 1, variant: { product: { id: 'product-2' } } },
      ],
    }))
    prisma.recipe.findMany.mockResolvedValueOnce([
      makeRecipe(), // product-1: unit cost 0.56
      makeRecipe({ id: 'recipe-2', outputProductId: 'product-2', yieldQty: 1, ingredients: [{ quantity: 1, stockItem: { costPerUnit: 10 } }] }), // product-2: unit cost 10
    ])

    const result = await computeOrderCost(prisma, 'order-1')

    // (0.56 × 2) + (10 × 1) = 11.12
    expect(result.total).toBeCloseTo(11.12, 5)
    expect(result.uncostedItems).toEqual([])
  })

  it('COST-06 — an ingredient recorded in a different (but compatible) unit than its stock item is converted before costing', async () => {
    // Recipe calls for 250g of flour; the stock item is costed per kilogram (R20/kg).
    // Without conversion this would wrongly compute 250 × 20 = R5000 instead of R5.
    const kg = { id: 'uom-kg', abbreviation: 'kg', type: 'WEIGHT', toBaseFactor: 1 }
    const g  = { id: 'uom-g',  abbreviation: 'g',  type: 'WEIGHT', toBaseFactor: 0.001 }
    prisma.order.findUnique.mockResolvedValueOnce(makeOrderForCost({
      items: [{ id: 'item-1', quantity: 1, variant: { product: { id: 'product-1' } } }],
    }))
    prisma.recipe.findMany.mockResolvedValueOnce([makeRecipe({
      yieldQty: 1,
      ingredients: [{ quantity: 250, uom: g, stockItem: { costPerUnit: 20, uom: kg } }],
    })])

    const result = await computeOrderCost(prisma, 'order-1')

    // 250g = 0.25kg; 0.25 × R20/kg = R5 per batch, yieldQty 1 → unitCost R5
    expect(result.total).toBeCloseTo(5, 5)
    const itemUpdateCall = prisma.orderItem.update.mock.calls[0][0]
    expect(itemUpdateCall.data.unitCost).toBeCloseTo(5, 5)
  })

  it('COST-07 — an ingredient with no uom set (the pre-existing default) costs exactly as before, no conversion applied', async () => {
    prisma.order.findUnique.mockResolvedValueOnce(makeOrderForCost())
    prisma.recipe.findMany.mockResolvedValueOnce([makeRecipe()]) // no uom fields at all

    const result = await computeOrderCost(prisma, 'order-1')

    expect(result.total).toBeCloseTo(1.12, 5)
  })

  it('COST-05 — a packed variant costs by units-per-pack, not by quantity alone', async () => {
    // 2× a "6 Pack" variant of a product whose recipe costs R0.56 per individual unit —
    // should cost 6 individual units per pack ordered, not 1.
    prisma.order.findUnique.mockResolvedValueOnce(makeOrderForCost({
      items: [{ id: 'item-1', quantity: 2, variant: { unitsPerPack: 6, product: { id: 'product-1' } } }],
    }))
    prisma.recipe.findMany.mockResolvedValueOnce([makeRecipe()])

    const result = await computeOrderCost(prisma, 'order-1')

    // per-pack cost = 0.56 × 6 = 3.36; line total = 3.36 × 2 = 6.72
    expect(result.total).toBeCloseTo(6.72, 5)
    const itemUpdateCall = prisma.orderItem.update.mock.calls[0][0]
    expect(itemUpdateCall.data.unitCost).toBeCloseTo(3.36, 5)
  })
})
