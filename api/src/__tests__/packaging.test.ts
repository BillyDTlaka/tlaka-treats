import supertest from 'supertest'
import { buildTestApp, adminToken } from './helpers/build-test-app'
import { createMockPrisma, makeOrder } from './helpers/mock-prisma'

jest.mock('bcryptjs', () => ({ hash: jest.fn(), compare: jest.fn() }))
jest.mock('nodemailer', () => ({ createTransport: jest.fn(() => ({ sendMail: jest.fn() })) }))
jest.mock('twilio', () => jest.fn(() => ({ messages: { create: jest.fn() } })))

const ADMIN_PRODUCT_PERMISSION = { action: 'manage', subject: 'product' }

function makePackagingRun(overrides: Record<string, any> = {}) {
  return {
    id: 'pkg-1',
    status: 'IN_PROGRESS',
    batchCount: 1,
    items: [],
    productionRun: {
      id: 'run-1',
      orderId: null,
      recipe: {
        id: 'recipe-1',
        name: 'Scones',
        yieldPerBatch: 40,
        outputProduct: { id: 'product-1', name: 'Scones', stockItem: { id: 'stock-1', currentStock: 0 } },
      },
    },
    ...overrides,
  }
}

describe('POST /packaging/:id/complete', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  let prisma: ReturnType<typeof createMockPrisma>

  beforeEach(async () => {
    prisma = createMockPrisma()
    app = await buildTestApp(prisma)
  })

  afterEach(async () => { await app.close() })

  it('PKG-01 — with no unitsProduced entered, adds the recipe-computed batchCount × yieldPerBatch to stock', async () => {
    prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PRODUCT_PERMISSION])
    prisma.packagingRun.findUnique.mockResolvedValueOnce(makePackagingRun({ batchCount: 2 }))
    prisma.stockItem.update.mockResolvedValue({})
    prisma.packagingRun.update.mockResolvedValueOnce({ id: 'pkg-1', status: 'COMPLETED' })

    const token = adminToken(app)
    const res = await supertest(app.server)
      .post('/packaging/pkg-1/complete')
      .set('Authorization', `Bearer ${token}`)
      .send()

    expect(res.status).toBe(200)
    expect(res.body.unitsProduced).toBe(80) // 2 batches × 40/batch
    expect(prisma.stockItem.update).toHaveBeenCalledWith({
      where: { id: 'stock-1' },
      data: { currentStock: { increment: 80 } },
    })
    expect(prisma.packagingRun.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ unitsProduced: 80, unitsWasted: 0 }),
    }))
  })

  it('PKG-02 — an explicit unitsProduced overrides the computed default, and unitsWasted is recorded', async () => {
    prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PRODUCT_PERMISSION])
    prisma.packagingRun.findUnique.mockResolvedValueOnce(makePackagingRun({ batchCount: 1 })) // expects 40
    prisma.stockItem.update.mockResolvedValue({})
    prisma.packagingRun.update.mockResolvedValueOnce({ id: 'pkg-1', status: 'COMPLETED' })

    const token = adminToken(app)
    const res = await supertest(app.server)
      .post('/packaging/pkg-1/complete')
      .set('Authorization', `Bearer ${token}`)
      .send({ unitsProduced: 37, unitsWasted: 3 }) // 37 good + 3 waste = 40 baked total

    expect(res.status).toBe(200)
    expect(res.body.unitsProduced).toBe(37)
    expect(prisma.stockItem.update).toHaveBeenCalledWith({
      where: { id: 'stock-1' },
      data: { currentStock: { increment: 37 } },
    })
    expect(prisma.packagingRun.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ unitsProduced: 37, unitsWasted: 3 }),
    }))
  })

  it('PKG-03 — completing the last outstanding run for a BAKING order deducts its baked items and advances it to READY', async () => {
    prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PRODUCT_PERMISSION])
    prisma.packagingRun.findUnique.mockResolvedValueOnce(makePackagingRun({
      batchCount: 1,
      productionRun: {
        id: 'run-1', orderId: 'order-1',
        recipe: { id: 'recipe-1', name: 'Scones', yieldPerBatch: 40, outputProduct: { id: 'product-1', name: 'Scones', stockItem: { id: 'stock-1', currentStock: 0 } } },
      },
    }))
    prisma.stockItem.update.mockResolvedValue({})
    prisma.packagingRun.update.mockResolvedValueOnce({ id: 'pkg-1', status: 'COMPLETED' })

    // completeBakingForOrder's own lookup — order is BAKING, its one production run is
    // COMPLETED with a COMPLETED packaging run (i.e. this is the last thing it was waiting on).
    const bakingOrder = makeOrder({
      status: 'BAKING',
      items: [{
        id: 'item-1', variantId: 'variant-1', quantity: 2, unitPrice: 65, subtotal: 130,
        variant: {
          id: 'variant-1', unitsPerPack: 6,
          product: { id: 'product-1', name: 'Scones', classification: 'SELLABLE', stockItem: { id: 'stock-1' } },
        },
      }],
      productionRuns: [{
        id: 'run-1', status: 'COMPLETED', recipe: { outputProductId: 'product-1' },
        packagingRun: { status: 'COMPLETED' },
      }],
    })
    prisma.order.findUnique.mockResolvedValueOnce(bakingOrder)
    prisma.order.update.mockResolvedValueOnce(makeOrder({ status: 'READY' }))

    const token = adminToken(app)
    const res = await supertest(app.server)
      .post('/packaging/pkg-1/complete')
      .set('Authorization', `Bearer ${token}`)
      .send()

    expect(res.status).toBe(200)
    // 2 × 6-per-pack = 12 baked units deducted for this order; any batch surplus (40 - 12) stays in stock.
    expect(prisma.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ stockItemId: 'stock-1', type: 'ORDER_FULFILLMENT', quantity: -12 }),
    })
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { status: 'READY', statusLogs: { create: { status: 'READY', note: 'Baking complete' } } },
    })
    expect(res.body.orderAdvanced.status).toBe('READY')
  })

  it('PKG-04 — completing one of several runs for a BAKING order does not advance it while siblings are still pending', async () => {
    prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PRODUCT_PERMISSION])
    prisma.packagingRun.findUnique.mockResolvedValueOnce(makePackagingRun({
      batchCount: 1,
      productionRun: {
        id: 'run-1', orderId: 'order-1',
        recipe: { id: 'recipe-1', name: 'Scones', yieldPerBatch: 40, outputProduct: { id: 'product-1', name: 'Scones', stockItem: { id: 'stock-1', currentStock: 0 } } },
      },
    }))
    prisma.stockItem.update.mockResolvedValue({})
    prisma.packagingRun.update.mockResolvedValueOnce({ id: 'pkg-1', status: 'COMPLETED' })

    const stillBakingOrder = makeOrder({
      status: 'BAKING',
      productionRuns: [
        { id: 'run-1', status: 'COMPLETED', recipe: { outputProductId: 'product-1' }, packagingRun: { status: 'COMPLETED' } },
        { id: 'run-2', status: 'PLANNED', recipe: { outputProductId: 'product-2' }, packagingRun: null }, // still pending
      ],
    })
    prisma.order.findUnique.mockResolvedValueOnce(stillBakingOrder)

    const token = adminToken(app)
    const res = await supertest(app.server)
      .post('/packaging/pkg-1/complete')
      .set('Authorization', `Bearer ${token}`)
      .send()

    expect(res.status).toBe(200)
    expect(res.body.orderAdvanced).toBeUndefined()
    expect(prisma.order.update).not.toHaveBeenCalled()
  })
})
