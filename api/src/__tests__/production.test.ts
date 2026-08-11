import supertest from 'supertest'
import { buildTestApp, adminToken } from './helpers/build-test-app'
import { createMockPrisma } from './helpers/mock-prisma'

jest.mock('bcryptjs', () => ({ hash: jest.fn(), compare: jest.fn() }))

const ADMIN_PRODUCT_PERMISSION = { action: 'manage', subject: 'product' }

function makeRun(overrides: Record<string, any> = {}) {
  return {
    id: 'run-1',
    status: 'IN_PROGRESS',
    batches: 1,
    recipe: {
      id: 'recipe-1',
      name: 'Custard Scones (40)',
      ingredients: [
        { id: 'ri-1', stockItemId: 'stock-flour', quantity: 1.4, stockItem: { id: 'stock-flour', name: 'Cake Flour', currentStock: 25 } },
        { id: 'ri-2', stockItemId: 'stock-eggs', quantity: 4, stockItem: { id: 'stock-eggs', name: 'Egg', currentStock: 30 } },
      ],
    },
    ...overrides,
  }
}

describe('POST /production/:id/complete', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  let prisma: ReturnType<typeof createMockPrisma>

  beforeEach(async () => {
    prisma = createMockPrisma()
    app = await buildTestApp(prisma)
  })

  afterEach(async () => { await app.close() })

  it('PROD-RUN-01 — completing with sufficient stock deducts each ingredient and creates a packaging run', async () => {
    prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PRODUCT_PERMISSION])
    prisma.productionRun.findUnique.mockResolvedValueOnce(makeRun())
    prisma.stockMovement.create.mockResolvedValue({})
    prisma.stockItem.update.mockResolvedValue({})
    prisma.productionRun.update.mockResolvedValueOnce({ id: 'run-1', status: 'COMPLETED' })
    prisma.packagingRun.create.mockResolvedValueOnce({ id: 'pkg-1' })

    const token = adminToken(app)
    const res = await supertest(app.server)
      .post('/production/run-1/complete')
      .set('Authorization', `Bearer ${token}`)
      .send()

    expect(res.status).toBe(200)
    expect(prisma.stockItem.update).toHaveBeenCalledWith({
      where: { id: 'stock-flour' },
      data: { currentStock: { decrement: 1.4 } },
    })
    expect(prisma.stockItem.update).toHaveBeenCalledWith({
      where: { id: 'stock-eggs' },
      data: { currentStock: { decrement: 4 } },
    })
    expect(prisma.packagingRun.create).toHaveBeenCalledTimes(1)
  })

  it('PROD-RUN-02 — refuses to complete when an ingredient is short, and touches no stock', async () => {
    prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PRODUCT_PERMISSION])
    prisma.productionRun.findUnique.mockResolvedValueOnce(makeRun({
      recipe: {
        id: 'recipe-1',
        name: 'Custard Scones (40)',
        ingredients: [
          { id: 'ri-1', stockItemId: 'stock-flour', quantity: 1.4, stockItem: { id: 'stock-flour', name: 'Cake Flour', currentStock: 25 } },
          { id: 'ri-2', stockItemId: 'stock-eggs', quantity: 4, stockItem: { id: 'stock-eggs', name: 'Egg', currentStock: 2 } },
        ],
      },
    }))

    const token = adminToken(app)
    const res = await supertest(app.server)
      .post('/production/run-1/complete')
      .set('Authorization', `Bearer ${token}`)
      .send()

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/Egg/)
    expect(prisma.stockItem.update).not.toHaveBeenCalled()
    expect(prisma.stockMovement.create).not.toHaveBeenCalled()
    expect(prisma.productionRun.update).not.toHaveBeenCalled()
  })

  it('PROD-RUN-03 — a run already COMPLETED cannot be completed again', async () => {
    prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PRODUCT_PERMISSION])
    prisma.productionRun.findUnique.mockResolvedValueOnce(makeRun({ status: 'COMPLETED' }))

    const token = adminToken(app)
    const res = await supertest(app.server)
      .post('/production/run-1/complete')
      .set('Authorization', `Bearer ${token}`)
      .send()

    expect(res.status).toBe(400)
    expect(prisma.stockItem.update).not.toHaveBeenCalled()
  })
})
