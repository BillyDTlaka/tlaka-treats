import supertest from 'supertest'
import { buildTestApp, adminToken, customerToken } from './helpers/build-test-app'
import { createMockPrisma, makeProduct, ADMIN_PERMISSION } from './helpers/mock-prisma'

jest.mock('bcryptjs', () => ({ hash: jest.fn(), compare: jest.fn() }))

describe('Product routes', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  let prisma: ReturnType<typeof createMockPrisma>

  beforeEach(async () => {
    prisma = createMockPrisma()
    app = await buildTestApp(prisma)
  })

  afterEach(async () => { await app.close() })

  // ── GET /products ──────────────────────────────────────────────────────────

  describe('GET /products', () => {
    it('PROD-01 — returns active products with RETAIL pricing by default', async () => {
      const products = [makeProduct()]
      prisma.product.findMany.mockResolvedValueOnce(products)

      const res = await supertest(app.server).get('/products')

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(1)
      expect(res.body[0].name).toBe('Choc Chip Cookies')
    })

    it('PROD-02 — accepts tier=AMBASSADOR query param', async () => {
      const ambProduct = makeProduct({
        variants: [{ id: 'v1', name: '12 Pack', isActive: true, prices: [{ tier: 'AMBASSADOR', price: 70 }] }],
      })
      prisma.product.findMany.mockResolvedValueOnce([ambProduct])

      const res = await supertest(app.server).get('/products?tier=AMBASSADOR')

      expect(res.status).toBe(200)
      expect(res.body[0].variants[0].prices[0].tier).toBe('AMBASSADOR')
    })

    it('returns empty array when no active products', async () => {
      prisma.product.findMany.mockResolvedValueOnce([])

      const res = await supertest(app.server).get('/products')

      expect(res.status).toBe(200)
      expect(res.body).toEqual([])
    })
  })

  // ── GET /products/:id ─────────────────────────────────────────────────────

  describe('GET /products/:id', () => {
    it('PROD-07 — returns product detail by id', async () => {
      prisma.product.findUnique.mockResolvedValueOnce(makeProduct())

      const res = await supertest(app.server).get('/products/product-1')

      expect(res.status).toBe(200)
      expect(res.body.id).toBe('product-1')
    })

    it('PROD-08 — returns 404 for unknown product', async () => {
      prisma.product.findUnique.mockResolvedValueOnce(null)

      const res = await supertest(app.server).get('/products/does-not-exist')

      expect(res.status).toBe(404)
    })
  })

  // ── GET /products/admin ────────────────────────────────────────────────────

  describe('GET /products/admin', () => {
    it('PROD-04 — admin sees all products including inactive', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PERMISSION])
      prisma.product.findMany.mockResolvedValueOnce([
        makeProduct({ isActive: true }),
        makeProduct({ id: 'product-2', name: 'Old Product', isActive: false }),
      ])

      const token = adminToken(app)
      const res = await supertest(app.server)
        .get('/products/admin')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(2)
    })

    it('PROD-03 — customer cannot access admin product list (403)', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([]) // no permissions

      const token = customerToken(app)
      const res = await supertest(app.server)
        .get('/products/admin')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(403)
    })

    it('returns 401 without token', async () => {
      const res = await supertest(app.server).get('/products/admin')
      expect(res.status).toBe(401)
    })
  })

  // ── POST /products ─────────────────────────────────────────────────────────

  describe('POST /products', () => {
    const newProduct = {
      name: 'Lemon Scones',
      description: 'Fresh lemon scones',
      category: 'Scones',
      variants: [
        { name: '6 Pack', prices: [{ tier: 'RETAIL', price: 65 }, { tier: 'AMBASSADOR', price: 55 }] },
      ],
    }

    it('PROD-09 — admin creates a product with variants', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PERMISSION])
      const created = makeProduct({ name: 'Lemon Scones' })
      prisma.product.create.mockResolvedValueOnce(created)

      const token = adminToken(app)
      const res = await supertest(app.server)
        .post('/products')
        .set('Authorization', `Bearer ${token}`)
        .send(newProduct)

      expect(res.status).toBe(201)
      expect(res.body.name).toBe('Lemon Scones')
    })

    it('PROD-03 — customer cannot create products (403)', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([])

      const token = customerToken(app)
      const res = await supertest(app.server)
        .post('/products')
        .set('Authorization', `Bearer ${token}`)
        .send(newProduct)

      expect(res.status).toBe(403)
    })

    it('returns 401 without token', async () => {
      const res = await supertest(app.server).post('/products').send(newProduct)
      expect(res.status).toBe(401)
    })
  })

  // ── PATCH /products/:id ───────────────────────────────────────────────────

  describe('PATCH /products/:id', () => {
    it('PROD-11 — admin updates product details', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([{ action: 'update', subject: 'product' }])
      prisma.product.findUnique.mockResolvedValueOnce(makeProduct()) // service checks existence first
      const updated = makeProduct({ name: 'Updated Name' })
      prisma.product.update.mockResolvedValueOnce(updated)

      const token = adminToken(app)
      const res = await supertest(app.server)
        .patch('/products/product-1')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name' })

      expect(res.status).toBe(200)
      expect(res.body.name).toBe('Updated Name')
    })
  })

  // ── POST /products/:id/variants ───────────────────────────────────────────

  describe('POST /products/:id/variants', () => {
    it('PROD-10 — admin adds a variant to an existing product', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([{ action: 'update', subject: 'product' }])
      prisma.product.findUnique.mockResolvedValueOnce(makeProduct()) // service checks product exists
      const newVariant = { id: 'variant-2', name: '24 Pack', isActive: true, prices: [] }
      prisma.productVariant.create.mockResolvedValueOnce(newVariant)

      const token = adminToken(app)
      const res = await supertest(app.server)
        .post('/products/product-1/variants')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '24 Pack', prices: [{ tier: 'RETAIL', price: 150 }] })

      expect(res.status).toBe(201)
      expect(res.body.name).toBe('24 Pack')
    })
  })
})
