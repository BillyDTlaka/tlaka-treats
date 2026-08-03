import { PrismaClient, PricingTier, ProductClassification } from '@prisma/client'
import { NotFoundError } from '../../shared/errors'
import { syncProductVariantToOdoo } from '../../shared/services/odoo-product.service'

export class ProductService {
  constructor(private prisma: PrismaClient) {}

  // ── Categories ────────────────────────────────────────────────────────────

  async listCategories() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    })
  }

  async createCategory(name: string, description?: string) {
    return this.prisma.category.upsert({
      where: { name },
      update: { isActive: true, description },
      create: { name, description },
    })
  }

  async deleteCategory(id: string) {
    await this.prisma.category.update({ where: { id }, data: { isActive: false } })
  }

  // Sets the Odoo account.account code (e.g. "500010") products in this category post revenue against.
  async updateCategoryOdooIncomeAccount(id: string, odooIncomeAccountCode: string | null) {
    return this.prisma.category.update({
      where: { id },
      data: { odooIncomeAccountCode: odooIncomeAccountCode?.trim() || null },
    })
  }

  // ── Variant helpers ───────────────────────────────────────────────────────

  async deleteVariant(variantId: string) {
    await this.prisma.productVariant.update({ where: { id: variantId }, data: { isActive: false } })
  }

  // Sets the Odoo default_code this variant should match against product.product.
  // Clears any cached odooProductId so the next invoice sync re-resolves against the new reference.
  async updateVariantOdooMapping(variantId: string, data: { odooProductReference?: string | null }) {
    return this.prisma.productVariant.update({
      where: { id: variantId },
      data: {
        odooProductReference: data.odooProductReference?.trim() || null,
        odooProductId: null,
      },
    })
  }

  async updateVariantPrice(variantId: string, data: { tier: PricingTier; price: number }) {
    const existing = await (this.prisma as any).productVariantPrice.findFirst({
      where: { variantId, tier: data.tier },
    })
    if (existing) {
      return (this.prisma as any).productVariantPrice.update({
        where: { id: existing.id },
        data: { price: data.price },
      })
    }
    return (this.prisma as any).productVariantPrice.create({
      data: { variantId, tier: data.tier, price: data.price },
    })
  }

  async getAll(tier: PricingTier = 'RETAIL') {
    const products = await this.prisma.product.findMany({
      where: { isActive: true, classification: 'SELLABLE' },
      include: {
        category: true,
        variants: {
          where: { isActive: true },
          include: {
            prices: { where: { tier } },
          },
        },
        stockItem: { select: { currentStock: true, minStockLevel: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return products
  }

  async getById(id: string, tier: PricingTier = 'RETAIL') {
    const product = await this.prisma.product.findUnique({
      where: { id, isActive: true },
      include: {
        category: true,
        variants: {
          where: { isActive: true },
          include: { prices: true },
        },
      },
    })
    if (!product) throw new NotFoundError('Product')
    return product
  }

  async create(data: {
    name: string
    description?: string
    brand?: string
    supplierId?: string
    imageUrl?: string
    images?: { url: string; isPrimary: boolean }[]
    classification?: ProductClassification
    categoryId?: string
    uomId?: string
    variants?: Array<{
      name: string
      prices: Array<{ tier: PricingTier; price: number }>
    }>
  }) {
    // Derive primary imageUrl from images array if not explicitly provided
    const primaryImage = data.images?.find(i => i.isPrimary)?.url ?? data.images?.[0]?.url
    const product = await (this.prisma as any).product.create({
      data: {
        name: data.name,
        description: data.description,
        brand: data.brand,
        supplierId: data.supplierId || undefined,
        imageUrl: data.imageUrl ?? primaryImage,
        images: data.images as any,
        classification: data.classification ?? 'SELLABLE',
        categoryId: data.categoryId,
        uomId: data.uomId || undefined,
        variants: data.variants
          ? {
              create: data.variants.map(v => ({
                name: v.name,
                prices: { create: v.prices },
              })),
            }
          : undefined,
      },
      include: { variants: { include: { prices: true } }, category: true, supplier: { select: { id: true, name: true } } },
    })

    // Sync each variant to Odoo now, rather than waiting for it to first appear in a
    // confirmed order — fire-and-forget, failures are visible in the admin monitoring view.
    for (const variant of product.variants) {
      syncProductVariantToOdoo(this.prisma, variant.id).catch(err => console.error('[odoo] product sync failed:', err.message))
    }

    return product
  }

  async getAllAdmin() {
    return (this.prisma as any).product.findMany({
      include: {
        category: true,
        supplier: { select: { id: true, name: true } },
        variants: { include: { prices: true } },
        stockItem: { select: { id: true, currentStock: true, unit: true, uomId: true, uom: { select: { abbreviation: true, name: true } } } },
        uom: { select: { id: true, name: true, abbreviation: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async addVariant(productId: string, data: {
    name: string
    prices: Array<{ tier: PricingTier; price: number }>
  }) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } })
    if (!product) throw new NotFoundError('Product')
    const variant = await this.prisma.productVariant.create({
      data: {
        productId,
        name: data.name,
        prices: { create: data.prices },
      },
      include: { prices: true },
    })

    syncProductVariantToOdoo(this.prisma, variant.id).catch(err => console.error('[odoo] product sync failed:', err.message))

    return variant
  }

  async update(id: string, data: Partial<{
    name: string
    description: string
    brand: string
    supplierId: string
    imageUrl: string
    images: { url: string; isPrimary: boolean }[]
    classification: ProductClassification
    isActive: boolean
    uomId: string
  }>) {
    const product = await (this.prisma as any).product.findUnique({ where: { id } })
    if (!product) throw new NotFoundError('Product')
    // Sync imageUrl from images array if images are being updated
    const updateData: any = { ...data }
    if (data.supplierId === '') updateData.supplierId = null
    if (data.images) {
      const primary = data.images.find(i => i.isPrimary)?.url ?? data.images[0]?.url
      if (primary && !data.imageUrl) updateData.imageUrl = primary
    }
    return (this.prisma as any).product.update({ where: { id }, data: updateData })
  }
}
