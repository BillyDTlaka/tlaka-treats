import { syncCommissionBill, registerCommissionPayment } from '../shared/services/odoo-commission-bill.service'
import { _resetOdooClientCacheForTests } from '../shared/services/odoo-client'
import { _resetBankJournalCacheForTests } from '../shared/services/odoo-invoice.service'
import { _resetAccountIdCacheForTests } from '../shared/services/odoo-product.service'
import { createMockPrisma, makeCommission } from './helpers/mock-prisma'
import { installMockOdoo } from './helpers/mock-odoo'

jest.mock('../config', () => ({
  config: {
    odoo: {
      url: 'https://fake-odoo.test',
      db: 'test-db',
      username: 'bot@test.com',
      apiKey: 'fake-key',
      companyName: 'Tlaka Treats',
      autoCreateProducts: false,
      deliveryProductRef: 'DELIVERY-FEE',
      discountProductRef: 'DISCOUNT',
    },
  },
}))

describe('syncCommissionBill', () => {
  let prisma: ReturnType<typeof createMockPrisma>
  let odoo: ReturnType<typeof installMockOdoo>

  beforeEach(() => {
    prisma = createMockPrisma()
    odoo = installMockOdoo()
    _resetOdooClientCacheForTests()
    _resetBankJournalCacheForTests()
    _resetAccountIdCacheForTests()
    prisma.company.findFirst.mockResolvedValue({ odooCommissionAccountCode: '600010' })
    odoo.accountsByCode.set('600010', { id: 42 })
  })

  it('BILL-01 — no commission on the order is a no-op', async () => {
    prisma.commission.findUnique.mockResolvedValueOnce(null)
    const result = await syncCommissionBill(prisma, 'order-1')
    expect(result).toEqual({ ok: true })
  })

  it('BILL-02 — refuses to bill an order that has not been delivered yet', async () => {
    prisma.commission.findUnique.mockResolvedValueOnce(makeCommission({ order: { id: 'order-1', status: 'CONFIRMED', orderNumber: 'TT-ORD-000001', orderSeq: 1 } }))
    const result = await syncCommissionBill(prisma, 'order-1')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/not DELIVERED/)
  })

  it('BILL-03 — a cancelled commission is never billed', async () => {
    prisma.commission.findUnique.mockResolvedValueOnce(makeCommission({ status: 'CANCELLED' }))
    const result = await syncCommissionBill(prisma, 'order-1')
    expect(result).toEqual({ ok: true })
  })

  it('BILL-04 — creates a draft vendor bill against the ambassador\'s Odoo partner, coded to the configured commission account', async () => {
    prisma.commission.findUnique.mockResolvedValueOnce(makeCommission())

    const result = await syncCommissionBill(prisma, 'order-1')

    expect(result.ok).toBe(true)
    expect(result.action).toBe('CREATED')
    expect(result.state).toBe('draft')
    expect(result.billId).toBeDefined()

    const createCall = (global.fetch as jest.Mock).mock.calls.find((call) => {
      const params = JSON.parse(call[1].body).params
      return params.args?.[3] === 'account.move' && params.args?.[4] === 'create'
    })
    const vals = JSON.parse(createCall![1].body).params.args[5][0]
    expect(vals.move_type).toBe('in_invoice')
    expect(vals.partner_id).toBe(99)
    expect(vals.invoice_line_ids[0][2].account_id).toBe(42)
    expect(vals.invoice_line_ids[0][2].price_unit).toBe(17)

    const updateCalls = prisma.commission.update.mock.calls
    const finalUpdate = updateCalls[updateCalls.length - 1][0]
    expect(finalUpdate.data.odooBillStatus).toBe('DRAFT_CREATED')
    expect(finalUpdate.data.odooBillId).toBe(result.billId)
    // Odoo returns `false` (not null) for the bill number sequence until posting.
    expect(finalUpdate.data.odooBillNumber).toBeNull()
  })

  it('BILL-05 — fails clearly when no commission account code is configured', async () => {
    prisma.company.findFirst.mockResolvedValueOnce({ odooCommissionAccountCode: null })
    prisma.commission.findUnique.mockResolvedValueOnce(makeCommission())

    const result = await syncCommissionBill(prisma, 'order-1')

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/No commission expense account configured/)
    const updateCalls = prisma.commission.update.mock.calls
    const finalUpdate = updateCalls[updateCalls.length - 1][0]
    expect(finalUpdate.data.odooBillStatus).toBe('FAILED')
  })

  it('BILL-06 — reuses an already-linked bill instead of creating a duplicate', async () => {
    odoo.invoicesById.set(800, {
      id: 800, name: 'BILL/2026/0001', state: 'posted', payment_state: 'not_paid',
      amount_total: 17, invoice_origin: 'TT-ORD-000001', ref: 'TT-ORD-000001',
    })
    prisma.commission.findUnique.mockResolvedValueOnce(makeCommission({ odooBillId: 800 }))

    const result = await syncCommissionBill(prisma, 'order-1')

    expect(result.ok).toBe(true)
    expect(result.action).toBe('ALREADY_LINKED')
    expect(result.state).toBe('posted')
    const createCalls = (global.fetch as jest.Mock).mock.calls.filter((call) => {
      const params = JSON.parse(call[1].body).params
      return params.args?.[3] === 'account.move' && params.args?.[4] === 'create'
    })
    expect(createCalls).toHaveLength(0)
  })

  it('BILL-07 — links to an existing Odoo bill found by order reference rather than creating a new one', async () => {
    odoo.searchInvoiceResults = [{
      id: 801, name: false, state: 'draft', payment_state: 'not_paid', amount_total: 17,
      invoice_origin: 'TT-ORD-000001', ref: 'TT-ORD-000001',
    }]
    prisma.commission.findUnique.mockResolvedValueOnce(makeCommission())

    const result = await syncCommissionBill(prisma, 'order-1')

    expect(result.ok).toBe(true)
    expect(result.action).toBe('LINKED_BY_ORDER_REFERENCE')
    expect(result.billId).toBe(801)
  })
})

describe('registerCommissionPayment', () => {
  let prisma: ReturnType<typeof createMockPrisma>
  let odoo: ReturnType<typeof installMockOdoo>

  beforeEach(() => {
    prisma = createMockPrisma()
    odoo = installMockOdoo()
    _resetOdooClientCacheForTests()
    _resetBankJournalCacheForTests()
    _resetAccountIdCacheForTests()
    prisma.company.findFirst.mockResolvedValue({ odooCommissionAccountCode: '600010' })
    odoo.accountsByCode.set('600010', { id: 42 })
  })

  it('PAY-01 — does nothing if the commission isn\'t marked PAID locally', async () => {
    prisma.commission.findUnique.mockResolvedValueOnce(makeCommission({ status: 'PENDING', odooBillId: 900 }))
    await registerCommissionPayment(prisma, 'commission-1')
    expect(prisma.commission.update).not.toHaveBeenCalled()
  })

  it('PAY-02 — leaves payment queued while the bill is still a draft (not yet posted by Billy)', async () => {
    odoo.invoicesById.set(900, {
      id: 900, name: false, state: 'draft', payment_state: 'not_paid', amount_total: 17,
      invoice_origin: 'TT-ORD-000001', ref: 'TT-ORD-000001',
    })
    prisma.commission.findUnique.mockResolvedValueOnce(makeCommission({ status: 'PAID', odooBillId: 900 }))

    await registerCommissionPayment(prisma, 'commission-1')

    const paymentCreateCalls = (global.fetch as jest.Mock).mock.calls.filter((call) => {
      const params = JSON.parse(call[1].body).params
      return params.args?.[3] === 'account.payment.register' && params.args?.[4] === 'create'
    })
    expect(paymentCreateCalls).toHaveLength(0)
    expect(prisma.commission.update).not.toHaveBeenCalled()
  })

  it('PAY-03 — registers payment against a posted bill and marks the sync SYNCED', async () => {
    odoo.invoicesById.set(900, {
      id: 900, name: 'BILL/2026/0002', state: 'posted', payment_state: 'not_paid', amount_total: 17,
      invoice_origin: 'TT-ORD-000001', ref: 'TT-ORD-000001',
    })
    prisma.commission.findUnique.mockResolvedValueOnce(makeCommission({ status: 'PAID', odooBillId: 900 }))

    await registerCommissionPayment(prisma, 'commission-1')

    expect(odoo.invoicesById.get(900).payment_state).toBe('paid')
    const updateCalls = prisma.commission.update.mock.calls
    const finalUpdate = updateCalls.find((c: any) => c[0].data.odooBillPaymentSyncStatus === 'SYNCED')
    expect(finalUpdate).toBeDefined()
    expect(finalUpdate![0].data.odooBillPaymentSyncError).toBeNull()
  })

  it('PAY-04 — creates the bill on the fly as a catch-up when none is linked yet, then registers payment', async () => {
    // registerCommissionPayment looks the commission up by id, and (since no bill is linked
    // yet) syncCommissionBill looks it up again by orderId — same fixture serves both calls.
    prisma.commission.findUnique.mockResolvedValue(makeCommission({ status: 'PAID', odooBillId: null }))

    await registerCommissionPayment(prisma, 'commission-1')

    const createCalls = (global.fetch as jest.Mock).mock.calls.filter((call) => {
      const params = JSON.parse(call[1].body).params
      return params.args?.[3] === 'account.move' && params.args?.[4] === 'create'
    })
    expect(createCalls).toHaveLength(1)
    // A freshly created bill is a draft — Odoo won't accept a payment against it yet, so no
    // payment.register call should have gone out this round; it stays queued for next time.
    const paymentCreateCalls = (global.fetch as jest.Mock).mock.calls.filter((call) => {
      const params = JSON.parse(call[1].body).params
      return params.args?.[3] === 'account.payment.register' && params.args?.[4] === 'create'
    })
    expect(paymentCreateCalls).toHaveLength(0)
  })

  it('PAY-05 — a payment-registration failure never overturns the bill\'s own already-synced status', async () => {
    odoo.invoicesById.set(900, {
      id: 900, name: 'BILL/2026/0003', state: 'posted', payment_state: 'not_paid', amount_total: 17,
      invoice_origin: 'TT-ORD-000001', ref: 'TT-ORD-000001',
    })
    odoo.bankJournalId = undefined as any // forces getBankJournalId to throw "no Bank journal"
    prisma.commission.findUnique.mockResolvedValueOnce(makeCommission({ status: 'PAID', odooBillId: 900 }))

    await registerCommissionPayment(prisma, 'commission-1')

    const updateCalls = prisma.commission.update.mock.calls
    const failedUpdate = updateCalls.find((c: any) => c[0].data.odooBillPaymentSyncStatus === 'FAILED')
    expect(failedUpdate).toBeDefined()
    expect(failedUpdate![0].data.odooBillPaymentSyncError).toMatch(/Bank journal/)
    const syncedUpdate = updateCalls.find((c: any) => c[0].data.odooBillStatus === 'POSTED')
    expect(syncedUpdate).toBeUndefined() // finalizeBill('UPDATED') never ran since registerOdooPayment threw first
  })
})
