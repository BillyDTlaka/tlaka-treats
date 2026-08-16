import supertest from 'supertest'
import { buildTestApp, adminToken, customerToken, ambassadorToken } from './helpers/build-test-app'
import {
  createMockPrisma,
  makeUser,
  makeOrder,
  makeAmbassador,
  ADMIN_PERMISSION,
} from './helpers/mock-prisma'

jest.mock('bcryptjs', () => ({ hash: jest.fn(), compare: jest.fn() }))

// Silence email/WhatsApp notifications
jest.mock('nodemailer', () => ({ createTransport: jest.fn(() => ({ sendMail: jest.fn() })) }))
jest.mock('twilio', () => jest.fn(() => ({ messages: { create: jest.fn() } })))

describe('Order routes', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  let prisma: ReturnType<typeof createMockPrisma>

  // Active ambassador fixture
  const activeAmbassador = makeAmbassador({ status: 'ACTIVE', commissionRate: 0.1 })

  // Variant with RETAIL price fixture
  const variantWithPrice = {
    id: 'variant-1',
    name: '12 Pack',
    isActive: true,
    prices: [{ tier: 'RETAIL', price: 85 }],
  }

  beforeEach(async () => {
    prisma = createMockPrisma()
    app = await buildTestApp(prisma)
  })

  afterEach(async () => { await app.close() })

  // ── POST /orders ───────────────────────────────────────────────────────────

  describe('POST /orders (customer places order)', () => {
    it('ORD-01 — creates order successfully and returns 201', async () => {
      prisma.productVariant.findUnique.mockResolvedValueOnce(variantWithPrice)
      prisma.order.create.mockResolvedValueOnce(makeOrder())

      const token = customerToken(app)
      const res = await supertest(app.server)
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [{ variantId: 'variant-1', quantity: 2 }] })

      expect(res.status).toBe(201)
      expect(res.body.status).toBe('PENDING')
    })

    it('ORD-02 — subtotal and total are calculated correctly', async () => {
      prisma.productVariant.findUnique.mockResolvedValueOnce(variantWithPrice)
      const order = makeOrder({ subtotal: 170, deliveryFee: 0, total: 170 })
      prisma.order.create.mockResolvedValueOnce(order)

      const token = customerToken(app)
      const res = await supertest(app.server)
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [{ variantId: 'variant-1', quantity: 2 }] })

      expect(res.body.subtotal).toBe(170)
      expect(res.body.total).toBe(170)
    })

    it('ORD-03 — creates order with valid ambassador code', async () => {
      prisma.ambassador.findUnique.mockResolvedValueOnce(activeAmbassador)
      prisma.productVariant.findUnique.mockResolvedValueOnce({
        ...variantWithPrice,
        prices: [{ tier: 'AMBASSADOR', price: 70 }],
      })
      const order = makeOrder({ ambassadorId: 'amb-1' })
      prisma.order.create.mockResolvedValueOnce(order)

      const token = customerToken(app)
      const res = await supertest(app.server)
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [{ variantId: 'variant-1', quantity: 2 }], ambassadorCode: 'TT-TEST1234' })

      expect(res.status).toBe(201)
      expect(res.body.ambassadorId).toBe('amb-1')
    })

    it('ORD-04 — returns 400 for invalid ambassador code', async () => {
      prisma.ambassador.findUnique.mockResolvedValueOnce(null) // code not found or not ACTIVE

      const token = customerToken(app)
      const res = await supertest(app.server)
        .post('/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [{ variantId: 'variant-1', quantity: 2 }], ambassadorCode: 'INVALID-CODE' })

      expect(res.status).toBe(400)
      expect(res.body.message).toMatch(/invalid ambassador code/i)
    })

    it('ORD-01 — returns 401 without token', async () => {
      const res = await supertest(app.server)
        .post('/orders')
        .send({ items: [{ variantId: 'variant-1', quantity: 2 }] })

      expect(res.status).toBe(401)
    })
  })

  // ── POST /orders/admin ────────────────────────────────────────────────────

  describe('POST /orders/admin (admin places order on behalf of customer)', () => {
    it('ORD-13 — admin creates order for a customer', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PERMISSION])
      prisma.user.findUnique.mockResolvedValueOnce(makeUser())
      prisma.productVariant.findUnique.mockResolvedValueOnce(variantWithPrice)
      prisma.order.create.mockResolvedValueOnce(makeOrder({ customerId: 'user-1' }))

      const token = adminToken(app)
      const res = await supertest(app.server)
        .post('/orders/admin')
        .set('Authorization', `Bearer ${token}`)
        .send({ customerId: 'user-1', items: [{ variantId: 'variant-1', quantity: 1 }] })

      expect(res.status).toBe(201)
      expect(res.body.customerId).toBe('user-1')
    })

    it('ORD-17 — returns 404 when customer not found', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PERMISSION])
      prisma.user.findUnique.mockResolvedValueOnce(null)

      const token = adminToken(app)
      const res = await supertest(app.server)
        .post('/orders/admin')
        .set('Authorization', `Bearer ${token}`)
        .send({ customerId: 'ghost-user', items: [{ variantId: 'variant-1', quantity: 1 }] })

      expect(res.status).toBe(404)
    })

    it('AUTH-07 — returns 403 for customer trying to use admin route', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([]) // no permissions

      const token = customerToken(app)
      const res = await supertest(app.server)
        .post('/orders/admin')
        .set('Authorization', `Bearer ${token}`)
        .send({ customerId: 'user-1', items: [] })

      expect(res.status).toBe(403)
    })
  })

  // ── GET /orders ────────────────────────────────────────────────────────────

  describe('GET /orders (admin list all)', () => {
    it('admin gets all orders', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PERMISSION])
      prisma.order.findMany.mockResolvedValueOnce([makeOrder()])

      const token = adminToken(app)
      const res = await supertest(app.server)
        .get('/orders')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(1)
    })

    it('AUTH-07 — customer cannot list all orders (403)', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([])

      const token = customerToken(app)
      const res = await supertest(app.server)
        .get('/orders')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(403)
    })
  })

  // ── GET /orders/my ────────────────────────────────────────────────────────

  describe('GET /orders/my (customer owns orders)', () => {
    it('ORD-10 — customer gets only their own orders', async () => {
      prisma.order.findMany.mockResolvedValueOnce([makeOrder({ customerId: 'user-1' })])

      const token = customerToken(app, 'user-1')
      const res = await supertest(app.server)
        .get('/orders/my')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body[0].customerId).toBe('user-1')
    })

    it('returns 401 without auth', async () => {
      const res = await supertest(app.server).get('/orders/my')
      expect(res.status).toBe(401)
    })
  })

  // ── GET /orders/ambassador ────────────────────────────────────────────────

  describe('GET /orders/ambassador', () => {
    it('ORD-12 — ambassador gets orders attributed to them', async () => {
      prisma.ambassador.findUnique.mockResolvedValueOnce(activeAmbassador)
      prisma.order.findMany.mockResolvedValueOnce([makeOrder({ ambassadorId: 'amb-1' })])

      const token = ambassadorToken(app, 'user-1')
      const res = await supertest(app.server)
        .get('/orders/ambassador')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body[0].ambassadorId).toBe('amb-1')
    })

    it('returns empty array when user is not an ambassador', async () => {
      prisma.ambassador.findUnique.mockResolvedValueOnce(null)

      const token = customerToken(app)
      const res = await supertest(app.server)
        .get('/orders/ambassador')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body).toEqual([])
    })
  })

  // ── GET /orders/:id ────────────────────────────────────────────────────────

  describe('GET /orders/:id (admin only)', () => {
    it('admin retrieves a single order by id', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PERMISSION])
      prisma.order.findUnique.mockResolvedValueOnce(makeOrder())

      const token = adminToken(app)
      const res = await supertest(app.server)
        .get('/orders/order-1')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.id).toBe('order-1')
    })

    it('ORD-17 — returns 404 for unknown order', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PERMISSION])
      prisma.order.findUnique.mockResolvedValueOnce(null)

      const token = adminToken(app)
      const res = await supertest(app.server)
        .get('/orders/ghost-order')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(404)
    })
  })

  // ── PATCH /orders/:id/status ──────────────────────────────────────────────

  describe('PATCH /orders/:id/status', () => {
    it('ORD-07 — admin advances order status and logs the change', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([{ action: 'update', subject: 'order' }])
      // service calls findUnique first to get the full order for notifications
      prisma.order.findUnique.mockResolvedValueOnce(makeOrder({ status: 'BAKING' }))
      const updatedOrder = makeOrder({ status: 'BAKING' })
      prisma.order.update.mockResolvedValueOnce(updatedOrder)

      const token = adminToken(app)
      const res = await supertest(app.server)
        .patch('/orders/order-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'BAKING', note: 'Now baking' })

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('BAKING')
    })

    it('returns 403 for customer trying to update order status', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([])

      const token = customerToken(app)
      const res = await supertest(app.server)
        .patch('/orders/order-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'CONFIRMED' })

      expect(res.status).toBe(403)
    })

    it('ORD-18 — confirming an order still succeeds even when Odoo is unreachable/unconfigured', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([{ action: 'update', subject: 'order' }])
      // 1st findUnique: updateStatus's own lookup. 2nd: syncOrderInvoice's independent lookup.
      prisma.order.findUnique
        .mockResolvedValueOnce(makeOrder({ status: 'CONFIRMED' }))
        .mockResolvedValueOnce(makeOrder({ status: 'CONFIRMED' }))
      prisma.order.update.mockResolvedValueOnce(makeOrder({ status: 'CONFIRMED' }))
      prisma.financeTransaction.findUnique.mockResolvedValueOnce(null)
      prisma.financeAccount.findFirst.mockResolvedValueOnce(null)

      const token = adminToken(app)
      const res = await supertest(app.server)
        .patch('/orders/order-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'CONFIRMED' })

      // The order transition itself must succeed regardless of Odoo's config/availability
      expect(res.status).toBe(200)
      expect(res.body.status).toBe('CONFIRMED')
      expect(res.body.odoo.ok).toBe(false)
      expect(res.body.odoo.error).toMatch(/Odoo is not configured/)
    })

    it('ORD-19 — cancelling a confirmed order restocks items, cancels the commission, and reverses the finance transaction', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([{ action: 'update', subject: 'order' }])
      const orderWithAmbassador = makeOrder({ status: 'CONFIRMED', ambassadorId: 'amb-1', ambassador: makeAmbassador({ status: 'ACTIVE' }) })
      // 1st findUnique: updateStatus's own lookup. 2nd: cancelOrderInvoice's independent lookup.
      prisma.order.findUnique
        .mockResolvedValueOnce(orderWithAmbassador)
        .mockResolvedValueOnce({ id: 'order-1', odooInvoiceId: null, total: 170 })
      prisma.order.update.mockResolvedValueOnce(makeOrder({ status: 'CANCELLED' }))
      prisma.stockMovement.findMany.mockResolvedValueOnce([
        { stockItemId: 'stock-1', quantity: -2, note: 'Order confirmed — Choc Chip Cookies × 2' },
      ])
      prisma.commission.findUnique.mockResolvedValueOnce({ id: 'comm-1', orderId: 'order-1', status: 'PENDING' })
      prisma.financeTransaction.findUnique.mockResolvedValueOnce({
        id: 'txn-1', orderId: 'order-1', amount: 170, category: 'Product Sales', accountId: 'acct-1',
      })

      const token = adminToken(app)
      const res = await supertest(app.server)
        .patch('/orders/order-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'CANCELLED' })

      expect(res.status).toBe(200)

      // Stock restored via a new ADJUSTMENT_IN movement + incremented currentStock
      expect(prisma.stockMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ stockItemId: 'stock-1', type: 'ADJUSTMENT_IN', quantity: 2 }),
      })
      expect(prisma.stockItem.update).toHaveBeenCalledWith({
        where: { id: 'stock-1' },
        data: { currentStock: { increment: 2 } },
      })

      // Commission cancelled, not deleted
      expect(prisma.commission.update).toHaveBeenCalledWith({ where: { orderId: 'order-1' }, data: { status: 'CANCELLED' } })

      // Original income transaction reversed with a negative offsetting entry, not deleted
      expect(prisma.financeTransaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ type: 'INCOME', amount: -170, accountId: 'acct-1' }),
      })
    })

    it('ORD-19b — confirming an order deducts stock by quantity × the variant\'s unitsPerPack, not quantity alone', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([{ action: 'update', subject: 'order' }])
      const orderWithPackedVariant = makeOrder({
        status: 'PENDING',
        items: [{
          id: 'item-1', variantId: 'variant-1', quantity: 2, unitPrice: 65, subtotal: 130,
          variant: {
            id: 'variant-1', name: '6 Pack', unitsPerPack: 6, odooProductId: null, odooProductReference: null,
            product: { id: 'product-1', name: 'Classic Vanilla Scones', classification: 'SELLABLE', stockItem: { id: 'stock-1' } },
          },
        }],
      })
      prisma.order.findUnique
        .mockResolvedValueOnce(orderWithPackedVariant)
        .mockResolvedValueOnce(orderWithPackedVariant)
      prisma.order.update.mockResolvedValueOnce(makeOrder({ status: 'CONFIRMED' }))
      prisma.financeTransaction.findUnique.mockResolvedValueOnce(null)
      prisma.financeAccount.findFirst.mockResolvedValueOnce(null)

      const token = adminToken(app)
      const res = await supertest(app.server)
        .patch('/orders/order-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'CONFIRMED' })

      expect(res.status).toBe(200)
      // 2 packs × 6 units per pack = 12 individual stock units, not 2.
      expect(prisma.stockMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ stockItemId: 'stock-1', type: 'ORDER_FULFILLMENT', quantity: -12 }),
      })
      expect(prisma.stockItem.update).toHaveBeenCalledWith({
        where: { id: 'stock-1' },
        data: { currentStock: { decrement: 12 } },
      })
    })

    it('ORD-20 — cancelling an order that was never confirmed touches no stock/commission/finance', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([{ action: 'update', subject: 'order' }])
      prisma.order.findUnique
        .mockResolvedValueOnce(makeOrder({ status: 'PENDING' }))
        .mockResolvedValueOnce({ id: 'order-1', odooInvoiceId: null, total: 170 })
      prisma.order.update.mockResolvedValueOnce(makeOrder({ status: 'CANCELLED' }))
      prisma.stockMovement.findMany.mockResolvedValueOnce([]) // never confirmed — nothing was deducted
      prisma.commission.findUnique.mockResolvedValueOnce(null)
      prisma.financeTransaction.findUnique.mockResolvedValueOnce(null)

      const token = adminToken(app)
      const res = await supertest(app.server)
        .patch('/orders/order-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'CANCELLED' })

      expect(res.status).toBe(200)
      expect(prisma.stockMovement.create).not.toHaveBeenCalled()
      expect(prisma.commission.update).not.toHaveBeenCalled()
      expect(prisma.financeTransaction.create).not.toHaveBeenCalled()
    })

    it('ORD-22 — confirming with fulfillmentMode BAKE for a recipe-backed item skips stock deduction, creates a linked ProductionRun, and lands on BAKING', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([{ action: 'update', subject: 'order' }])
      const bakeOrder = makeOrder({
        status: 'PENDING',
        items: [{
          id: 'item-1', variantId: 'variant-1', quantity: 2, unitPrice: 65, subtotal: 130,
          variant: {
            id: 'variant-1', name: '6 Pack', unitsPerPack: 6, odooProductId: null, odooProductReference: null,
            product: { id: 'product-1', name: 'Scones', classification: 'SELLABLE', stockItem: { id: 'stock-1' } },
          },
        }],
      })
      prisma.order.findUnique
        .mockResolvedValueOnce(bakeOrder) // updateStatus's own lookup
        .mockResolvedValueOnce(makeOrder({ status: 'CONFIRMED' })) // syncOrderInvoice's independent lookup
      prisma.recipe.findMany.mockResolvedValueOnce([{ id: 'recipe-1', outputProductId: 'product-1', yieldPerBatch: 40 }])
      prisma.order.update
        .mockResolvedValueOnce(makeOrder({ status: 'CONFIRMED' })) // CONFIRMED transition
        .mockResolvedValueOnce({}) // syncOrderInvoice persisting its own FAILED status (Odoo unconfigured) — return value unused
        .mockResolvedValueOnce(makeOrder({ status: 'BAKING' }))    // bake-kickoff transition
      prisma.productionRun.create.mockResolvedValueOnce({ id: 'run-1' })
      prisma.financeTransaction.findUnique.mockResolvedValueOnce(null)
      prisma.financeAccount.findFirst.mockResolvedValueOnce(null)

      const token = adminToken(app)
      const res = await supertest(app.server)
        .patch('/orders/order-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'CONFIRMED', fulfillmentMode: 'BAKE' })

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('BAKING')

      // 2 × 6-per-pack = 12 needed; recipe yields 40/batch → 1 batch, not deducted from stock yet.
      expect(prisma.productionRun.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ recipeId: 'recipe-1', batches: 1, orderId: 'order-1', status: 'PLANNED' }),
      })
      expect(prisma.stockMovement.create).not.toHaveBeenCalled()
      expect(prisma.stockItem.update).not.toHaveBeenCalled()
    })

    it('ORD-23 — a mixed order in BAKE mode deducts only the item with no recipe, and bakes the recipe-backed one', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([{ action: 'update', subject: 'order' }])
      const mixedOrder = makeOrder({
        status: 'PENDING',
        items: [
          {
            id: 'item-1', variantId: 'variant-1', quantity: 2, unitPrice: 65, subtotal: 130,
            variant: {
              id: 'variant-1', name: '6 Pack', unitsPerPack: 6, odooProductId: null, odooProductReference: null,
              product: { id: 'product-1', name: 'Scones', classification: 'SELLABLE', stockItem: { id: 'stock-1' } },
            },
          },
          {
            id: 'item-2', variantId: 'variant-2', quantity: 3, unitPrice: 20, subtotal: 60,
            variant: {
              id: 'variant-2', name: 'Single', unitsPerPack: 1, odooProductId: null, odooProductReference: null,
              product: { id: 'product-2', name: 'Bottled Juice', classification: 'SELLABLE', stockItem: { id: 'stock-2' } },
            },
          },
        ],
      })
      prisma.order.findUnique
        .mockResolvedValueOnce(mixedOrder)
        .mockResolvedValueOnce(makeOrder({ status: 'CONFIRMED' }))
      // Only product-1 (Scones) has an active recipe — product-2 (Juice) has none, so it
      // falls back to immediate stock deduction even though the order is in BAKE mode.
      prisma.recipe.findMany.mockResolvedValueOnce([{ id: 'recipe-1', outputProductId: 'product-1', yieldPerBatch: 40 }])
      prisma.order.update
        .mockResolvedValueOnce(makeOrder({ status: 'CONFIRMED' }))
        .mockResolvedValueOnce({}) // syncOrderInvoice persisting its own FAILED status (Odoo unconfigured) — return value unused
        .mockResolvedValueOnce(makeOrder({ status: 'BAKING' }))
      prisma.productionRun.create.mockResolvedValueOnce({ id: 'run-1' })
      prisma.financeTransaction.findUnique.mockResolvedValueOnce(null)
      prisma.financeAccount.findFirst.mockResolvedValueOnce(null)

      const token = adminToken(app)
      const res = await supertest(app.server)
        .patch('/orders/order-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'CONFIRMED', fulfillmentMode: 'BAKE' })

      expect(res.status).toBe(200)
      expect(prisma.productionRun.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ recipeId: 'recipe-1', orderId: 'order-1' }),
      })
      // Juice (no recipe) deducted immediately — 3 × 1 = 3 units.
      expect(prisma.stockMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ stockItemId: 'stock-2', type: 'ORDER_FULFILLMENT', quantity: -3 }),
      })
      expect(prisma.stockItem.update).toHaveBeenCalledWith({
        where: { id: 'stock-2' },
        data: { currentStock: { decrement: 3 } },
      })
      // Scones (has recipe) not deducted at all.
      expect(prisma.stockMovement.create).not.toHaveBeenCalledWith({
        data: expect.objectContaining({ stockItemId: 'stock-1' }),
      })
    })

    it('ORD-24 — a made-to-order product with no StockItem yet is still recognised as bakeable (regression: found by end-to-end testing — a fresh SELLABLE product never gets an auto-created StockItem, only a lazily-created one on first packaging, so bakeability must not require one)', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([{ action: 'update', subject: 'order' }])
      const bakeOrder = makeOrder({
        status: 'PENDING',
        items: [{
          id: 'item-1', variantId: 'variant-1', quantity: 1, unitPrice: 65, subtotal: 65,
          variant: {
            id: 'variant-1', name: 'Half Dozen', unitsPerPack: 6, odooProductId: null, odooProductReference: null,
            product: { id: 'product-1', name: 'Scones', classification: 'SELLABLE', stockItem: null },
          },
        }],
      })
      prisma.order.findUnique
        .mockResolvedValueOnce(bakeOrder)
        .mockResolvedValueOnce(makeOrder({ status: 'CONFIRMED' }))
      prisma.recipe.findMany.mockResolvedValueOnce([{ id: 'recipe-1', outputProductId: 'product-1', yieldPerBatch: 12 }])
      prisma.order.update
        .mockResolvedValueOnce(makeOrder({ status: 'CONFIRMED' }))
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce(makeOrder({ status: 'BAKING' }))
      prisma.productionRun.create.mockResolvedValueOnce({ id: 'run-1' })
      prisma.financeTransaction.findUnique.mockResolvedValueOnce(null)
      prisma.financeAccount.findFirst.mockResolvedValueOnce(null)

      const token = adminToken(app)
      const res = await supertest(app.server)
        .patch('/orders/order-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'CONFIRMED', fulfillmentMode: 'BAKE' })

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('BAKING')
      expect(prisma.productionRun.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ recipeId: 'recipe-1', orderId: 'order-1' }),
      })
    })
  })

  // ── POST /orders/:id/payment ───────────────────────────────────────────────

  describe('POST /orders/:id/payment', () => {
    it('ORD-21 — admin records a cash payment', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([{ action: 'update', subject: 'order' }])
      prisma.order.findUnique
        .mockResolvedValueOnce(makeOrder({ status: 'CONFIRMED' })) // recordPayment's own lookup
        .mockResolvedValueOnce(makeOrder({ status: 'CONFIRMED', paymentStatus: 'PAID' })) // syncOrderInvoice's lookup
      prisma.order.update.mockResolvedValueOnce(makeOrder({ status: 'CONFIRMED', paymentMethod: 'CASH', paymentStatus: 'PAID' }))

      const token = adminToken(app)
      const res = await supertest(app.server)
        .post('/orders/order-1/payment')
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'CASH' })

      expect(res.status).toBe(200)
      expect(res.body.paymentStatus).toBe('PAID')
      expect(res.body.odoo).toBeDefined() // Odoo isn't configured in this test env — still returns a result, not a thrown error
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: expect.objectContaining({ paymentMethod: 'CASH', paymentStatus: 'PAID', paymentRef: null }),
      })
    })

    it('rejects an invalid payment method', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([{ action: 'update', subject: 'order' }])

      const token = adminToken(app)
      const res = await supertest(app.server)
        .post('/orders/order-1/payment')
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'BITCOIN' })

      expect(res.status).toBe(400)
    })

    it('returns 403 for a customer attempting to record a payment', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([])

      const token = customerToken(app)
      const res = await supertest(app.server)
        .post('/orders/order-1/payment')
        .set('Authorization', `Bearer ${token}`)
        .send({ method: 'CASH' })

      expect(res.status).toBe(403)
    })
  })

  // ── PATCH /orders/:id ─────────────────────────────────────────────────────

  describe('PATCH /orders/:id (admin edit order fields)', () => {
    it('ORD-11 — admin updates order notes and delivery fee', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PERMISSION])
      prisma.order.findUnique.mockResolvedValueOnce(makeOrder()) // service checks order exists first
      const updated = makeOrder({ notes: 'Leave at gate', deliveryFee: 50 })
      prisma.order.update.mockResolvedValueOnce(updated)

      const token = adminToken(app)
      const res = await supertest(app.server)
        .patch('/orders/order-1')
        .set('Authorization', `Bearer ${token}`)
        .send({ notes: 'Leave at gate', deliveryFee: 50 })

      expect(res.status).toBe(200)
      expect(res.body.notes).toBe('Leave at gate')
    })
  })

  // ── POST /orders/:id/odoo-invoice/retry ───────────────────────────────────

  describe('POST /orders/:id/odoo-invoice/retry', () => {
    it('admin can retry the Odoo invoice sync', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PERMISSION])
      prisma.order.findUnique.mockResolvedValueOnce(makeOrder({ status: 'CONFIRMED' }))

      const token = adminToken(app)
      const res = await supertest(app.server)
        .post('/orders/order-1/odoo-invoice/retry')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(false) // Odoo isn't configured in the test env
      expect(res.body.error).toMatch(/Odoo is not configured/)
    })

    it('returns 403 for a customer attempting to retry', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([])

      const token = customerToken(app)
      const res = await supertest(app.server)
        .post('/orders/order-1/odoo-invoice/retry')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(403)
    })
  })

  // ── PUT /orders/:id/items ─────────────────────────────────────────────────

  describe('PUT /orders/:id/items', () => {
    it('ORD-14 — admin replaces all order items', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PERMISSION])
      // updateItems: findUnique to get order + ambassador tier
      prisma.order.findUnique.mockResolvedValueOnce(makeOrder({ ambassador: null }))
      // price lookup per item
      prisma.productVariant.findUnique.mockResolvedValueOnce({
        ...variantWithPrice,
        prices: [{ tier: 'RETAIL', price: 85 }],
      })
      // $transaction mocks (deleteMany, create, order.update)
      prisma.orderItem.deleteMany.mockResolvedValueOnce({ count: 1 })
      prisma.orderItem.create.mockResolvedValueOnce({})
      prisma.order.update.mockResolvedValueOnce(makeOrder())
      // getById called after transaction
      prisma.order.findUnique.mockResolvedValueOnce(makeOrder())

      const token = adminToken(app)
      const res = await supertest(app.server)
        .put('/orders/order-1/items')
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [{ variantId: 'variant-1', quantity: 3 }] })

      expect(res.status).toBe(200)
    })
  })
})
