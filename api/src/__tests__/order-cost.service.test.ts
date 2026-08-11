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
})
