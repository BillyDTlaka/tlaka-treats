import supertest from 'supertest'
import { buildTestApp, adminToken, customerToken } from './helpers/build-test-app'
import { createMockPrisma, makeUser, ADMIN_PERMISSION } from './helpers/mock-prisma'

jest.mock('../config', () => ({
  config: { odoo: { url: '', db: '', username: '', apiKey: '', companyName: '', autoCreateProducts: false, deliveryProductRef: '', discountProductRef: '' } },
}))

describe('POST /customers/:id/odoo-sync/retry', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  let prisma: ReturnType<typeof createMockPrisma>

  beforeEach(async () => {
    prisma = createMockPrisma()
    app = await buildTestApp(prisma)
  })

  afterEach(async () => { await app.close() })

  it('admin can trigger a retry; a misconfigured Odoo comes back as ok:false, not an HTTP error', async () => {
    prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PERMISSION])
    prisma.user.findUnique.mockResolvedValueOnce(makeUser({ odooPartnerId: null }))
    prisma.user.update.mockResolvedValue(undefined)

    const token = adminToken(app)
    const res = await supertest(app.server)
      .post('/customers/user-1/odoo-sync/retry')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(false)
    expect(res.body.error).toMatch(/Odoo is not configured/)
  })

  it('returns 404 for an unknown customer', async () => {
    prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PERMISSION])
    prisma.user.findUnique.mockResolvedValueOnce(null)

    const token = adminToken(app)
    const res = await supertest(app.server)
      .post('/customers/ghost/odoo-sync/retry')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(404)
  })

  it('returns 403 for a customer attempting to retry', async () => {
    prisma.permission.findMany.mockResolvedValueOnce([])

    const token = customerToken(app)
    const res = await supertest(app.server)
      .post('/customers/user-1/odoo-sync/retry')
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(403)
  })
})
