import { PrismaClient } from '@prisma/client'
import { config } from '../../config'
import { odooRpc, getUid, getCompanyId, assertOdooConfigured } from './odoo-client'
import { resolveAccountIdByCode, ProductMappingError } from './odoo-product.service'
import { computeOrderCost } from './order-cost.service'

export type OdooCogsAction = 'CREATED' | 'ALREADY_LINKED' | 'LINKED_BY_ORDER_REFERENCE'

export interface OdooCogsSyncResult {
  ok: boolean
  action?: OdooCogsAction
  moveId?: number
  moveNumber?: string
  state?: string
  amount?: number
  error?: string
}

interface OdooMoveFields {
  id: number
  name: string | false
  state: string
  ref: string | false
}

const MOVE_FIELDS = ['id', 'name', 'state', 'ref']

async function readMove(uid: number, moveId: number): Promise<OdooMoveFields | null> {
  const moves = await odooRpc<OdooMoveFields[]>('object', 'execute_kw', [
    config.odoo.db, uid, config.odoo.apiKey, 'account.move', 'read', [[moveId]], { fields: MOVE_FIELDS },
  ])
  return moves[0] || null
}

async function findMoveByOrderReference(uid: number, orderNumber: string): Promise<OdooMoveFields | null> {
  const moves = await odooRpc<OdooMoveFields[]>('object', 'execute_kw', [
    config.odoo.db, uid, config.odoo.apiKey, 'account.move', 'search_read',
    [['&', ['move_type', '=', 'entry'], ['ref', '=', orderNumber]]],
    { fields: MOVE_FIELDS, limit: 1 },
  ])
  return moves[0] || null
}

// The "Miscellaneous Operations" journal — the generic journal plain journal entries
// (move_type: entry) post through, as opposed to the Sales/Purchases/Bank journals invoices
// and payments use. Resolved once per process, same caching pattern as the bank journal in
// odoo-invoice.service.ts.
let cachedGeneralJournalId: number | null = null

async function getGeneralJournalId(uid: number, companyId: number): Promise<number> {
  if (cachedGeneralJournalId) return cachedGeneralJournalId
  const journals = await odooRpc<Array<{ id: number }>>('object', 'execute_kw', [
    config.odoo.db, uid, config.odoo.apiKey, 'account.journal', 'search_read',
    [[['type', '=', 'general'], ['company_id', '=', companyId]]], { fields: ['id'], limit: 1 },
  ])
  if (!journals.length) throw new Error('No general/miscellaneous journal found in Odoo for this company')
  cachedGeneralJournalId = journals[0].id
  return cachedGeneralJournalId
}

async function createDraftCogsEntry(
  uid: number,
  companyId: number,
  journalId: number,
  orderNumber: string,
  debitAccountId: number,
  creditAccountId: number,
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
      move_type: 'entry',
      journal_id: journalId,
      company_id: companyId,
      date: new Date().toISOString().slice(0, 10),
      ref: orderNumber,
      line_ids: [
        [0, 0, { name: description, account_id: debitAccountId, debit: amount, credit: 0 }],
        [0, 0, { name: description, account_id: creditAccountId, debit: 0, credit: amount }],
      ],
    }],
  ])
}

function mapMoveStateToLocal(move: OdooMoveFields): string {
  if (move.state === 'cancel') return 'CANCELLED'
  if (move.state === 'posted') return 'POSTED'
  return 'DRAFT_CREATED'
}

async function finalizeMove(prisma: PrismaClient, orderId: string, move: OdooMoveFields, action: OdooCogsAction, amount?: number): Promise<OdooCogsSyncResult> {
  const status = mapMoveStateToLocal(move)
  // Same as invoices/bills — Odoo represents an unassigned Char sequence as `false`, not null.
  const moveNumber = move.name || null

  await (prisma as any).order.update({
    where: { id: orderId },
    data: {
      odooCogsMoveId: move.id,
      odooCogsMoveNumber: moveNumber,
      odooCogsStatus: status,
      odooCogsSyncError: null,
      odooCogsSyncedAt: new Date(),
    },
  })

  return { ok: true, action, moveId: move.id, moveNumber: moveNumber ?? undefined, state: move.state, amount }
}

// Idempotent: safe to call repeatedly for the same order without creating duplicate entries.
// Never throws — persists FAILED + the error message on the order and returns { ok: false,
// error } instead. Only runs once the order is DELIVERED, matching the commission bill's
// "cost of sale, matched to the fulfilled order" timing (see odoo-commission-bill.service.ts).
// Computes (and freezes) the cost snapshot on first run; once an Odoo entry exists, later
// calls reuse the frozen Order.cogsAmount rather than silently drifting the posted amount.
export async function syncOrderCogs(prisma: PrismaClient, orderId: string): Promise<OdooCogsSyncResult> {
  const db = prisma as any

  const order = await db.order.findUnique({ where: { id: orderId } })
  if (!order) return { ok: false, error: 'Order not found' }

  if (order.status !== 'DELIVERED') {
    return { ok: false, error: `Order is ${order.status}, not DELIVERED — cost-of-sale sync only runs once an order is delivered` }
  }

  try {
    let amount: number
    let uncostedItems: string[] = []
    if (order.odooCogsMoveId) {
      amount = Number(order.cogsAmount || 0)
    } else {
      const computed = await computeOrderCost(prisma, orderId)
      amount = computed.total
      uncostedItems = computed.uncostedItems
    }

    if (amount <= 0) {
      const detail = uncostedItems.length ? `: ${uncostedItems.join(', ')} have no linked recipe to cost from` : ''
      const message = `Nothing to post — computed cost of sale is R0${detail}`
      await db.order.update({ where: { id: orderId }, data: { odooCogsStatus: 'FAILED', odooCogsSyncError: message, odooCogsSyncedAt: new Date() } })
      return { ok: false, error: message }
    }

    assertOdooConfigured()
    await db.order.update({ where: { id: orderId }, data: { odooCogsStatus: 'SYNCING', odooCogsSyncError: null } })

    const uid = await getUid()
    const companyId = await getCompanyId(uid)
    const orderNumber: string = order.orderNumber || `TT-ORD-${String(order.orderSeq).padStart(6, '0')}`

    if (order.odooCogsMoveId) {
      const move = await readMove(uid, order.odooCogsMoveId)
      if (!move) throw new Error(`Linked Odoo journal entry ${order.odooCogsMoveId} could not be found — it may have been deleted in Odoo`)
      return finalizeMove(prisma, orderId, move, 'ALREADY_LINKED', amount)
    }

    // Not linked locally — check Odoo itself before creating, in case a previous sync
    // succeeded in Odoo but failed to persist the id locally.
    const existing = await findMoveByOrderReference(uid, orderNumber)
    if (existing) {
      return finalizeMove(prisma, orderId, existing, 'LINKED_BY_ORDER_REFERENCE', amount)
    }

    const company = await db.company.findFirst()
    const debitAccountId = await resolveAccountIdByCode(uid, company?.odooCogsExpenseAccountCode)
    const creditAccountId = await resolveAccountIdByCode(uid, company?.odooCogsClearingAccountCode)
    if (!debitAccountId || !creditAccountId) {
      throw new Error('COGS expense/clearing accounts not fully configured — set both in Settings before cost-of-sale entries can sync to Odoo')
    }

    const journalId = await getGeneralJournalId(uid, companyId)
    const description = `Cost of Goods Sold — Order ${orderNumber}`
    const moveId = await createDraftCogsEntry(uid, companyId, journalId, orderNumber, debitAccountId, creditAccountId, description, amount)
    const created = await readMove(uid, moveId)
    return finalizeMove(prisma, orderId, created!, 'CREATED', amount)
  } catch (err: any) {
    const message = err instanceof ProductMappingError ? err.message : (err?.message || 'Unknown Odoo sync error')
    await db.order.update({
      where: { id: orderId },
      data: { odooCogsStatus: 'FAILED', odooCogsSyncError: message, odooCogsSyncedAt: new Date() },
    })
    return { ok: false, error: message }
  }
}

// Exposed for tests only.
export function _resetGeneralJournalCacheForTests() {
  cachedGeneralJournalId = null
}
