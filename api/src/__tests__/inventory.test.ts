import supertest from 'supertest'
import { buildTestApp, adminToken } from './helpers/build-test-app'
import { createMockPrisma } from './helpers/mock-prisma'

jest.mock('bcryptjs', () => ({ hash: jest.fn(), compare: jest.fn() }))

const ADMIN_PRODUCT_PERMISSION = { action: 'manage', subject: 'product' }

describe('POST /inventory/movement', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  let prisma: ReturnType<typeof createMockPrisma>

  beforeEach(async () => {
    prisma = createMockPrisma()
    app = await buildTestApp(prisma)
  })

  afterEach(async () => { await app.close() })

  it('INV-01 — a PURCHASE movement with a unit cost updates costPerUnit to that price', async () => {
    prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PRODUCT_PERMISSION])
    prisma.stockMovement.create.mockResolvedValueOnce({})
    prisma.stockItem.update.mockResolvedValueOnce({ id: 'stock-1', currentStock: 15, minStockLevel: 0 })

    const token = adminToken(app)
    const res = await supertest(app.server)
      .post('/inventory/movement')
      .set('Authorization', `Bearer ${token}`)
      .send({ stockItemId: 'stock-1', type: 'PURCHASE', quantity: 10, unitCost: 18.5 })

    expect(res.status).toBe(201)
    expect(prisma.stockItem.update).toHaveBeenCalledWith({
      where: { id: 'stock-1' },
      data: { currentStock: { increment: 10 }, costPerUnit: 18.5 },
      include: { uom: { select: { abbreviation: true } } },
    })
  })

  it('INV-02 — a PURCHASE movement without a unit cost leaves costPerUnit untouched', async () => {
    prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PRODUCT_PERMISSION])
    prisma.stockMovement.create.mockResolvedValueOnce({})
    prisma.stockItem.update.mockResolvedValueOnce({ id: 'stock-1', currentStock: 15, minStockLevel: 0 })

    const token = adminToken(app)
    const res = await supertest(app.server)
      .post('/inventory/movement')
      .set('Authorization', `Bearer ${token}`)
      .send({ stockItemId: 'stock-1', type: 'PURCHASE', quantity: 10 })

    expect(res.status).toBe(201)
    expect(prisma.stockItem.update).toHaveBeenCalledWith({
      where: { id: 'stock-1' },
      data: { currentStock: { increment: 10 } },
      include: { uom: { select: { abbreviation: true } } },
    })
  })

  it('INV-03 — a non-purchase movement (e.g. WASTE) never touches costPerUnit even if a unit cost is somehow sent', async () => {
    prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PRODUCT_PERMISSION])
    prisma.stockMovement.create.mockResolvedValueOnce({})
    prisma.stockItem.update.mockResolvedValueOnce({ id: 'stock-1', currentStock: 5, minStockLevel: 0 })

    const token = adminToken(app)
    const res = await supertest(app.server)
      .post('/inventory/movement')
      .set('Authorization', `Bearer ${token}`)
      .send({ stockItemId: 'stock-1', type: 'WASTE', quantity: 2, unitCost: 99 })

    expect(res.status).toBe(201)
    expect(prisma.stockItem.update).toHaveBeenCalledWith({
      where: { id: 'stock-1' },
      data: { currentStock: { increment: -2 } },
      include: { uom: { select: { abbreviation: true } } },
    })
  })
})
