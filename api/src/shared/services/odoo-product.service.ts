import { PrismaClient } from '@prisma/client'
import { config } from '../../config'
import { odooRpc, getUid, assertOdooConfigured } from './odoo-client'

export class ProductMappingError extends Error {}

interface OdooProductInfo {
  id: number
  name: string
  default_code: string | false
}

async function findOdooProductByReference(uid: number, reference: string): Promise<OdooProductInfo | null> {
  const products = await odooRpc<OdooProductInfo[]>('object', 'execute_kw', [
    config.odoo.db,
    uid,
    config.odoo.apiKey,
    'product.product',
    'search_read',
    [[['default_code', '=', reference]]],
    { fields: ['id', 'name', 'default_code', 'list_price', 'taxes_id', 'uom_id', 'active'], limit: 1 },
  ])
  return products[0] || null
}

const incomeAccountCache = new Map<string, number>()

// Resolves an account.account by its code (e.g. "500010"). Returns null when no code is
// configured (Odoo then falls back to the product/category default); throws if a code
// *is* configured but doesn't exist in Odoo, since that's a real misconfiguration worth
// surfacing rather than silently ignoring.
async function resolveIncomeAccountId(uid: number, code: string | null | undefined): Promise<number | undefined> {
  if (!code) return undefined
  if (incomeAccountCache.has(code)) return incomeAccountCache.get(code)

  const accounts = await odooRpc<Array<{ id: number }>>('object', 'execute_kw', [
    config.odoo.db, uid, config.odoo.apiKey, 'account.account', 'search_read', [[['code', '=', code]]], { fields: ['id'], limit: 1 },
  ])
  if (!accounts.length) throw new ProductMappingError(`Odoo income account "${code}" not found (account.account)`)

  incomeAccountCache.set(code, accounts[0].id)
  return accounts[0].id
}

// Exposed for tests only, to reset the module-level cache between cases.
export function _resetIncomeAccountCacheForTests() {
  incomeAccountCache.clear()
}

// Everything created through this integration is something Tlaka Treats sells to
// customers (a finished good, delivery fee, or discount line) — never an ingredient —
// so it's marked sellable-only in Odoo, not purchasable, to keep the two apart there too.
async function createOdooProduct(uid: number, reference: string, name: string, incomeAccountId?: number): Promise<number> {
  return odooRpc<number>('object', 'execute_kw', [
    config.odoo.db,
    uid,
    config.odoo.apiKey,
    'product.product',
    'create',
    [{
      name,
      default_code: reference,
      sale_ok: true,
      purchase_ok: false,
      ...(incomeAccountId ? { property_account_income_id: incomeAccountId } : {}),
    }],
  ])
}

type VariantForMapping = {
  id: string
  name: string
  odooProductId: number | null
  odooProductReference: string | null
  product?: { name: string; classification?: string; category?: { odooIncomeAccountCode?: string | null } | null } | null
}

// Derives a stable default_code from the product/variant name when no reference has
// been set manually, e.g. "Melting Moments" + "5L Bucket" -> "MELTING-MOMENTS-5L-BUCKET".
function generateReference(variant: VariantForMapping): string {
  const raw = `${variant.product?.name ?? ''} ${variant.name}`
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// Matching priority: 1) stored odooProductId  2) odooProductReference vs Odoo default_code
// 3) auto-create (only when ODOO_AUTO_CREATE_PRODUCTS=true) — generating a reference from
// the product/variant name first if none was set manually. Caches the resolved id (and any
// generated reference) back onto the variant so subsequent syncs skip the Odoo lookup.
// The income account is only applied when *creating* a new Odoo product — an existing one
// is never silently rewritten.
export async function resolveOdooProductId(prisma: PrismaClient, uid: number, variant: VariantForMapping): Promise<number> {
  if (variant.odooProductId) return variant.odooProductId

  const label = `${variant.product?.name ?? 'Unknown product'} — ${variant.name}`
  let reference = variant.odooProductReference

  if (!reference) {
    if (!config.odoo.autoCreateProducts) {
      throw new ProductMappingError(`Product mapping missing for ${label} (no Odoo reference configured on this variant)`)
    }
    reference = generateReference(variant)
  }

  const syncFields = { odooProductSyncStatus: 'SYNCED' as const, odooProductSyncError: null, odooProductSyncedAt: new Date() }

  const found = await findOdooProductByReference(uid, reference)
  if (found) {
    await (prisma as any).productVariant.update({ where: { id: variant.id }, data: { odooProductId: found.id, odooProductReference: reference, ...syncFields } })
    return found.id
  }

  if (!config.odoo.autoCreateProducts) {
    throw new ProductMappingError(`Product mapping missing for SKU ${reference}`)
  }

  const incomeAccountId = await resolveIncomeAccountId(uid, variant.product?.category?.odooIncomeAccountCode)
  const newId = await createOdooProduct(uid, reference, label, incomeAccountId)
  await (prisma as any).productVariant.update({ where: { id: variant.id }, data: { odooProductId: newId, odooProductReference: reference, ...syncFields } })
  return newId
}

// Used for the fixed "service" line items (delivery fee, order-level discount) that
// aren't tied to a ProductVariant, so they're mapped by a single configured reference
// instead of per-variant admin mapping.
export async function resolveServiceProductId(uid: number, reference: string, label: string, incomeAccountCode?: string): Promise<number> {
  const found = await findOdooProductByReference(uid, reference)
  if (found) return found.id

  if (!config.odoo.autoCreateProducts) {
    throw new ProductMappingError(`Product mapping missing for SKU ${reference} (${label})`)
  }

  const incomeAccountId = await resolveIncomeAccountId(uid, incomeAccountCode)
  return createOdooProduct(uid, reference, label, incomeAccountId)
}

// Pushes a single variant to Odoo right away (product creation / admin retry), rather than
// waiting for it to first appear in a confirmed order. Persists odooProductSyncStatus/Error
// either way (mirroring syncCustomerToOdoo) but still throws on failure, so callers — the
// fire-and-forget product-creation hook, and a future retry route — decide for themselves
// whether to swallow it or surface it.
export async function syncProductVariantToOdoo(prisma: PrismaClient, variantId: string): Promise<void> {
  const db = prisma as any
  const variant = await db.productVariant.findUnique({
    where: { id: variantId },
    include: { product: { include: { category: true } } },
  })
  if (!variant) return
  if (variant.odooProductId) return
  if (variant.product?.classification && variant.product.classification !== 'SELLABLE') return

  try {
    assertOdooConfigured()
    const uid = await getUid()
    await resolveOdooProductId(prisma, uid, variant)
  } catch (err: any) {
    const message = err?.message || 'Unknown Odoo sync error'
    await db.productVariant.update({
      where: { id: variantId },
      data: { odooProductSyncStatus: 'FAILED', odooProductSyncError: message, odooProductSyncedAt: new Date() },
    }).catch(() => {/* the original error is what matters */})
    throw err
  }
}
