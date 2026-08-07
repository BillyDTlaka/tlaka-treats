import { PrismaClient } from '@prisma/client'
import { config } from '../../config'
import { odooRpc, getUid, getCompanyId, assertOdooConfigured } from './odoo-client'
import { syncCustomerToOdoo } from './odoo.service'
import { resolveOdooProductId, resolveServiceProductId, ProductMappingError } from './odoo-product.service'

export type OdooInvoiceAction = 'CREATED' | 'ALREADY_LINKED' | 'LINKED_BY_ORDER_REFERENCE' | 'UPDATED' | 'CANCELLED'

export interface OdooInvoiceSyncResult {
  ok: boolean
  action?: OdooInvoiceAction
  invoiceId?: number
  invoiceNumber?: string
  state?: string
  paymentState?: string
  amountTotal?: number
  reconciliationIssue?: boolean
  error?: string
}

const MISMATCH_TOLERANCE = 0.05 // rand — accounts for float rounding, not a real reconciliation gap

interface OdooInvoiceFields {
  id: number
  name: string | false
  state: string
  payment_state: string
  amount_untaxed: number
  amount_tax: number
  amount_total: number
  partner_id: [number, string] | false
  invoice_origin: string | false
  ref: string | false
  invoice_date: string | false
}

const INVOICE_FIELDS = ['id', 'name', 'state', 'payment_state', 'amount_untaxed', 'amount_tax', 'amount_total', 'partner_id', 'invoice_origin', 'ref', 'invoice_date']

export async function readInvoice(uid: number, invoiceId: number): Promise<OdooInvoiceFields | null> {
  const invoices = await odooRpc<OdooInvoiceFields[]>('object', 'execute_kw', [
    config.odoo.db, uid, config.odoo.apiKey, 'account.move', 'read', [[invoiceId]], { fields: INVOICE_FIELDS },
  ])
  return invoices[0] || null
}

export async function findInvoiceByOrderReference(uid: number, orderNumber: string): Promise<OdooInvoiceFields | null> {
  const invoices = await odooRpc<OdooInvoiceFields[]>('object', 'execute_kw', [
    config.odoo.db,
    uid,
    config.odoo.apiKey,
    'account.move',
    'search_read',
    [['&', ['move_type', '=', 'out_invoice'], '|', ['invoice_origin', '=', orderNumber], ['ref', '=', orderNumber]]],
    { fields: INVOICE_FIELDS, limit: 1 },
  ])
  return invoices[0] || null
}

async function createDraftCustomerInvoice(uid: number, companyId: number, partnerId: number, orderNumber: string, lines: unknown[]): Promise<number> {
  return odooRpc<number>('object', 'execute_kw', [
    config.odoo.db,
    uid,
    config.odoo.apiKey,
    'account.move',
    'create',
    [{
      move_type: 'out_invoice',
      partner_id: partnerId,
      company_id: companyId,
      invoice_date: new Date().toISOString().slice(0, 10),
      invoice_origin: orderNumber,
      ref: orderNumber,
      invoice_line_ids: lines,
    }],
  ])
}

async function updateDraftCustomerInvoice(uid: number, invoiceId: number, lines: unknown[]): Promise<void> {
  // [5, 0, 0] clears existing lines before re-adding the current set
  await odooRpc('object', 'execute_kw', [
    config.odoo.db, uid, config.odoo.apiKey, 'account.move', 'write', [[invoiceId], { invoice_line_ids: [[5, 0, 0], ...lines] }],
  ])
}

// Cash/EFT/card all post through the same Bank journal for now — Tlaka Treats' Odoo
// instance has no dedicated Cash journal yet.
let cachedBankJournalId: number | null = null

async function getBankJournalId(uid: number, companyId: number): Promise<number> {
  if (cachedBankJournalId) return cachedBankJournalId
  const journals = await odooRpc<Array<{ id: number }>>('object', 'execute_kw', [
    config.odoo.db, uid, config.odoo.apiKey, 'account.journal', 'search_read',
    [[['type', '=', 'bank'], ['company_id', '=', companyId]]], { fields: ['id'], limit: 1 },
  ])
  if (!journals.length) throw new Error('No Bank journal found in Odoo for this company')
  cachedBankJournalId = journals[0].id
  return cachedBankJournalId
}

// Registers a payment against a posted invoice via Odoo's standard "Register Payment"
// wizard (account.payment.register) — the same flow Odoo uses internally when you click
// the button in the UI, so reconciliation is handled correctly regardless of version quirks.
// Works identically for a customer invoice (out_invoice) or a vendor bill (in_invoice) —
// Odoo infers the payment direction from the linked move itself.
export async function registerOdooPayment(uid: number, companyId: number, invoiceId: number, amount: number, paymentDate: string): Promise<void> {
  const journalId = await getBankJournalId(uid, companyId)
  const wizardId = await odooRpc<number>('object', 'execute_kw', [
    config.odoo.db, uid, config.odoo.apiKey, 'account.payment.register', 'create',
    [{ payment_date: paymentDate, amount, journal_id: journalId }],
    { context: { active_model: 'account.move', active_ids: [invoiceId], active_id: invoiceId } },
  ])
  await odooRpc('object', 'execute_kw', [
    config.odoo.db, uid, config.odoo.apiKey, 'account.payment.register', 'action_create_payments', [[wizardId]],
  ])
}

// Exposed for tests only.
export function _resetBankJournalCacheForTests() {
  cachedBankJournalId = null
}

async function ensureOrderNumber(prisma: PrismaClient, order: { id: string; orderNumber: string | null; orderSeq: number }): Promise<string> {
  if (order.orderNumber) return order.orderNumber
  const orderNumber = `TT-ORD-${String(order.orderSeq).padStart(6, '0')}`
  await (prisma as any).order.update({ where: { id: order.id }, data: { orderNumber } })
  return orderNumber
}

export async function ensurePartnerId(prisma: PrismaClient, customer: { id: string; email: string; firstName: string; lastName: string; phone?: string | null; odooPartnerId?: string | null }): Promise<number> {
  if (customer.odooPartnerId) return Number(customer.odooPartnerId)
  await syncCustomerToOdoo(prisma, customer)
  const refreshed = await (prisma as any).user.findUnique({ where: { id: customer.id } })
  if (!refreshed?.odooPartnerId) throw new Error('Failed to resolve Odoo partner for customer')
  return Number(refreshed.odooPartnerId)
}

async function buildInvoiceLines(prisma: PrismaClient, uid: number, order: any): Promise<{ lines: unknown[]; expectedTotal: number }> {
  const lines: unknown[] = []
  let expectedTotal = 0

  for (const item of order.items) {
    const classification = item.variant.product?.classification
    if (classification && classification !== 'SELLABLE') {
      throw new ProductMappingError(
        `Order item "${item.variant.product?.name ?? ''} — ${item.variant.name}" is classified as ${classification}, not SELLABLE — an ingredient/packaging/consumable can't be billed to a customer`,
      )
    }
    const productId = await resolveOdooProductId(prisma, uid, {
      id: item.variant.id,
      name: item.variant.name,
      odooProductId: item.variant.odooProductId,
      odooProductReference: item.variant.odooProductReference,
      product: item.variant.product,
    })
    const description = `${item.variant.product?.name ?? ''} — ${item.variant.name}`.trim()
    lines.push([0, 0, { product_id: productId, name: description, quantity: item.quantity, price_unit: Number(item.unitPrice) }])
    expectedTotal += Number(item.subtotal)
  }

  if (Number(order.deliveryFee) > 0) {
    const deliveryProductId = await resolveServiceProductId(uid, config.odoo.deliveryProductRef, 'Delivery Fee', config.odoo.deliveryIncomeAccountCode)
    lines.push([0, 0, { product_id: deliveryProductId, name: 'Delivery Fee', quantity: 1, price_unit: Number(order.deliveryFee) }])
    expectedTotal += Number(order.deliveryFee)
  }

  if (Number(order.discountAmount) > 0) {
    const discountProductId = await resolveServiceProductId(uid, config.odoo.discountProductRef, 'Discount', config.odoo.discountIncomeAccountCode)
    lines.push([0, 0, { product_id: discountProductId, name: 'Discount', quantity: 1, price_unit: -Number(order.discountAmount) }])
    expectedTotal -= Number(order.discountAmount)
  }

  return { lines, expectedTotal }
}

function mapOdooStateToLocal(invoice: OdooInvoiceFields, mismatch: boolean): string {
  if (mismatch) return 'RECONCILIATION_ISSUE'
  if (invoice.state === 'cancel') return 'CANCELLED'
  if (invoice.payment_state === 'paid') return 'PAID'
  if (invoice.state === 'posted') return 'POSTED'
  return 'DRAFT_CREATED'
}

async function finalize(
  prisma: PrismaClient,
  order: { id: string; total: unknown },
  invoice: OdooInvoiceFields,
  action: OdooInvoiceAction,
  expectedTotal: number | undefined,
): Promise<OdooInvoiceSyncResult> {
  const mismatch = expectedTotal !== undefined && Math.abs(expectedTotal - Number(invoice.amount_total)) > MISMATCH_TOLERANCE
  const status = mapOdooStateToLocal(invoice, mismatch)
  // Odoo's JSON-RPC represents an unset Char field (e.g. the invoice number
  // sequence, not assigned until posting) as the boolean `false`, not null/"".
  const invoiceNumber = invoice.name || null

  await (prisma as any).order.update({
    where: { id: order.id },
    data: {
      odooInvoiceId: invoice.id,
      odooInvoiceNumber: invoiceNumber,
      odooInvoiceStatus: status,
      odooInvoiceSyncError: mismatch
        ? `Local order total (${Number(order.total).toFixed(2)}) differs from Odoo invoice total (${Number(invoice.amount_total).toFixed(2)})`
        : null,
      odooInvoiceSyncedAt: new Date(),
    },
  })

  return {
    ok: true,
    action,
    invoiceId: invoice.id,
    invoiceNumber: invoiceNumber ?? undefined,
    state: invoice.state,
    paymentState: invoice.payment_state,
    amountTotal: invoice.amount_total,
    reconciliationIssue: status === 'RECONCILIATION_ISSUE',
  }
}

// After a successful invoice sync, registers payment in Odoo if the order has been marked
// PAID locally (cash/EFT/card) but Odoo doesn't reflect that yet. If the invoice is still
// draft (Billy hasn't reviewed/posted it), this is a no-op for now — Odoo won't accept a
// payment against an unposted invoice, so it's effectively queued for the next retry/sync
// once the invoice is posted. A payment-registration failure never overturns an otherwise
// successful invoice sync — it's tracked separately via odooPaymentSyncStatus/Error.
async function maybeRegisterPayment(
  prisma: PrismaClient,
  uid: number,
  companyId: number,
  order: { id: string; paymentStatus?: string | null; total: unknown },
  result: OdooInvoiceSyncResult,
): Promise<OdooInvoiceSyncResult> {
  if (!result.ok || !result.invoiceId) return result
  if (order.paymentStatus !== 'PAID') return result
  if (result.state !== 'posted') return result
  if (result.paymentState === 'paid') return result

  const db = prisma as any
  try {
    await registerOdooPayment(uid, companyId, result.invoiceId, Number(order.total), new Date().toISOString().slice(0, 10))
    const refreshed = await readInvoice(uid, result.invoiceId)
    if (!refreshed) return result
    const updatedResult = await finalize(prisma, order, refreshed, 'UPDATED', undefined)
    await db.order.update({
      where: { id: order.id },
      data: { odooPaymentSyncStatus: 'SYNCED', odooPaymentSyncError: null, odooPaymentSyncedAt: new Date() },
    })
    return updatedResult
  } catch (err: any) {
    const message = err?.message || 'Unknown Odoo payment sync error'
    await db.order.update({
      where: { id: order.id },
      data: { odooPaymentSyncStatus: 'FAILED', odooPaymentSyncError: message, odooPaymentSyncedAt: new Date() },
    })
    return result
  }
}

// Idempotent: safe to call repeatedly for the same order without creating duplicate
// invoices. Never throws — persists FAILED + the error message on the order and
// returns { ok: false, error } instead, so callers (the CONFIRMED hook, the manual
// retry endpoint) can treat this uniformly.
export async function syncOrderInvoice(prisma: PrismaClient, orderId: string): Promise<OdooInvoiceSyncResult> {
  const db = prisma as any

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      items: { include: { variant: { include: { product: true } } } },
    },
  })
  if (!order) return { ok: false, error: 'Order not found' }

  if (order.status !== 'CONFIRMED') {
    return { ok: false, error: `Order is ${order.status}, not CONFIRMED — invoice sync only runs for confirmed orders` }
  }

  try {
    assertOdooConfigured()
    await db.order.update({ where: { id: orderId }, data: { odooInvoiceStatus: 'SYNCING', odooInvoiceSyncError: null } })

    const uid = await getUid()
    const companyId = await getCompanyId(uid)
    const orderNumber = await ensureOrderNumber(prisma, order)
    const partnerId = await ensurePartnerId(prisma, order.customer)

    // Already linked to an Odoo invoice — refresh or, if still draft, push the latest lines
    if (order.odooInvoiceId) {
      const invoice = await readInvoice(uid, order.odooInvoiceId)
      if (!invoice) throw new Error(`Linked Odoo invoice ${order.odooInvoiceId} could not be found — it may have been deleted in Odoo`)

      if (invoice.state === 'draft') {
        const { lines, expectedTotal } = await buildInvoiceLines(prisma, uid, order)
        await updateDraftCustomerInvoice(uid, order.odooInvoiceId, lines)
        const refreshed = await readInvoice(uid, order.odooInvoiceId)
        const result = await finalize(prisma, order, refreshed!, 'UPDATED', expectedTotal)
        return maybeRegisterPayment(prisma, uid, companyId, order, result)
      }

      // Posted/paid/cancelled — never silently modify, just refresh local status
      const result = await finalize(prisma, order, invoice, 'ALREADY_LINKED', undefined)
      return maybeRegisterPayment(prisma, uid, companyId, order, result)
    }

    // Not linked locally — check Odoo itself before creating, in case a previous sync
    // succeeded in Odoo but failed to persist the id locally (network blip, crash, etc.)
    const existing = await findInvoiceByOrderReference(uid, orderNumber)
    if (existing) {
      const result = await finalize(prisma, order, existing, 'LINKED_BY_ORDER_REFERENCE', undefined)
      return maybeRegisterPayment(prisma, uid, companyId, order, result)
    }

    const { lines, expectedTotal } = await buildInvoiceLines(prisma, uid, order)
    const invoiceId = await createDraftCustomerInvoice(uid, companyId, partnerId, orderNumber, lines)
    const created = await readInvoice(uid, invoiceId)
    const result = await finalize(prisma, order, created!, 'CREATED', expectedTotal)
    return maybeRegisterPayment(prisma, uid, companyId, order, result)
  } catch (err: any) {
    const message = err instanceof ProductMappingError ? err.message : (err?.message || 'Unknown Odoo sync error')
    await db.order.update({
      where: { id: orderId },
      data: { odooInvoiceStatus: 'FAILED', odooInvoiceSyncError: message, odooInvoiceSyncedAt: new Date() },
    })
    return { ok: false, error: message }
  }
}

// Called when an order is cancelled. A still-draft invoice is safely cancelled outright —
// it was never posted, so there's no accounting residue. A posted (or paid) invoice is
// deliberately left alone: reversing it needs a credit note, a real accounting action with
// consequences (tax periods, reconciled payments) that shouldn't happen automatically. That
// case is flagged as RECONCILIATION_ISSUE for Billy to handle directly in Odoo.
export async function cancelOrderInvoice(prisma: PrismaClient, orderId: string): Promise<OdooInvoiceSyncResult> {
  const db = prisma as any
  const order = await db.order.findUnique({ where: { id: orderId } })
  if (!order) return { ok: false, error: 'Order not found' }
  if (!order.odooInvoiceId) return { ok: true } // no invoice was ever created — nothing to cancel

  try {
    assertOdooConfigured()
    const uid = await getUid()
    const invoice = await readInvoice(uid, order.odooInvoiceId)
    if (!invoice) {
      await db.order.update({
        where: { id: orderId },
        data: {
          odooInvoiceStatus: 'RECONCILIATION_ISSUE',
          odooInvoiceSyncError: `Linked Odoo invoice ${order.odooInvoiceId} could not be found while cancelling the order`,
          odooInvoiceSyncedAt: new Date(),
        },
      })
      return { ok: true, reconciliationIssue: true }
    }

    if (invoice.state === 'draft') {
      await odooRpc('object', 'execute_kw', [config.odoo.db, uid, config.odoo.apiKey, 'account.move', 'button_cancel', [[order.odooInvoiceId]]])
      const refreshed = await readInvoice(uid, order.odooInvoiceId)
      return finalize(prisma, order, refreshed!, 'CANCELLED', undefined)
    }

    await db.order.update({
      where: { id: orderId },
      data: {
        odooInvoiceStatus: 'RECONCILIATION_ISSUE',
        odooInvoiceSyncError: `Order was cancelled but its Odoo invoice is already ${invoice.state} — a manual credit note is needed in Odoo`,
        odooInvoiceSyncedAt: new Date(),
      },
    })
    return { ok: true, invoiceId: invoice.id, invoiceNumber: invoice.name || undefined, state: invoice.state, reconciliationIssue: true }
  } catch (err: any) {
    const message = err?.message || 'Unknown Odoo sync error'
    await db.order.update({
      where: { id: orderId },
      data: { odooInvoiceStatus: 'FAILED', odooInvoiceSyncError: message, odooInvoiceSyncedAt: new Date() },
    })
    return { ok: false, error: message }
  }
}
