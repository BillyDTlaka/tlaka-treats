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
