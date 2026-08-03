import { syncOrderInvoice } from '../shared/services/odoo-invoice.service'
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

  it('does not sync orders that are not CONFIRMED', async () => {
    prisma.order.findUnique.mockResolvedValueOnce(mappedOrder({ status: 'PENDING' }))

    const result = await syncOrderInvoice(prisma, 'order-1')

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/not CONFIRMED/)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
