import { syncOrderInvoice, cancelOrderInvoice, reconcileOpenOrderInvoices, _resetBankJournalCacheForTests } from '../shared/services/odoo-invoice.service'
import { _resetOdooClientCacheForTests } from '../shared/services/odoo-client'
import { createMockPrisma, makeOrder } from './helpers/mock-prisma'
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

describe('syncOrderInvoice', () => {
  let prisma: ReturnType<typeof createMockPrisma>
  let odoo: ReturnType<typeof installMockOdoo>

  beforeEach(() => {
    prisma = createMockPrisma()
    odoo = installMockOdoo()
    _resetOdooClientCacheForTests()
    _resetBankJournalCacheForTests()
  })

  function mappedOrder(overrides: Record<string, any> = {}) {
    return makeOrder({
      customer: { id: 'user-1', email: 'test@example.com', phone: null, firstName: 'Test', lastName: 'User', odooPartnerId: '42' },
      items: [{
        id: 'item-1', variantId: 'variant-1', quantity: 2, unitPrice: 85, subtotal: 170,
        variant: { id: 'variant-1', name: '12 Pack', odooProductId: 200, odooProductReference: null, product: { name: 'Choc Chip Cookies' } },
      }],
      status: 'CONFIRMED',
      ...overrides,
    })
  }

  it('INV-01 — creates a draft invoice for a confirmed order', async () => {
    prisma.order.findUnique.mockResolvedValueOnce(mappedOrder())

    const result = await syncOrderInvoice(prisma, 'order-1')

    expect(result.ok).toBe(true)
    expect(result.action).toBe('CREATED')
    expect(result.state).toBe('draft')
    expect(result.invoiceId).toBeDefined()

    const orderUpdateCalls = prisma.order.update.mock.calls
    const finalUpdate = orderUpdateCalls[orderUpdateCalls.length - 1][0]
    expect(finalUpdate.data.odooInvoiceStatus).toBe('DRAFT_CREATED')
    expect(finalUpdate.data.odooInvoiceId).toBe(result.invoiceId)
    // Odoo returns `false` (not null/"") for the invoice number sequence until
    // posting — must never be written to the Prisma string column as-is.
    expect(finalUpdate.data.odooInvoiceNumber).toBeNull()
  })

  it('INV-02 — reuses an existing odooPartnerId instead of creating a new contact', async () => {
    prisma.order.findUnique.mockResolvedValueOnce(mappedOrder())

    await syncOrderInvoice(prisma, 'order-1')

    const partnerCreateCalls = (global.fetch as jest.Mock).mock.calls.filter((call) => {
      const params = JSON.parse(call[1].body).params
      return params.args?.[3] === 'res.partner' && params.args?.[4] === 'create'
    })
    expect(partnerCreateCalls).toHaveLength(0)
  })

  it('INV-03 — missing customer mapping calls the existing customer sync service', async () => {
    prisma.order.findUnique.mockResolvedValueOnce(mappedOrder({
      customer: { id: 'user-1', email: 'new@example.com', phone: null, firstName: 'New', lastName: 'Customer', odooPartnerId: null },
    }))
    // ensurePartnerId re-fetches the user after syncCustomerToOdoo persists the partner id
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', odooPartnerId: '555' })

    const result = await syncOrderInvoice(prisma, 'order-1')

    expect(result.ok).toBe(true)
    const partnerCreateCalls = (global.fetch as jest.Mock).mock.calls.filter((call) => {
      const params = JSON.parse(call[1].body).params
      return params.args?.[3] === 'res.partner' && params.args?.[4] === 'create'
    })
    expect(partnerCreateCalls).toHaveLength(1)
  })

  it('INV-04 — matches product by stored odooProductId, skipping Odoo lookup', async () => {
    prisma.order.findUnique.mockResolvedValueOnce(mappedOrder())

    await syncOrderInvoice(prisma, 'order-1')

    const productSearchCalls = (global.fetch as jest.Mock).mock.calls.filter((call) => {
      const params = JSON.parse(call[1].body).params
      return params.args?.[3] === 'product.product' && params.args?.[4] === 'search_read'
    })
    expect(productSearchCalls).toHaveLength(0)
  })

  it('INV-05 — matches product by odooProductReference (default_code) when no id is stored yet', async () => {
    odoo.productsByCode.set('BISCUIT-BUCKET-140', { id: 321, name: 'Biscuit Bucket', default_code: 'BISCUIT-BUCKET-140' })
    prisma.order.findUnique.mockResolvedValueOnce(mappedOrder({
      items: [{
        id: 'item-1', variantId: 'variant-1', quantity: 2, unitPrice: 85, subtotal: 170,
        variant: { id: 'variant-1', name: '12 Pack', odooProductId: null, odooProductReference: 'BISCUIT-BUCKET-140', product: { name: 'Choc Chip Cookies' } },
      }],
    }))

    const result = await syncOrderInvoice(prisma, 'order-1')

    expect(result.ok).toBe(true)
    // resolved id is cached back onto the variant
    expect(prisma.productVariant.update).toHaveBeenCalledWith({
      where: { id: 'variant-1' },
      data: expect.objectContaining({ odooProductId: 321, odooProductReference: 'BISCUIT-BUCKET-140', odooProductSyncStatus: 'SYNCED' }),
    })
  })

  it('INV-06 — missing product mapping fails clearly and marks the order FAILED', async () => {
    prisma.order.findUnique.mockResolvedValueOnce(mappedOrder({
      items: [{
        id: 'item-1', variantId: 'variant-1', quantity: 2, unitPrice: 85, subtotal: 170,
        variant: { id: 'variant-1', name: '12 Pack', odooProductId: null, odooProductReference: 'BISCUIT-BUCKET-140', product: { name: 'Choc Chip Cookies' } },
      }],
    }))

    const result = await syncOrderInvoice(prisma, 'order-1')

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/Product mapping missing for SKU BISCUIT-BUCKET-140/)

    const failCall = prisma.order.update.mock.calls.find((c: any) => c[0].data.odooInvoiceStatus === 'FAILED')
    expect(failCall).toBeDefined()
    expect(failCall[0].data.odooInvoiceSyncError).toMatch(/BISCUIT-BUCKET-140/)
  })

  it('INV-06b — an INGREDIENT/non-SELLABLE item can never be billed to a customer', async () => {
    prisma.order.findUnique.mockResolvedValueOnce(mappedOrder({
      items: [{
        id: 'item-1', variantId: 'variant-1', quantity: 2, unitPrice: 85, subtotal: 170,
        variant: { id: 'variant-1', name: '25kg Bag', odooProductId: null, odooProductReference: null, product: { name: 'Flour', classification: 'INGREDIENT' } },
      }],
    }))

    const result = await syncOrderInvoice(prisma, 'order-1')

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/classified as INGREDIENT, not SELLABLE/)
    const createCalls = (global.fetch as jest.Mock).mock.calls.filter((call) => {
      const params = JSON.parse(call[1].body).params
      return params.args?.[3] === 'account.move' && params.args?.[4] === 'create'
    })
    expect(createCalls).toHaveLength(0)
  })

  it('INV-07 — retrying an already-linked order does not create a duplicate invoice', async () => {
    const order = mappedOrder()
    prisma.order.findUnique.mockResolvedValueOnce(order)
    const first = await syncOrderInvoice(prisma, 'order-1')

    // Simulate the order now carrying the id persisted by the first call
    prisma.order.findUnique.mockResolvedValueOnce({ ...order, odooInvoiceId: first.invoiceId, orderNumber: 'TT-ORD-000001' })
    const second = await syncOrderInvoice(prisma, 'order-1')

    expect(second.ok).toBe(true)
    expect(second.invoiceId).toBe(first.invoiceId)

    const createCalls = (global.fetch as jest.Mock).mock.calls.filter((call) => {
      const params = JSON.parse(call[1].body).params
      return params.args?.[3] === 'account.move' && params.args?.[4] === 'create'
    })
    expect(createCalls).toHaveLength(1)
  })

  it('INV-08 — links an existing Odoo invoice found by order reference instead of creating a new one', async () => {
    odoo.searchInvoiceResults = [{
      id: 777, name: '/', state: 'draft', payment_state: 'not_paid',
      amount_untaxed: 170, amount_tax: 0, amount_total: 170,
      partner_id: [42, ''], invoice_origin: 'TT-ORD-000001', ref: 'TT-ORD-000001', invoice_date: '2026-08-03',
    }]
    prisma.order.findUnique.mockResolvedValueOnce(mappedOrder({ orderNumber: 'TT-ORD-000001' }))

    const result = await syncOrderInvoice(prisma, 'order-1')

    expect(result.action).toBe('LINKED_BY_ORDER_REFERENCE')
    expect(result.invoiceId).toBe(777)
    const createCalls = (global.fetch as jest.Mock).mock.calls.filter((call) => {
      const params = JSON.parse(call[1].body).params
      return params.args?.[3] === 'account.move' && params.args?.[4] === 'create'
    })
    expect(createCalls).toHaveLength(0)
  })

  it('INV-09 — a delivery fee becomes its own invoice line', async () => {
    odoo.productsByCode.set('DELIVERY-FEE', { id: 250, name: 'Delivery Fee', default_code: 'DELIVERY-FEE' })
    prisma.order.findUnique.mockResolvedValueOnce(mappedOrder({ deliveryFee: 50, total: 220 }))

    await syncOrderInvoice(prisma, 'order-1')

    const createCall = (global.fetch as jest.Mock).mock.calls.find((call) => {
      const params = JSON.parse(call[1].body).params
      return params.args?.[3] === 'account.move' && params.args?.[4] === 'create'
    })
    const vals = JSON.parse(createCall[1].body).params.args[5][0]
    expect(vals.invoice_line_ids).toHaveLength(2)
    expect(vals.invoice_line_ids[1][2].product_id).toBe(250)
    expect(vals.invoice_line_ids[1][2].price_unit).toBe(50)
  })

  it('INV-10 — updates lines on an existing draft invoice instead of creating a second one', async () => {
    odoo.invoicesById.set(600, {
      id: 600, name: '/', state: 'draft', payment_state: 'not_paid',
      amount_untaxed: 85, amount_tax: 0, amount_total: 85,
      partner_id: [42, ''], invoice_origin: 'TT-ORD-000001', ref: 'TT-ORD-000001', invoice_date: '2026-08-03',
    })
    prisma.order.findUnique.mockResolvedValueOnce(mappedOrder({ odooInvoiceId: 600, orderNumber: 'TT-ORD-000001' }))

    const result = await syncOrderInvoice(prisma, 'order-1')

    expect(result.action).toBe('UPDATED')
    expect(result.amountTotal).toBe(170) // recalculated from the order's current 2x85 line
    const writeCalls = (global.fetch as jest.Mock).mock.calls.filter((call) => {
      const params = JSON.parse(call[1].body).params
      return params.args?.[3] === 'account.move' && params.args?.[4] === 'write'
    })
    expect(writeCalls).toHaveLength(1)
  })

  it('INV-11 — a posted invoice is never silently modified', async () => {
    odoo.invoicesById.set(700, {
      id: 700, name: 'INV/2026/0001', state: 'posted', payment_state: 'not_paid',
      amount_untaxed: 170, amount_tax: 0, amount_total: 170,
      partner_id: [42, ''], invoice_origin: 'TT-ORD-000001', ref: 'TT-ORD-000001', invoice_date: '2026-08-03',
    })
    prisma.order.findUnique.mockResolvedValueOnce(mappedOrder({ odooInvoiceId: 700, orderNumber: 'TT-ORD-000001' }))

    const result = await syncOrderInvoice(prisma, 'order-1')

    expect(result.action).toBe('ALREADY_LINKED')
    expect(result.state).toBe('posted')
    const writeCalls = (global.fetch as jest.Mock).mock.calls.filter((call) => {
      const params = JSON.parse(call[1].body).params
      return params.args?.[3] === 'account.move' && params.args?.[4] === 'write'
    })
    expect(writeCalls).toHaveLength(0)

    const finalUpdate = prisma.order.update.mock.calls[prisma.order.update.mock.calls.length - 1][0]
    expect(finalUpdate.data.odooInvoiceStatus).toBe('POSTED')
  })

  it('INV-12 / INV-13 — an Odoo failure (e.g. auth) is stored locally as FAILED, without throwing', async () => {
    ;(global.fetch as jest.Mock).mockImplementationOnce(async () => ({
      json: async () => ({ jsonrpc: '2.0', id: 1, error: { message: 'Access Denied', data: { message: 'ODOO invalid credentials' } } }),
    }))
    prisma.order.findUnique.mockResolvedValueOnce(mappedOrder())

    const result = await syncOrderInvoice(prisma, 'order-1')

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/invalid credentials/i)
    const failCall = prisma.order.update.mock.calls.find((c: any) => c[0].data.odooInvoiceStatus === 'FAILED')
    expect(failCall[0].data.odooInvoiceSyncError).toMatch(/invalid credentials/i)
  })

  it('INV-14 — a total mismatch is recorded as a reconciliation issue rather than silently accepted', async () => {
    // Odoo adds tax the local app doesn't know about, so its computed total diverges
    const originalFetch = global.fetch as jest.Mock
    ;(global as any).fetch = jest.fn(async (url: string, opts: any) => {
      const res = await originalFetch(url, opts)
      const parsed = await res.json()
      const params = JSON.parse(opts.body).params
      if (params.args?.[3] === 'account.move' && params.args?.[4] === 'create') {
        // inflate the stored invoice's total to simulate Odoo-side tax
        const invoiceId = parsed.result
        const rec = odoo.invoicesById.get(invoiceId)
        rec.amount_total = rec.amount_total + 50
      }
      return { json: async () => parsed }
    })
    prisma.order.findUnique.mockResolvedValueOnce(mappedOrder())

    const result = await syncOrderInvoice(prisma, 'order-1')

    expect(result.ok).toBe(true)
    expect(result.reconciliationIssue).toBe(true)
    const finalUpdate = prisma.order.update.mock.calls[prisma.order.update.mock.calls.length - 1][0]
    expect(finalUpdate.data.odooInvoiceStatus).toBe('RECONCILIATION_ISSUE')
    expect(finalUpdate.data.odooInvoiceSyncError).toMatch(/differs/i)
  })

  it('does not sync a PENDING order — nothing to invoice before it is confirmed', async () => {
    prisma.order.findUnique.mockResolvedValueOnce(mappedOrder({ status: 'PENDING' }))

    const result = await syncOrderInvoice(prisma, 'order-1')

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/PENDING/)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('does not sync a CANCELLED order — cancelOrderInvoice is the dedicated handler for that', async () => {
    prisma.order.findUnique.mockResolvedValueOnce(mappedOrder({ status: 'CANCELLED' }))

    const result = await syncOrderInvoice(prisma, 'order-1')

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/CANCELLED/)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('DOES sync an order past CONFIRMED (e.g. DELIVERED) — regression: this used to hard-require exactly CONFIRMED, which silently broke refreshing an already-linked invoice once the order moved on', async () => {
    prisma.order.findUnique.mockResolvedValueOnce(mappedOrder({ status: 'DELIVERED' }))

    const result = await syncOrderInvoice(prisma, 'order-1')

    expect(result.ok).toBe(true)
    expect(result.action).toBe('CREATED')
  })
})

describe('cancelOrderInvoice', () => {
  let prisma: ReturnType<typeof createMockPrisma>
  let odoo: ReturnType<typeof installMockOdoo>

  beforeEach(() => {
    prisma = createMockPrisma()
    odoo = installMockOdoo()
    _resetOdooClientCacheForTests()
  })

  it('cancels a still-draft invoice cleanly', async () => {
    odoo.invoicesById.set(600, {
      id: 600, name: '/', state: 'draft', payment_state: 'not_paid',
      amount_untaxed: 170, amount_tax: 0, amount_total: 170,
      partner_id: [42, ''], invoice_origin: 'TT-ORD-000001', ref: 'TT-ORD-000001', invoice_date: '2026-08-04',
    })
    prisma.order.findUnique.mockResolvedValueOnce({ id: 'order-1', odooInvoiceId: 600, total: 170 })

    const result = await cancelOrderInvoice(prisma, 'order-1')

    expect(result.ok).toBe(true)
    expect(result.reconciliationIssue).toBeFalsy()
    expect(odoo.invoicesById.get(600).state).toBe('cancel')
    const finalUpdate = prisma.order.update.mock.calls[prisma.order.update.mock.calls.length - 1][0]
    expect(finalUpdate.data.odooInvoiceStatus).toBe('CANCELLED')
  })

  it('never auto-cancels a posted invoice — flags it for manual review instead', async () => {
    odoo.invoicesById.set(700, {
      id: 700, name: 'INV/2026/0001', state: 'posted', payment_state: 'not_paid',
      amount_untaxed: 170, amount_tax: 0, amount_total: 170,
      partner_id: [42, ''], invoice_origin: 'TT-ORD-000001', ref: 'TT-ORD-000001', invoice_date: '2026-08-04',
    })
    prisma.order.findUnique.mockResolvedValueOnce({ id: 'order-1', odooInvoiceId: 700, total: 170 })

    const result = await cancelOrderInvoice(prisma, 'order-1')

    expect(result.ok).toBe(true)
    expect(result.reconciliationIssue).toBe(true)
    expect(odoo.invoicesById.get(700).state).toBe('posted') // untouched
    const finalUpdate = prisma.order.update.mock.calls[prisma.order.update.mock.calls.length - 1][0]
    expect(finalUpdate.data.odooInvoiceStatus).toBe('RECONCILIATION_ISSUE')
    expect(finalUpdate.data.odooInvoiceSyncError).toMatch(/manual credit note/i)
  })

  it('is a no-op when no Odoo invoice was ever created', async () => {
    prisma.order.findUnique.mockResolvedValueOnce({ id: 'order-1', odooInvoiceId: null, total: 170 })

    const result = await cancelOrderInvoice(prisma, 'order-1')

    expect(result.ok).toBe(true)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

describe('syncOrderInvoice — payment registration', () => {
  let prisma: ReturnType<typeof createMockPrisma>
  let odoo: ReturnType<typeof installMockOdoo>

  beforeEach(() => {
    prisma = createMockPrisma()
    odoo = installMockOdoo()
    _resetOdooClientCacheForTests()
    _resetBankJournalCacheForTests()
  })

  function paidOrder(overrides: Record<string, any> = {}) {
    return makeOrder({
      customer: { id: 'user-1', email: 'test@example.com', phone: null, firstName: 'Test', lastName: 'User', odooPartnerId: '42' },
      items: [{
        id: 'item-1', variantId: 'variant-1', quantity: 2, unitPrice: 85, subtotal: 170,
        variant: { id: 'variant-1', name: '12 Pack', odooProductId: 200, odooProductReference: null, product: { name: 'Choc Chip Cookies' } },
      }],
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      ...overrides,
    })
  }

  it('registers payment against an already-posted invoice and marks it PAID locally', async () => {
    odoo.invoicesById.set(800, {
      id: 800, name: 'INV/2026/0002', state: 'posted', payment_state: 'not_paid',
      amount_untaxed: 170, amount_tax: 0, amount_total: 170,
      partner_id: [42, ''], invoice_origin: 'TT-ORD-000001', ref: 'TT-ORD-000001', invoice_date: '2026-08-04',
    })
    prisma.order.findUnique.mockResolvedValueOnce(paidOrder({ odooInvoiceId: 800, orderNumber: 'TT-ORD-000001' }))

    const result = await syncOrderInvoice(prisma, 'order-1')

    expect(result.ok).toBe(true)
    expect(result.paymentState).toBe('paid')
    const paymentCreateCall = (global.fetch as jest.Mock).mock.calls.find((call) => {
      const params = JSON.parse(call[1].body).params
      return params.args?.[3] === 'account.payment.register' && params.args?.[4] === 'create'
    })
    expect(paymentCreateCall).toBeDefined()
    const paidUpdate = prisma.order.update.mock.calls.find((c: any) => c[0].data.odooInvoiceStatus === 'PAID')
    expect(paidUpdate).toBeDefined()

    const paymentSyncUpdate = prisma.order.update.mock.calls.find((c: any) => c[0].data.odooPaymentSyncStatus === 'SYNCED')
    expect(paymentSyncUpdate).toBeDefined()
  })

  it('does not attempt payment registration while the invoice is still draft (queued for later)', async () => {
    prisma.order.findUnique.mockResolvedValueOnce(paidOrder())

    const result = await syncOrderInvoice(prisma, 'order-1')

    expect(result.ok).toBe(true)
    expect(result.state).toBe('draft')
    const paymentCreateCall = (global.fetch as jest.Mock).mock.calls.find((call) => {
      const params = JSON.parse(call[1].body).params
      return params.args?.[3] === 'account.payment.register'
    })
    expect(paymentCreateCall).toBeUndefined()
    const paymentSyncUpdate = prisma.order.update.mock.calls.find((c: any) => c[0].data.odooPaymentSyncStatus)
    expect(paymentSyncUpdate).toBeUndefined()
  })

  it('a payment-registration failure does not undo an otherwise successful invoice sync', async () => {
    odoo.invoicesById.set(900, {
      id: 900, name: 'INV/2026/0003', state: 'posted', payment_state: 'not_paid',
      amount_untaxed: 170, amount_tax: 0, amount_total: 170,
      partner_id: [42, ''], invoice_origin: 'TT-ORD-000001', ref: 'TT-ORD-000001', invoice_date: '2026-08-04',
    })
    // No Bank journal seeded — getBankJournalId will throw
    prisma.order.findUnique.mockResolvedValueOnce(paidOrder({ odooInvoiceId: 900, orderNumber: 'TT-ORD-000001' }))
    ;(odoo as any).bankJournalId = undefined

    const result = await syncOrderInvoice(prisma, 'order-1')

    expect(result.ok).toBe(true) // invoice sync itself still succeeded
    expect(result.action).toBe('ALREADY_LINKED')
    const paymentFailUpdate = prisma.order.update.mock.calls.find((c: any) => c[0].data.odooPaymentSyncStatus === 'FAILED')
    expect(paymentFailUpdate).toBeDefined()
  })
})

describe('reconcileOpenOrderInvoices', () => {
  let prisma: ReturnType<typeof createMockPrisma>
  let odoo: ReturnType<typeof installMockOdoo>

  beforeEach(() => {
    prisma = createMockPrisma()
    odoo = installMockOdoo()
    _resetOdooClientCacheForTests()
    _resetBankJournalCacheForTests()
  })

  function linkedOrder(overrides: Record<string, any> = {}) {
    return makeOrder({
      customer: { id: 'user-1', email: 'test@example.com', phone: null, firstName: 'Test', lastName: 'User', odooPartnerId: '42' },
      items: [{
        id: 'item-1', variantId: 'variant-1', quantity: 2, unitPrice: 85, subtotal: 170,
        variant: { id: 'variant-1', name: '12 Pack', odooProductId: 200, odooProductReference: null, product: { name: 'Choc Chip Cookies' } },
      }],
      status: 'DELIVERED',
      ...overrides,
    })
  }

  it('only queries orders with a linked invoice that is not already PAID/CANCELLED', async () => {
    prisma.order.findMany.mockResolvedValueOnce([])

    await reconcileOpenOrderInvoices(prisma)

    expect(prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { odooInvoiceId: { not: null }, odooInvoiceStatus: { notIn: ['PAID', 'CANCELLED'] } },
    }))
  })

  it('re-syncs every order found and reports how many succeeded', async () => {
    odoo.invoicesById.set(901, {
      id: 901, name: 'INV/2026/0010', state: 'posted', payment_state: 'not_paid',
      amount_untaxed: 170, amount_tax: 0, amount_total: 170,
      partner_id: [42, ''], invoice_origin: 'TT-ORD-000010', ref: 'TT-ORD-000010', invoice_date: '2026-08-04',
    })
    odoo.invoicesById.set(902, {
      id: 902, name: 'INV/2026/0011', state: 'paid', payment_state: 'paid',
      amount_untaxed: 170, amount_tax: 0, amount_total: 170,
      partner_id: [42, ''], invoice_origin: 'TT-ORD-000011', ref: 'TT-ORD-000011', invoice_date: '2026-08-04',
    })
    prisma.order.findMany.mockResolvedValueOnce([{ id: 'order-1' }, { id: 'order-2' }])
    prisma.order.findUnique
      .mockResolvedValueOnce(linkedOrder({ id: 'order-1', odooInvoiceId: 901 }))
      .mockResolvedValueOnce(linkedOrder({ id: 'order-2', odooInvoiceId: 902 }))

    const result = await reconcileOpenOrderInvoices(prisma)

    expect(result).toEqual({
      checked: 2,
      succeeded: 2,
      failed: 0,
      results: [
        { orderId: 'order-1', ok: true, error: undefined },
        { orderId: 'order-2', ok: true, error: undefined },
      ],
    })
  })

  it('a failure on one order does not stop the rest from being checked', async () => {
    prisma.order.findMany.mockResolvedValueOnce([{ id: 'order-1' }, { id: 'order-2' }])
    prisma.order.findUnique
      .mockResolvedValueOnce(null) // order-1 vanished — syncOrderInvoice reports "Order not found"
      .mockResolvedValueOnce(linkedOrder({ id: 'order-2', status: 'PENDING' })) // order-2 blocked by its own guard

    const result = await reconcileOpenOrderInvoices(prisma)

    expect(result.checked).toBe(2)
    expect(result.succeeded).toBe(0)
    expect(result.failed).toBe(2)
    expect(result.results).toEqual([
      { orderId: 'order-1', ok: false, error: 'Order not found' },
      { orderId: 'order-2', ok: false, error: expect.stringContaining('PENDING') },
    ])
  })

  it('respects a custom limit', async () => {
    prisma.order.findMany.mockResolvedValueOnce([])

    await reconcileOpenOrderInvoices(prisma, 5)

    expect(prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }))
  })
})
