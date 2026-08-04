import supertest from 'supertest'
import { buildTestApp } from './helpers/build-test-app'
import { createMockPrisma } from './helpers/mock-prisma'

describe('POST /payments/payfast/notify', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>
  let prisma: ReturnType<typeof createMockPrisma>

  beforeEach(async () => {
    prisma = createMockPrisma()
    app = await buildTestApp(prisma)
  })

  afterEach(async () => { await app.close() })

  function mockPayFastValidate(responseText: string) {
    ;(global as any).fetch = jest.fn(async () => ({ text: async () => responseText }))
  }

  it('marks the order PAID when PayFast confirms the ITN as VALID', async () => {
    mockPayFastValidate('VALID')
    prisma.order.update.mockResolvedValueOnce({})

    const res = await supertest(app.server)
      .post('/payments/payfast/notify')
      .send({ m_payment_id: 'order-1', pf_payment_id: 'pf-123', payment_status: 'COMPLETE' })

    expect(res.status).toBe(200)
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({ paymentStatus: 'PAID', payfastId: 'pf-123' }),
    })
  })

  it('ignores the ITN if PayFast reports it as INVALID — never trusts an unverified callback', async () => {
    mockPayFastValidate('INVALID')

    const res = await supertest(app.server)
      .post('/payments/payfast/notify')
      .send({ m_payment_id: 'order-1', pf_payment_id: 'pf-123', payment_status: 'COMPLETE' })

    // Still always 200 (PayFast requirement — don't trigger their retry logic)
    expect(res.status).toBe(200)
    expect(prisma.order.update).not.toHaveBeenCalled()
  })

  it('fails open (still processes the payment) if PayFast\'s validate endpoint is unreachable', async () => {
    ;(global as any).fetch = jest.fn(async () => { throw new Error('network error') })
    prisma.order.update.mockResolvedValueOnce({})

    const res = await supertest(app.server)
      .post('/payments/payfast/notify')
      .send({ m_payment_id: 'order-1', pf_payment_id: 'pf-123', payment_status: 'COMPLETE' })

    expect(res.status).toBe(200)
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({ paymentStatus: 'PAID' }),
    })
  })

  it('marks the order FAILED when PayFast reports a non-COMPLETE status', async () => {
    mockPayFastValidate('VALID')
    prisma.order.update.mockResolvedValueOnce({})

    const res = await supertest(app.server)
      .post('/payments/payfast/notify')
      .send({ m_payment_id: 'order-1', pf_payment_id: 'pf-123', payment_status: 'CANCELLED' })

    expect(res.status).toBe(200)
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { paymentStatus: 'FAILED', payfastId: 'pf-123' },
    })
  })
})
