import supertest from 'supertest'
import { buildTestApp, customerToken } from './helpers/build-test-app'
import { createMockPrisma, makeUser, CUSTOMER_ROLE } from './helpers/mock-prisma'

// Mock bcrypt so we never run real hashing in tests
jest.mock('bcryptjs', () => ({
  hash:    jest.fn().mockResolvedValue('$hashed$'),
  compare: jest.fn().mockResolvedValue(true),
}))

// Silence notification side-effects
jest.mock('../../shared/services/notify.service', () => ({
  sendOrderStatusEmail:    jest.fn().mockResolvedValue(undefined),
  sendOrderStatusWhatsApp: jest.fn().mockResolvedValue(undefined),
}), { virtual: true })

describe('Auth routes', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  let prisma: ReturnType<typeof createMockPrisma>

  beforeEach(async () => {
    prisma = createMockPrisma()
    app = await buildTestApp(prisma)
  })

  afterEach(async () => {
    await app.close()
  })

  // ── POST /auth/register ────────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    const validBody = {
      email: 'new@example.com',
      password: 'Password1!',
      firstName: 'New',
      lastName: 'User',
    }

    it('AUTH-01 — registers a new customer and returns a JWT', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null)          // no existing user
      prisma.role.findUnique.mockResolvedValueOnce(CUSTOMER_ROLE) // CUSTOMER role exists
      prisma.user.create.mockResolvedValueOnce(
        makeUser({ email: validBody.email, roles: [{ role: CUSTOMER_ROLE }] })
      )

      const res = await supertest(app.server)
        .post('/auth/register')
        .send(validBody)

      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('token')
      expect(res.body.user.email).toBe(validBody.email)
    })

    it('AUTH-09 — returns 409 when email is already registered', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(makeUser({ email: validBody.email }))

      const res = await supertest(app.server)
        .post('/auth/register')
        .send(validBody)

      expect(res.status).toBe(409)
      expect(res.body.message).toMatch(/already in use/i)
    })

    it('AUTH-10 — returns 400 when email is invalid', async () => {
      const res = await supertest(app.server)
        .post('/auth/register')
        .send({ ...validBody, email: 'not-an-email' })

      expect(res.status).toBe(400)
    })

    it('AUTH-10 — returns 400 when password is fewer than 8 chars', async () => {
      const res = await supertest(app.server)
        .post('/auth/register')
        .send({ ...validBody, password: 'short' })

      expect(res.status).toBe(400)
    })

    it('AUTH-10 — returns 400 when firstName is missing', async () => {
      const { firstName: _removed, ...body } = validBody
      const res = await supertest(app.server)
        .post('/auth/register')
        .send(body)

      expect(res.status).toBe(400)
    })
  })

  // ── POST /auth/login ───────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('AUTH-02 — returns a token on correct credentials', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(
        makeUser({ email: 'test@example.com' })
      )

      const res = await supertest(app.server)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'Password1!' })

      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty('token')
      expect(res.body.user.email).toBe('test@example.com')
    })

    it('AUTH-03 — returns 401 when password is wrong', async () => {
      const bcrypt = require('bcryptjs')
      bcrypt.compare.mockResolvedValueOnce(false) // override: wrong password

      prisma.user.findUnique.mockResolvedValueOnce(makeUser())

      const res = await supertest(app.server)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'wrongpass' })

      expect(res.status).toBe(401)
    })

    it('AUTH-04 — returns 401 for unknown email', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null)

      const res = await supertest(app.server)
        .post('/auth/login')
        .send({ email: 'nobody@example.com', password: 'Password1!' })

      expect(res.status).toBe(401)
    })

    it('AUTH-05 — returns 403 when account is SUSPENDED', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(makeUser({ status: 'SUSPENDED' }))

      const res = await supertest(app.server)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'Password1!' })

      expect(res.status).toBe(403)
      expect(res.body.message).toMatch(/suspended/i)
    })
  })

  // ── GET /auth/me ──────────────────────────────────────────────────────────

  describe('GET /auth/me', () => {
    it('AUTH-11 — returns the authenticated user profile', async () => {
      const user = makeUser()
      prisma.user.findUnique.mockResolvedValueOnce(user)

      const token = customerToken(app)
      const res = await supertest(app.server)
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.id).toBe(user.id)
    })

    it('AUTH-06 — returns 401 with no token', async () => {
      const res = await supertest(app.server).get('/auth/me')
      expect(res.status).toBe(401)
    })

    it('AUTH-08 — returns 401 with a malformed token', async () => {
      const res = await supertest(app.server)
        .get('/auth/me')
        .set('Authorization', 'Bearer not.a.real.token')
      expect(res.status).toBe(401)
    })
  })

  // ── PATCH /auth/me ────────────────────────────────────────────────────────

  describe('PATCH /auth/me', () => {
    it('updates own profile fields', async () => {
      const updated = makeUser({ firstName: 'Updated' })
      prisma.user.update.mockResolvedValueOnce(updated)

      const token = customerToken(app)
      const res = await supertest(app.server)
        .patch('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'Updated' })

      expect(res.status).toBe(200)
      expect(res.body.firstName).toBe('Updated')
    })

    it('returns 401 without token', async () => {
      const res = await supertest(app.server)
        .patch('/auth/me')
        .send({ firstName: 'Hacker' })
      expect(res.status).toBe(401)
    })
  })
})
