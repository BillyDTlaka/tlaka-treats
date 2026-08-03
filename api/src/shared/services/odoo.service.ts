import { PrismaClient } from '@prisma/client'
import { config } from '../../config'
import { odooRpc, getUid, getCompanyId, assertOdooConfigured } from './odoo-client'

const CUSTOMER_TAG_NAME = 'TT Customer'

let cachedTagId: number | null = null

async function getTagId(uid: number): Promise<number> {
  if (cachedTagId) return cachedTagId
  const existing = await odooRpc<Array<{ id: number }>>('object', 'execute_kw', [
    config.odoo.db,
    uid,
    config.odoo.apiKey,
    'res.partner.category',
    'search_read',
    [[['name', '=', CUSTOMER_TAG_NAME]]],
    { fields: ['id'], limit: 1 },
  ])
  if (existing.length) {
    cachedTagId = existing[0].id
    return cachedTagId
  }
  cachedTagId = await odooRpc<number>('object', 'execute_kw', [
    config.odoo.db, uid, config.odoo.apiKey, 'res.partner.category', 'create', [{ name: CUSTOMER_TAG_NAME }],
  ])
  return cachedTagId
}

async function createOdooContact(input: { name: string; email?: string | null; phone?: string | null }): Promise<number> {
  const uid = await getUid()
  const [companyId, tagId] = await Promise.all([getCompanyId(uid), getTagId(uid)])
  return odooRpc<number>('object', 'execute_kw', [
    config.odoo.db,
    uid,
    config.odoo.apiKey,
    'res.partner',
    'create',
    [{
      name: input.name,
      email: input.email || false,
      phone: input.phone || false,
      customer_rank: 1,
      company_id: companyId,
      category_id: [[6, 0, [tagId]]],
    }],
  ])
}

// Skips creation if odooPartnerId is already set, so retried calls don't create duplicate contacts.
// Persists odooSyncStatus/Error either way, so failures are visible in the admin monitoring
// view instead of only in server logs — but still throws on failure, so callers that depend
// on a partner id existing afterward (e.g. the order-invoice sync) fail loudly as before.
export async function syncCustomerToOdoo(
  prisma: PrismaClient,
  user: { id: string; email: string; firstName: string; lastName: string; phone?: string | null; odooPartnerId?: string | null },
): Promise<void> {
  if (user.odooPartnerId) return

  try {
    assertOdooConfigured()

    const partnerId = await createOdooContact({
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      phone: user.phone,
    })

    await (prisma as any).user.update({
      where: { id: user.id },
      data: { odooPartnerId: String(partnerId), odooSyncStatus: 'SYNCED', odooSyncError: null, odooSyncedAt: new Date() },
    })
  } catch (err: any) {
    const message = err?.message || 'Unknown Odoo sync error'
    await (prisma as any).user.update({
      where: { id: user.id },
      data: { odooSyncStatus: 'FAILED', odooSyncError: message, odooSyncedAt: new Date() },
    }).catch(() => {/* the original error is what matters; swallow a secondary write failure */})
    throw err
  }
}
