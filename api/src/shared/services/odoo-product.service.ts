import { PrismaClient } from '@prisma/client'
import { config } from '../../config'
import { odooRpc, getUid, assertOdooConfigured } from './odoo-client'

export class ProductMappingError extends Error {}

const VARIANT_ATTRIBUTE_NAME = 'Variant'

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

// Resolves an account.account by its code (e.g. "500010"). Returns undefined when no code is
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

// Everything created through this integration is something Tlaka Treats sells to
// customers (a finished good, delivery fee, or discount line) — never an ingredient —
// so it's marked sellable-only in Odoo, not purchasable, to keep the two apart there too.
// taxes_id is explicitly cleared: Odoo otherwise auto-applies the company's default sales
// tax to every new product, and Tlaka Treats isn't VAT registered — no tax belongs here yet.
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
      taxes_id: [[6, 0, []]],
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
function generateReference(productName: string | undefined, variantName: string): string {
  const raw = `${productName ?? ''} ${variantName}`
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// Matching priority: 1) stored odooProductId  2) odooProductReference vs Odoo default_code
// 3) auto-create (only when ODOO_AUTO_CREATE_PRODUCTS=true) as a *standalone* product — used
// as a fallback by the order-invoice flow for a variant that somehow wasn't already synced
// via syncProductToOdoo (the normal, product-creation-time path — see below — which creates
// proper Odoo variants grouped under one template instead).
export async function resolveOdooProductId(prisma: PrismaClient, uid: number, variant: VariantForMapping): Promise<number> {
  if (variant.odooProductId) return variant.odooProductId

  const label = `${variant.product?.name ?? 'Unknown product'} — ${variant.name}`
  let reference = variant.odooProductReference

  if (!reference) {
    if (!config.odoo.autoCreateProducts) {
      throw new ProductMappingError(`Product mapping missing for ${label} (no Odoo reference configured on this variant)`)
    }
    reference = generateReference(variant.product?.name, variant.name)
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

// ── Proper Odoo variants ─────────────────────────────────────────────────────────
// One product.template per app Product, one shared "Variant" product.attribute, and one
// product.attribute.value per ProductVariant name. Odoo generates the actual product.product
// rows itself from the template's attribute line, so e.g. "Choc Chip Biscuits" shows up as a
// single product in Odoo with 5L/10L/20L Bucket variants underneath, not three unrelated
// products.

let cachedAttributeId: number | null = null

async function getVariantAttributeId(uid: number): Promise<number> {
  if (cachedAttributeId) return cachedAttributeId
  const existing = await odooRpc<Array<{ id: number }>>('object', 'execute_kw', [
    config.odoo.db, uid, config.odoo.apiKey, 'product.attribute', 'search_read', [[['name', '=', VARIANT_ATTRIBUTE_NAME]]], { fields: ['id'], limit: 1 },
  ])
  if (existing.length) {
    cachedAttributeId = existing[0].id
    return cachedAttributeId
  }
  cachedAttributeId = await odooRpc<number>('object', 'execute_kw', [
    config.odoo.db, uid, config.odoo.apiKey, 'product.attribute', 'create', [{ name: VARIANT_ATTRIBUTE_NAME, create_variant: 'always' }],
  ])
  return cachedAttributeId
}

// Attribute values are shared/reusable across every product template using this attribute
// (that's how Odoo's own variant system works), so the same "5L Bucket" value gets reused
// if it recurs on a different product rather than duplicated.
const attributeValueCache = new Map<string, number>()

async function findOrCreateAttributeValue(uid: number, attributeId: number, name: string): Promise<number> {
  const cacheKey = `${attributeId}:${name}`
  if (attributeValueCache.has(cacheKey)) return attributeValueCache.get(cacheKey)!

  const existing = await odooRpc<Array<{ id: number }>>('object', 'execute_kw', [
    config.odoo.db, uid, config.odoo.apiKey, 'product.attribute.value', 'search_read',
    [[['attribute_id', '=', attributeId], ['name', '=', name]]], { fields: ['id'], limit: 1 },
  ])
  if (existing.length) {
    attributeValueCache.set(cacheKey, existing[0].id)
    return existing[0].id
  }

  const id = await odooRpc<number>('object', 'execute_kw', [
    config.odoo.db, uid, config.odoo.apiKey, 'product.attribute.value', 'create', [{ name, attribute_id: attributeId }],
  ])
  attributeValueCache.set(cacheKey, id)
  return id
}

// Finds the specific product.product Odoo generated for one attribute value combination.
async function findGeneratedVariant(uid: number, templateId: number, valueId: number): Promise<number | null> {
  const products = await odooRpc<Array<{ id: number }>>('object', 'execute_kw', [
    config.odoo.db, uid, config.odoo.apiKey, 'product.product', 'search_read',
    [[['product_tmpl_id', '=', templateId], ['product_template_attribute_value_ids.product_attribute_value_id', '=', valueId]]],
    { fields: ['id'], limit: 1 },
  ])
  return products[0]?.id ?? null
}

// The template's own list_price is always created as 0 (see syncProductToOdoo) and each
// variant's real price is set as price_extra on its product.template.attribute.value — the
// junction record Odoo creates per (template, attribute value) — so the variant's computed
// sales price (list_price + price_extra) equals the variant's actual price.
async function setVariantPriceExtra(uid: number, templateId: number, valueId: number, priceExtra: number): Promise<void> {
  const records = await odooRpc<Array<{ id: number }>>('object', 'execute_kw', [
    config.odoo.db, uid, config.odoo.apiKey, 'product.template.attribute.value', 'search_read',
    [[['product_tmpl_id', '=', templateId], ['product_attribute_value_id', '=', valueId]]],
    { fields: ['id'], limit: 1 },
  ])
  if (!records.length) throw new ProductMappingError(`Could not find the generated attribute-value record to set price for template ${templateId}`)
  await odooRpc('object', 'execute_kw', [
    config.odoo.db, uid, config.odoo.apiKey, 'product.template.attribute.value', 'write', [[records[0].id], { price_extra: priceExtra }],
  ])
}

type VariantRow = {
  id: string
  name: string
  odooProductId: number | null
  odooProductReference: string | null
  prices?: Array<{ tier: string; price: unknown }>
}
type ProductForSync = {
  id: string
  name: string
  classification: string
  odooTemplateId: number | null
  category?: { odooIncomeAccountCode?: string | null } | null
  variants: VariantRow[]
}

// Prefers the RETAIL tier — the standard walk-in price — falling back to whatever price
// exists if a variant has no RETAIL entry, rather than leaving Odoo's price at 0.
function getRetailPrice(variant: VariantRow): number {
  const retail = variant.prices?.find(p => p.tier === 'RETAIL')
  const any = retail ?? variant.prices?.[0]
  return any ? Number(any.price) : 0
}

async function assignVariantCode(prisma: PrismaClient, uid: number, variant: VariantRow, productProductId: number): Promise<void> {
  const reference = variant.odooProductReference || generateReference(undefined, variant.name)
  await odooRpc('object', 'execute_kw', [
    config.odoo.db, uid, config.odoo.apiKey, 'product.product', 'write', [[productProductId], { default_code: reference }],
  ])
  await (prisma as any).productVariant.update({
    where: { id: variant.id },
    data: {
      odooProductId: productProductId,
      odooProductReference: reference,
      odooProductSyncStatus: 'SYNCED',
      odooProductSyncError: null,
      odooProductSyncedAt: new Date(),
    },
  })
}

// Creates (or extends) the one Odoo product.template for this app Product, adding a real
// Odoo variant for each local ProductVariant that isn't already synced. Variants synced
// under the old standalone-product model (odooProductId set, no template) are left as-is.
export async function syncProductToOdoo(prisma: PrismaClient, productId: string): Promise<void> {
  const db = prisma as any
  const product: ProductForSync | null = await db.product.findUnique({
    where: { id: productId },
    include: { category: true, variants: { include: { prices: true } } },
  })
  if (!product) return
  if (product.classification !== 'SELLABLE') return

  const pending = product.variants.filter(v => !v.odooProductId)
  if (!pending.length) return

  try {
    assertOdooConfigured()
    const uid = await getUid()
    const attributeId = await getVariantAttributeId(uid)
    const valueIds = await Promise.all(pending.map(v => findOrCreateAttributeValue(uid, attributeId, v.name)))

    let templateId = product.odooTemplateId

    if (!templateId) {
      const incomeAccountId = await resolveIncomeAccountId(uid, product.category?.odooIncomeAccountCode)
      templateId = await odooRpc<number>('object', 'execute_kw', [
        config.odoo.db, uid, config.odoo.apiKey, 'product.template', 'create', [{
          name: product.name,
          sale_ok: true,
          purchase_ok: false,
          list_price: 0, // each variant's real price is set as price_extra below
          taxes_id: [[6, 0, []]], // no default sales tax — Tlaka Treats isn't VAT registered yet
          ...(incomeAccountId ? { property_account_income_id: incomeAccountId } : {}),
          attribute_line_ids: [[0, 0, { attribute_id: attributeId, value_ids: [[6, 0, valueIds]] }]],
        }],
      ])
      await db.product.update({ where: { id: productId }, data: { odooTemplateId: templateId } })
    } else {
      // Template already exists — add any new values to its "Variant" attribute line.
      const lines = await odooRpc<Array<{ id: number; value_ids: number[] }>>('object', 'execute_kw', [
        config.odoo.db, uid, config.odoo.apiKey, 'product.template.attribute.line', 'search_read',
        [[['product_tmpl_id', '=', templateId], ['attribute_id', '=', attributeId]]], { fields: ['id', 'value_ids'] },
      ])
      const newValueIds = valueIds.filter(id => !lines[0]?.value_ids?.includes(id))
      if (lines.length && newValueIds.length) {
        await odooRpc('object', 'execute_kw', [
          config.odoo.db, uid, config.odoo.apiKey, 'product.template.attribute.line', 'write',
          [[lines[0].id], { value_ids: newValueIds.map(id => [4, id]) }],
        ])
      } else if (!lines.length) {
        await odooRpc('object', 'execute_kw', [
          config.odoo.db, uid, config.odoo.apiKey, 'product.template', 'write',
          [[templateId], { attribute_line_ids: [[0, 0, { attribute_id: attributeId, value_ids: [[6, 0, valueIds]] }]] }],
        ])
      }
    }

    for (let i = 0; i < pending.length; i++) {
      const productProductId = await findGeneratedVariant(uid, templateId, valueIds[i])
      if (!productProductId) throw new ProductMappingError(`Odoo did not generate a variant for "${pending[i].name}" on template ${templateId}`)
      await setVariantPriceExtra(uid, templateId, valueIds[i], getRetailPrice(pending[i]))
      await assignVariantCode(prisma, uid, pending[i], productProductId)
    }
  } catch (err: any) {
    const message = err?.message || 'Unknown Odoo sync error'
    await Promise.all(pending.map(v =>
      db.productVariant.update({
        where: { id: v.id },
        data: { odooProductSyncStatus: 'FAILED', odooProductSyncError: message, odooProductSyncedAt: new Date() },
      }).catch(() => {/* the original error is what matters */}),
    ))
    throw err
  }
}

// Exposed for tests only, to reset module-level caches between cases.
export function _resetIncomeAccountCacheForTests() {
  incomeAccountCache.clear()
}
export function _resetVariantAttributeCacheForTests() {
  cachedAttributeId = null
  attributeValueCache.clear()
}
