import supertest from 'supertest'
import { buildTestApp, adminToken, customerToken, ambassadorToken } from './helpers/build-test-app'
import {
  createMockPrisma,
  makeUser,
  makeAmbassador,
  ADMIN_PERMISSION,
  AMB_ROLE,
} from './helpers/mock-prisma'

jest.mock('bcryptjs', () => ({ hash: jest.fn(), compare: jest.fn() }))

describe('Ambassador routes', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  let prisma: ReturnType<typeof createMockPrisma>

  beforeEach(async () => {
    prisma = createMockPrisma()
    app = await buildTestApp(prisma)
  })

  afterEach(async () => { await app.close() })

  // ── POST /ambassadors/apply ───────────────────────────────────────────────

  describe('POST /ambassadors/apply', () => {
    it('AMB-01 — customer creates a PENDING ambassador application', async () => {
      prisma.ambassador.findUnique.mockResolvedValueOnce(null) // no existing application
      prisma.user.findUnique.mockResolvedValueOnce(makeUser({ firstName: 'Zanele' }))
      prisma.ambassador.create.mockResolvedValueOnce(makeAmbassador({ status: 'PENDING' }))

      const token = customerToken(app, 'user-1')
      const res = await supertest(app.server)
        .post('/ambassadors/apply')
        .set('Authorization', `Bearer ${token}`)
        .send({ bio: 'I love baked goods!' })

      expect(res.status).toBe(201)
      expect(res.body.status).toBe('PENDING')
    })

    it('AMB-02 — returns 409 if user has already applied', async () => {
      prisma.ambassador.findUnique.mockResolvedValueOnce(makeAmbassador())

      const token = customerToken(app, 'user-1')
      const res = await supertest(app.server)
        .post('/ambassadors/apply')
        .set('Authorization', `Bearer ${token}`)
        .send({})

      expect(res.status).toBe(409)
      expect(res.body.message).toMatch(/already applied/i)
    })

    it('returns 401 without token', async () => {
      const res = await supertest(app.server).post('/ambassadors/apply').send({})
      expect(res.status).toBe(401)
    })
  })

  // ── POST /ambassadors/admin/create ────────────────────────────────────────

  describe('POST /ambassadors/admin/create', () => {
    it('AMB-03 — admin creates an ACTIVE ambassador immediately', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PERMISSION])
      prisma.user.findUnique.mockResolvedValueOnce(makeUser({ firstName: 'Sibusiso' }))
      prisma.ambassador.findUnique.mockResolvedValueOnce(null)
      prisma.ambassador.create.mockResolvedValueOnce(
        makeAmbassador({ status: 'ACTIVE', kycStatus: 'APPROVED' })
      )
      prisma.role.findUnique.mockResolvedValueOnce(AMB_ROLE)
      prisma.userRole.upsert.mockResolvedValueOnce({})

      const token = adminToken(app)
      const res = await supertest(app.server)
        .post('/ambassadors/admin/create')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'sibusiso@example.com', commissionRate: 0.12 })

      expect(res.status).toBe(201)
      expect(res.body.status).toBe('ACTIVE')
    })

    it('AMB-03 — returns 404 when user not found', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PERMISSION])
      prisma.user.findUnique.mockResolvedValueOnce(null)

      const token = adminToken(app)
      const res = await supertest(app.server)
        .post('/ambassadors/admin/create')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'ghost@example.com' })

      expect(res.status).toBe(404)
    })

    it('returns 409 if user is already an ambassador', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PERMISSION])
      prisma.user.findUnique.mockResolvedValueOnce(makeUser())
      prisma.ambassador.findUnique.mockResolvedValueOnce(makeAmbassador()) // already exists

      const token = adminToken(app)
      const res = await supertest(app.server)
        .post('/ambassadors/admin/create')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'test@example.com' })

      expect(res.status).toBe(409)
    })

    it('returns 403 for non-admin user', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([])

      const token = customerToken(app)
      const res = await supertest(app.server)
        .post('/ambassadors/admin/create')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'test@example.com' })

      expect(res.status).toBe(403)
    })
  })

  // ── GET /ambassadors/active ───────────────────────────────────────────────

  describe('GET /ambassadors/active', () => {
    it('AMB-10 — returns only ACTIVE ambassadors for checkout picker', async () => {
      prisma.ambassador.findMany.mockResolvedValueOnce([
        { id: 'amb-1', code: 'TT-ZANE1234', user: { firstName: 'Zanele', lastName: 'Mokoena' } },
      ])

      const token = customerToken(app)
      const res = await supertest(app.server)
        .get('/ambassadors/active')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body[0].code).toBe('TT-ZANE1234')
    })

    it('returns 401 without token', async () => {
      const res = await supertest(app.server).get('/ambassadors/active')
      expect(res.status).toBe(401)
    })
  })

  // ── GET /ambassadors ──────────────────────────────────────────────────────

  describe('GET /ambassadors (admin list)', () => {
    it('admin gets all ambassadors with earnings summary', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PERMISSION])
      prisma.ambassador.findMany.mockResolvedValueOnce([
        makeAmbassador({ status: 'ACTIVE', _count: { orders: 5, commissions: 5 }, commissions: [] }),
      ])

      const token = adminToken(app)
      const res = await supertest(app.server)
        .get('/ambassadors')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body).toHaveLength(1)
    })

    it('customer cannot list ambassadors (403)', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([])

      const token = customerToken(app)
      const res = await supertest(app.server)
        .get('/ambassadors')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(403)
    })
  })

  // ── GET /ambassadors/me ───────────────────────────────────────────────────

  describe('GET /ambassadors/me', () => {
    it('AMB-11 — ambassador views own profile and recent commissions', async () => {
      const amb = makeAmbassador({
        status: 'ACTIVE',
        commissions: [],
        _count: { orders: 3, commissions: 3 },
      })
      prisma.ambassador.findUnique.mockResolvedValueOnce(amb)

      const token = ambassadorToken(app, 'user-1')
      const res = await supertest(app.server)
        .get('/ambassadors/me')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(200)
      expect(res.body.code).toBe('TT-TEST1234')
    })

    it('returns 404 when user is not an ambassador', async () => {
      prisma.ambassador.findUnique.mockResolvedValueOnce(null)

      const token = customerToken(app)
      const res = await supertest(app.server)
        .get('/ambassadors/me')
        .set('Authorization', `Bearer ${token}`)

      expect(res.status).toBe(404)
    })
  })

  // ── PATCH /ambassadors/:id/status ─────────────────────────────────────────

  describe('PATCH /ambassadors/:id/status', () => {
    it('AMB-08 — admin suspends an ambassador', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PERMISSION])
      const updated = makeAmbassador({ status: 'SUSPENDED' })
      prisma.ambassador.update.mockResolvedValueOnce({ ...updated, user: makeUser() })

      const token = adminToken(app)
      const res = await supertest(app.server)
        .patch('/ambassadors/amb-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'SUSPENDED', note: 'Violation of terms' })

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('SUSPENDED')
    })

    it('AMB-08 — admin activates ambassador and grants AMBASSADOR role', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PERMISSION])
      const updated = makeAmbassador({ status: 'ACTIVE' })
      prisma.ambassador.update.mockResolvedValueOnce({ ...updated, user: makeUser(), userId: 'user-1' })
      prisma.role.findUnique.mockResolvedValueOnce(AMB_ROLE)
      prisma.userRole.upsert.mockResolvedValueOnce({})

      const token = adminToken(app)
      const res = await supertest(app.server)
        .patch('/ambassadors/amb-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'ACTIVE' })

      expect(res.status).toBe(200)
      expect(prisma.userRole.upsert).toHaveBeenCalledTimes(1)
    })

    it('returns 403 for customer trying to change status', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([])

      const token = customerToken(app)
      const res = await supertest(app.server)
        .patch('/ambassadors/amb-1/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'ACTIVE' })

      expect(res.status).toBe(403)
    })
  })

  // ── PATCH /ambassadors/:id/kyc ────────────────────────────────────────────

  describe('PATCH /ambassadors/:id/kyc (ambassador submits KYC)', () => {
    const validKyc = {
      phone: '0821234567',
      address: '123 Main St, Joburg',
      idType: 'South African ID',
      idNumber: '9001015800085',
      idDocumentUrl: 'https://storage.example.com/doc.pdf',
    }

    it('AMB-05 — ambassador submits KYC and status becomes SUBMITTED', async () => {
      prisma.ambassador.findUnique.mockResolvedValueOnce(
        makeAmbassador({ userId: 'amb-user-1', kycStatus: 'NOT_SUBMITTED' })
      )
      const updated = makeAmbassador({ kycStatus: 'SUBMITTED' })
      prisma.ambassador.update.mockResolvedValueOnce(updated)

      const token = ambassadorToken(app, 'amb-user-1')
      const res = await supertest(app.server)
        .patch('/ambassadors/amb-1/kyc')
        .set('Authorization', `Bearer ${token}`)
        .send(validKyc)

      expect(res.status).toBe(200)
      expect(res.body.kycStatus).toBe('SUBMITTED')
    })

    it('returns 403 if ambassador record belongs to a different user', async () => {
      prisma.ambassador.findUnique.mockResolvedValueOnce(
        makeAmbassador({ userId: 'another-user' }) // owned by different user
      )

      const token = ambassadorToken(app, 'amb-user-1')
      const res = await supertest(app.server)
        .patch('/ambassadors/amb-1/kyc')
        .set('Authorization', `Bearer ${token}`)
        .send(validKyc)

      expect(res.status).toBe(403)
    })

    it('returns 400 if KYC is already APPROVED', async () => {
      prisma.ambassador.findUnique.mockResolvedValueOnce(
        makeAmbassador({ userId: 'amb-user-1', kycStatus: 'APPROVED' })
      )

      const token = ambassadorToken(app, 'amb-user-1')
      const res = await supertest(app.server)
        .patch('/ambassadors/amb-1/kyc')
        .set('Authorization', `Bearer ${token}`)
        .send(validKyc)

      expect(res.status).toBe(400)
      expect(res.body.message).toMatch(/already approved/i)
    })

    it('ERR-10 — returns 400 when required KYC fields are missing', async () => {
      prisma.ambassador.findUnique.mockResolvedValueOnce(
        makeAmbassador({ userId: 'amb-user-1', kycStatus: 'NOT_SUBMITTED' })
      )

      const token = ambassadorToken(app, 'amb-user-1')
      const res = await supertest(app.server)
        .patch('/ambassadors/amb-1/kyc')
        .set('Authorization', `Bearer ${token}`)
        .send({ phone: '0821234567' }) // missing idType, idNumber, idDocumentUrl

      expect(res.status).toBe(400)
    })

    it('returns 404 when ambassador not found', async () => {
      prisma.ambassador.findUnique.mockResolvedValueOnce(null)

      const token = ambassadorToken(app, 'amb-user-1')
      const res = await supertest(app.server)
        .patch('/ambassadors/ghost/kyc')
        .set('Authorization', `Bearer ${token}`)
        .send(validKyc)

      expect(res.status).toBe(404)
    })
  })

  // ── PATCH /ambassadors/:id/kyc/review ─────────────────────────────────────

  describe('PATCH /ambassadors/:id/kyc/review (admin reviews KYC)', () => {
    it('AMB-06 — admin approves KYC', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PERMISSION])
      const updated = makeAmbassador({ kycStatus: 'APPROVED' })
      prisma.ambassador.update.mockResolvedValueOnce({ ...updated, user: makeUser() })

      const token = adminToken(app)
      const res = await supertest(app.server)
        .patch('/ambassadors/amb-1/kyc/review')
        .set('Authorization', `Bearer ${token}`)
        .send({ kycStatus: 'APPROVED' })

      expect(res.status).toBe(200)
      expect(res.body.kycStatus).toBe('APPROVED')
    })

    it('AMB-07 — admin rejects KYC with a note', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PERMISSION])
      const updated = makeAmbassador({ kycStatus: 'REJECTED', kycNote: 'ID expired' })
      prisma.ambassador.update.mockResolvedValueOnce({ ...updated, user: makeUser() })

      const token = adminToken(app)
      const res = await supertest(app.server)
        .patch('/ambassadors/amb-1/kyc/review')
        .set('Authorization', `Bearer ${token}`)
        .send({ kycStatus: 'REJECTED', kycNote: 'ID expired' })

      expect(res.status).toBe(200)
      expect(res.body.kycStatus).toBe('REJECTED')
      expect(res.body.kycNote).toBe('ID expired')
    })

    it('returns 400 when rejecting without a note', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PERMISSION])

      const token = adminToken(app)
      const res = await supertest(app.server)
        .patch('/ambassadors/amb-1/kyc/review')
        .set('Authorization', `Bearer ${token}`)
        .send({ kycStatus: 'REJECTED' }) // no note

      expect(res.status).toBe(400)
      expect(res.body.message).toMatch(/reason is required/i)
    })

    it('returns 400 for invalid kycStatus value', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PERMISSION])

      const token = adminToken(app)
      const res = await supertest(app.server)
        .patch('/ambassadors/amb-1/kyc/review')
        .set('Authorization', `Bearer ${token}`)
        .send({ kycStatus: 'MAYBE' })

      expect(res.status).toBe(400)
    })
  })

  // ── PATCH /ambassadors/:id (admin update details) ─────────────────────────

  describe('PATCH /ambassadors/:id', () => {
    it('AMB-09 — admin updates commission rate', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PERMISSION])
      prisma.ambassador.findFirst.mockResolvedValueOnce(null) // no code conflict
      const updated = makeAmbassador({ commissionRate: 0.15 })
      prisma.ambassador.update.mockResolvedValueOnce({ ...updated, user: makeUser() })

      const token = adminToken(app)
      const res = await supertest(app.server)
        .patch('/ambassadors/amb-1')
        .set('Authorization', `Bearer ${token}`)
        .send({ commissionRate: 0.15 })

      expect(res.status).toBe(200)
      expect(res.body.commissionRate).toBe(0.15)
    })

    it('AMB-04 — returns 409 when referral code is already taken', async () => {
      prisma.permission.findMany.mockResolvedValueOnce([ADMIN_PERMISSION])
      prisma.ambassador.findFirst.mockResolvedValueOnce(makeAmbassador({ id: 'other-amb' })) // conflict

      const token = adminToken(app)
      const res = await supertest(app.server)
        .patch('/ambassadors/amb-1')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'TT-TAKEN123' })

      expect(res.status).toBe(409)
      expect(res.body.message).toMatch(/already in use/i)
    })
  })
})
