import { PrismaClient } from '@prisma/client'
import { config } from '../../config'
import { odooRpc } from './odoo-client'

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

async function createOdooProduct(uid: number, reference: string, name: string): Promise<number> {
  return odooRpc<number>('object', 'execute_kw', [
    config.odoo.db, uid, config.odoo.apiKey, 'product.product', 'create', [{ name, default_code: reference, sale_ok: true }],
  ])
}

type VariantForMapping = {
  id: string
  name: string
  odooProductId: number | null
  odooProductReference: string | null
  product?: { name: string } | null
}

// Matching priority: 1) stored odooProductId  2) odooProductReference vs Odoo default_code
// 3) auto-create only when ODOO_AUTO_CREATE_PRODUCTS=true. Caches the resolved id back onto
// the variant so subsequent orders skip the Odoo lookup entirely.
export async function resolveOdooProductId(prisma: PrismaClient, uid: number, variant: VariantForMapping): Promise<number> {
  if (variant.odooProductId) return variant.odooProductId

  const label = `${variant.product?.name ?? 'Unknown product'} — ${variant.name}`

  if (!variant.odooProductReference) {
    throw new ProductMappingError(`Product mapping missing for ${label} (no Odoo reference configured on this variant)`)
  }

  const found = await findOdooProductByReference(uid, variant.odooProductReference)
  if (found) {
    await (prisma as any).productVariant.update({ where: { id: variant.id }, data: { odooProductId: found.id } })
    return found.id
  }

  if (!config.odoo.autoCreateProducts) {
    throw new ProductMappingError(`Product mapping missing for SKU ${variant.odooProductReference}`)
  }

  const newId = await createOdooProduct(uid, variant.odooProductReference, label)
  await (prisma as any).productVariant.update({ where: { id: variant.id }, data: { odooProductId: newId } })
  return newId
}

// Used for the fixed "service" line items (delivery fee, order-level discount) that
// aren't tied to a ProductVariant, so they're mapped by a single configured reference
// instead of per-variant admin mapping.
export async function resolveServiceProductId(uid: number, reference: string, label: string): Promise<number> {
  const found = await findOdooProductByReference(uid, reference)
  if (found) return found.id

  if (!config.odoo.autoCreateProducts) {
    throw new ProductMappingError(`Product mapping missing for SKU ${reference} (${label})`)
  }

  return createOdooProduct(uid, reference, label)
}
