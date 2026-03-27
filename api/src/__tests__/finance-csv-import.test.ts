/**
 * Tests: POST /finance/bank-accounts/:id/import-csv
 *
 * Covers:
 *  - Skipping "Balance brought forward" metadata row
 *  - Combining Amount + Fees into a single transaction amount
 *  - Duplicate detection (same bankAccountId + date + amount + description)
 *  - Normal happy-path import
 *  - Footer "Total:" row ignored (no date)
 */
import Fastify, { FastifyInstance } from 'fastify'
import jwt from '@fastify/jwt'
import financeRoutes from '../modules/finance/finance.routes'

// ── Real-world CSV from the user's bank ────────────────────────────────────

const REAL_CSV = `Balance brought forward:,3926.58
Account,Date,Description,Reference,Amount,Fees,Balance,
1051700000,28/02/2026,"Month S/Fee",Month S/Fee,0.00,-50.00,3876.58
1051700000,11/03/2026,"POS Local Purchase",PURCH.DATE 110326 ***** 0000000000005874 Boxer Spr Bronkhorsprt BRONKHORSTSP,-319.28,0.00,3557.30
1051700000,18/03/2026,"Retail Cr Transfer",N MNYAKENI,500.00,0.00,2522.10
Total:,,,,-2013.66,-50.00,1862.92`

// ── Test app builder (finance-only) ────────────────────────────────────────

async function buildFinanceApp(mockPrisma: any): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(jwt, { secret: 'test-secret' })
  app.decorate('prisma', mockPrisma)

  // Bypass auth for tests — just decode token without enforcing permissions
  app.addHook('preHandler', async (req: any) => {
    try { await req.jwtVerify() } catch {}
  })

  await app.register(financeRoutes, { prefix: '/finance' })
  await app.ready()
  return app
}

function makeToken(app: FastifyInstance) {
  return (app as any).jwt.sign({ id: 'admin-1', email: 'admin@test.com', roles: ['ADMIN'] })
}

// ── Mock Prisma ────────────────────────────────────────────────────────────

function makeMockPrisma() {
  return {
    // authorize() middleware queries this — return a permission so the check passes
    permission: { findMany: jest.fn().mockResolvedValue([{ id: 'p1', action: 'manage', subject: 'product' }]) },
    bankAccount:     { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    bankTransaction: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    financeAccount:  { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
    financeTransaction: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), aggregate: jest.fn() },
    commissionPayout:   { findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    expense:            { findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), aggregate: jest.fn() },
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /finance/bank-accounts/:id/import-csv', () => {
  let app: FastifyInstance
  let db: ReturnType<typeof makeMockPrisma>
  const ACCOUNT_ID = 'ba-001'

  beforeEach(async () => {
    db = makeMockPrisma()
    app = await buildFinanceApp(db)
    // Bank account always found
    db.bankAccount.findUnique.mockResolvedValue({ id: ACCOUNT_ID, name: 'FNB Business' })
    // No existing transactions by default (no duplicates)
    db.bankTransaction.findFirst.mockResolvedValue(null)
    // create returns the object passed to it
    db.bankTransaction.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'bt-' + Math.random(), ...data }))
  })

  afterEach(() => app.close())

  // ── Happy path ────────────────────────────────────────────────────────────

  test('CSV-01 — imports correct number of transactions from real bank CSV', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${ACCOUNT_ID}/import-csv`,
      headers: { authorization: `Bearer ${makeToken(app)}` },
      payload: { csv: REAL_CSV },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    // 3 data rows, "Balance brought forward" and "Total:" both skipped
    expect(body.imported).toBe(3)
    expect(body.skipped).toBe(0)
    expect(body.errors).toHaveLength(0)
  })

  // ── Metadata row ─────────────────────────────────────────────────────────

  test('CSV-02 — skips "Balance brought forward" metadata row', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${ACCOUNT_ID}/import-csv`,
      headers: { authorization: `Bearer ${makeToken(app)}` },
      payload: { csv: REAL_CSV },
    })

    expect(res.statusCode).toBe(200)
    // create is called once per real transaction (not for metadata or total rows)
    expect(db.bankTransaction.create).toHaveBeenCalledTimes(3)
  })

  // ── Fees column ──────────────────────────────────────────────────────────

  test('CSV-03 — combines Amount + Fees for service fee rows (Amount=0, Fees=-50)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${ACCOUNT_ID}/import-csv`,
      headers: { authorization: `Bearer ${makeToken(app)}` },
      payload: { csv: REAL_CSV },
    })

    expect(res.statusCode).toBe(200)
    const calls = db.bankTransaction.create.mock.calls.map((c: any) => c[0].data)
    const feeTxn = calls.find((d: any) => d.description === 'Month S/Fee')
    expect(feeTxn).toBeDefined()
    // 0.00 (Amount) + (-50.00) (Fees) = -50
    expect(Number(feeTxn.amount)).toBeCloseTo(-50, 2)
  })

  test('CSV-04 — regular POS transactions keep their amount unchanged', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${ACCOUNT_ID}/import-csv`,
      headers: { authorization: `Bearer ${makeToken(app)}` },
      payload: { csv: REAL_CSV },
    })

    expect(res.statusCode).toBe(200)
    const calls = db.bankTransaction.create.mock.calls.map((c: any) => c[0].data)
    const pos = calls.find((d: any) => d.description === 'POS Local Purchase')
    expect(Number(pos.amount)).toBeCloseTo(-319.28, 2)
  })

  // ── Duplicate detection ───────────────────────────────────────────────────

  test('CSV-05 — skips duplicate transactions already in the database', async () => {
    // Simulate the Month S/Fee already imported
    db.bankTransaction.findFirst.mockImplementation(({ where }: any) => {
      if (where.description === 'Month S/Fee') return Promise.resolve({ id: 'existing' })
      return Promise.resolve(null)
    })

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${ACCOUNT_ID}/import-csv`,
      headers: { authorization: `Bearer ${makeToken(app)}` },
      payload: { csv: REAL_CSV },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.imported).toBe(2) // 3 rows minus 1 duplicate
    expect(body.skipped).toBe(1)
    expect(db.bankTransaction.create).toHaveBeenCalledTimes(2)
  })

  test('CSV-06 — re-uploading the same file imports 0 new and skips all', async () => {
    // All transactions already exist
    db.bankTransaction.findFirst.mockResolvedValue({ id: 'existing' })

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${ACCOUNT_ID}/import-csv`,
      headers: { authorization: `Bearer ${makeToken(app)}` },
      payload: { csv: REAL_CSV },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.imported).toBe(0)
    expect(body.skipped).toBe(3)
    expect(db.bankTransaction.create).not.toHaveBeenCalled()
  })

  // ── Footer row ────────────────────────────────────────────────────────────

  test('CSV-07 — ignores "Total:" summary row at end of CSV', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${ACCOUNT_ID}/import-csv`,
      headers: { authorization: `Bearer ${makeToken(app)}` },
      payload: { csv: REAL_CSV },
    })

    expect(res.statusCode).toBe(200)
    // None of the create calls should have an empty/invalid date row
    const calls = db.bankTransaction.create.mock.calls.map((c: any) => c[0].data)
    expect(calls.every((d: any) => d.date instanceof Date && !isNaN(d.date.getTime()))).toBe(true)
  })

  // ── Error cases ───────────────────────────────────────────────────────────

  test('CSV-08 — returns 404 when bank account not found', async () => {
    db.bankAccount.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/nonexistent/import-csv`,
      headers: { authorization: `Bearer ${makeToken(app)}` },
      payload: { csv: REAL_CSV },
    })

    expect(res.statusCode).toBe(404)
  })

  test('CSV-09 — returns 400 when CSV has no recognisable header', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/finance/bank-accounts/${ACCOUNT_ID}/import-csv`,
      headers: { authorization: `Bearer ${makeToken(app)}` },
      payload: { csv: 'This is not a CSV at all\nNo columns here either' },
    })

    expect(res.statusCode).toBe(400)
  })
})
