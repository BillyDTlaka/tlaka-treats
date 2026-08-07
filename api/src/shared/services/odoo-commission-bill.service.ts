import { PrismaClient } from '@prisma/client'
import { config } from '../../config'
import { odooRpc, getUid, getCompanyId, assertOdooConfigured } from './odoo-client'
import { ensurePartnerId, registerOdooPayment } from './odoo-invoice.service'
import { resolveAccountIdByCode, ProductMappingError } from './odoo-product.service'

export type OdooBillAction = 'CREATED' | 'ALREADY_LINKED' | 'LINKED_BY_ORDER_REFERENCE' | 'UPDATED'

export interface OdooBillSyncResult {
  ok: boolean
  action?: OdooBillAction
  billId?: number
  billNumber?: string
  state?: string
  paymentState?: string
  error?: string
}

interface OdooBillFields {
  id: number
  name: string | false
  state: string
  payment_state: string
  amount_total: number
}

const BILL_FIELDS = ['id', 'name', 'state', 'payment_state', 'amount_total']

async function readBill(uid: number, billId: number): Promise<OdooBillFields | null> {
  const bills = await odooRpc<OdooBillFields[]>('object', 'execute_kw', [
    config.odoo.db, uid, config.odoo.apiKey, 'account.move', 'read', [[billId]], { fields: BILL_FIELDS },
  ])
  return bills[0] || null
}

async function findBillByOrderReference(uid: number, orderNumber: string): Promise<OdooBillFields | null> {
  const bills = await odooRpc<OdooBillFields[]>('object', 'execute_kw', [
    config.odoo.db,
    uid,
    config.odoo.apiKey,
    'account.move',
    'search_read',
    [['&', ['move_type', '=', 'in_invoice'], '|', ['invoice_origin', '=', orderNumber], ['ref', '=', orderNumber]]],
    { fields: BILL_FIELDS, limit: 1 },
  ])
  return bills[0] || null
}

async function createDraftCommissionBill(
  uid: number,
  companyId: number,
  partnerId: number,
  orderNumber: string,
  accountId: number,
  description: string,
  amount: number,
): Promise<number> {
  return odooRpc<number>('object', 'execute_kw', [
    config.odoo.db,
    uid,
    config.odoo.apiKey,
    'account.move',
    'create',
    [{
      move_type: 'in_invoice',
      partner_id: partnerId,
      company_id: companyId,
      invoice_date: new Date().toISOString().slice(0, 10),
      invoice_origin: orderNumber,
      ref: orderNumber,
      invoice_line_ids: [[0, 0, { name: description, quantity: 1, price_unit: amount, account_id: accountId }]],
    }],
  ])
}

function mapBillStateToLocal(bill: OdooBillFields): string {
  if (bill.state === 'cancel') return 'CANCELLED'
  if (bill.payment_state === 'paid') return 'PAID'
  if (bill.state === 'posted') return 'POSTED'
  return 'DRAFT_CREATED'
}

async function finalizeBill(prisma: PrismaClient, commissionId: string, bill: OdooBillFields, action: OdooBillAction): Promise<OdooBillSyncResult> {
  const status = mapBillStateToLocal(bill)
  // Odoo's JSON-RPC represents an unset Char field (the bill number sequence, not
  // assigned until posting) as the boolean `false`, not null/"".
  const billNumber = bill.name || null

  await (prisma as any).commission.update({
    where: { id: commissionId },
    data: {
      odooBillId: bill.id,
      odooBillNumber: billNumber,
      odooBillStatus: status,
      odooBillSyncError: null,
      odooBillSyncedAt: new Date(),
    },
  })

  return {
    ok: true,
    action,
    billId: bill.id,
    billNumber: billNumber ?? undefined,
    state: bill.state,
    paymentState: bill.payment_state,
  }
}

// Idempotent: safe to call repeatedly for the same order without creating duplicate vendor
// bills. Never throws — persists FAILED + the error message on the commission and returns
// { ok: false, error } instead. Only runs once the order is DELIVERED — that's the point at
// which the referred sale is considered fulfilled, so the commission cost (a "cost of sale",
// not a general operating expense) is matched to it in Odoo's books. The bill is always
// created as a draft: Billy reviews and posts it himself, same as customer invoices.
export async function syncCommissionBill(prisma: PrismaClient, orderId: string): Promise<OdooBillSyncResult> {
  const db = prisma as any

  const commission = await db.commission.findUnique({
    where: { orderId },
    include: { ambassador: { include: { user: true } }, order: true },
  })
  if (!commission) return { ok: true } // no ambassador on this order — nothing to bill

  if (commission.status === 'CANCELLED') return { ok: true }

  if (commission.order.status !== 'DELIVERED') {
    return { ok: false, error: `Order is ${commission.order.status}, not DELIVERED — commission bill sync only runs once an order is delivered` }
  }

  try {
    assertOdooConfigured()
    await db.commission.update({ where: { id: commission.id }, data: { odooBillStatus: 'SYNCING', odooBillSyncError: null } })

    const uid = await getUid()
    const companyId = await getCompanyId(uid)
    const orderNumber: string = commission.order.orderNumber || `TT-ORD-${String(commission.order.orderSeq).padStart(6, '0')}`
    const partnerId = await ensurePartnerId(prisma, commission.ambassador.user)

    if (commission.odooBillId) {
      const bill = await readBill(uid, commission.odooBillId)
      if (!bill) throw new Error(`Linked Odoo vendor bill ${commission.odooBillId} could not be found — it may have been deleted in Odoo`)
      return finalizeBill(prisma, commission.id, bill, 'ALREADY_LINKED')
    }

    // Not linked locally — check Odoo itself before creating, in case a previous sync
    // succeeded in Odoo but failed to persist the id locally.
    const existing = await findBillByOrderReference(uid, orderNumber)
    if (existing) {
      return finalizeBill(prisma, commission.id, existing, 'LINKED_BY_ORDER_REFERENCE')
    }

    const company = await db.company.findFirst()
    const accountId = await resolveAccountIdByCode(uid, company?.odooCommissionAccountCode)
    if (!accountId) {
      throw new Error('No commission expense account configured — set it in Settings → Ambassador Programme before commission bills can sync to Odoo')
    }

    const description = `Ambassador Commission — Order ${orderNumber}`
    const billId = await createDraftCommissionBill(uid, companyId, partnerId, orderNumber, accountId, description, Number(commission.amount))
    const created = await readBill(uid, billId)
    return finalizeBill(prisma, commission.id, created!, 'CREATED')
  } catch (err: any) {
    const message = err instanceof ProductMappingError ? err.message : (err?.message || 'Unknown Odoo sync error')
    await db.commission.update({
      where: { id: commission.id },
      data: { odooBillStatus: 'FAILED', odooBillSyncError: message, odooBillSyncedAt: new Date() },
    })
    return { ok: false, error: message }
  }
}

// Called when a payout is recorded for a commission (status flipped to PAID). Registers the
// payment against the linked vendor bill in Odoo — but only once that bill is posted (Billy's
// manual review step); if it's still draft, this quietly no-ops and is picked up again the
// next time this is called (e.g. a future payout-retry action). If no bill exists yet at all
// (the DELIVERED sync never ran or failed), attempts to create it first as a catch-up.
// Never throws — failures are persisted on the commission via odooBillPaymentSync*.
export async function registerCommissionPayment(prisma: PrismaClient, commissionId: string): Promise<void> {
  const db = prisma as any
  const commission = await db.commission.findUnique({ where: { id: commissionId } })
  if (!commission || commission.status !== 'PAID') return

  try {
    assertOdooConfigured()
    const uid = await getUid()
    const companyId = await getCompanyId(uid)

    let billId: number | undefined = commission.odooBillId ?? undefined
    if (!billId) {
      const billResult = await syncCommissionBill(prisma, commission.orderId)
      if (!billResult.ok || !billResult.billId) return // not ready yet — stays queued
      billId = billResult.billId
    }

    const bill = await readBill(uid, billId)
    if (!bill) throw new Error(`Linked Odoo vendor bill ${billId} could not be found`)
    if (bill.state !== 'posted') return // still draft — queued until Billy posts it

    if (bill.payment_state !== 'paid') {
      await registerOdooPayment(uid, companyId, billId, Number(commission.amount), new Date().toISOString().slice(0, 10))
    }

    const refreshed = await readBill(uid, billId)
    if (refreshed) await finalizeBill(prisma, commission.id, refreshed, 'UPDATED')

    await db.commission.update({
      where: { id: commission.id },
      data: { odooBillPaymentSyncStatus: 'SYNCED', odooBillPaymentSyncError: null, odooBillPaymentSyncedAt: new Date() },
    })
  } catch (err: any) {
    const message = err?.message || 'Unknown Odoo payment sync error'
    await db.commission.update({
      where: { id: commission.id },
      data: { odooBillPaymentSyncStatus: 'FAILED', odooBillPaymentSyncError: message, odooBillPaymentSyncedAt: new Date() },
    })
  }
}
