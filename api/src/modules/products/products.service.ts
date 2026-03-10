import { PrismaClient, PricingTier, ProductClassification } from '@prisma/client'
import { NotFoundError } from '../../shared/errors'

export class ProductService {
  constructor(private prisma: PrismaClient) {}

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
    return (this.prisma as any).product.create({
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
    return this.prisma.productVariant.create({
      data: {
        productId,
        name: data.name,
        prices: { create: data.prices },
      },
      include: { prices: true },
    })
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
