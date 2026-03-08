import { PrismaClient } from '@prisma/client'
import { AppError, NotFoundError } from '../../shared/errors'

const QUOTE_INCLUDE = {
  customer:  { select: { id: true, email: true, phone: true, firstName: true, lastName: true } },
  ambassador: { select: { id: true, code: true, user: { select: { firstName: true, lastName: true } } } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  items: { include: { variant: { include: { product: true } } } },
}

function calcDiscount(subtotal: number, type?: string | null, value?: number | null): number {
  if (!type || value == null || value <= 0) return 0
  if (type === 'PERCENTAGE') return Math.min(subtotal, (subtotal * value) / 100)
  if (type === 'FLAT') return Math.min(subtotal, value)
  return 0
}

export class QuoteService {
  constructor(private prisma: PrismaClient) {}

  private async resolveItems(
    items: Array<{ variantId: string; quantity: number }>,
    tier: string,
  ) {
    return Promise.all(
      items.map(async (item) => {
        const variant = await this.prisma.productVariant.findUnique({
          where: { id: item.variantId },
          include: { prices: true },
        })
        if (!variant) throw new AppError(`Variant ${item.variantId} not found`, 400)
        const price =
          variant.prices.find((p) => p.tier === tier) ||
          variant.prices.find((p) => p.tier === 'RETAIL')
        if (!price) throw new AppError(`No price for variant ${item.variantId}`, 400)
        const unitPrice = Number(price.price)
        return { variantId: item.variantId, quantity: item.quantity, unitPrice, subtotal: unitPrice * item.quantity }
      }),
    )
  }

  async create(data: {
    customerId: string
    createdById: string
    ambassadorCode?: string
    items: Array<{ variantId: string; quantity: number }>
    discountType?: string
    discountValue?: number
    deliveryFee?: number
    notes?: string
    validUntil?: string
  }) {
    let ambassadorId: string | null = null
    if (data.ambassadorCode) {
      const amb = await this.prisma.ambassador.findUnique({
        where: { code: data.ambassadorCode, status: 'ACTIVE' },
      })
      if (!amb) throw new AppError('Invalid ambassador code', 400)
      ambassadorId = amb.id
    }

    const tier = ambassadorId ? 'AMBASSADOR' : 'RETAIL'
    const itemsWithPrices = await this.resolveItems(data.items, tier)
    const subtotal = itemsWithPrices.reduce((s, i) => s + i.subtotal, 0)
    const deliveryFee = data.deliveryFee ?? 0
    const discountAmount = calcDiscount(subtotal, data.discountType, data.discountValue)
    const total = subtotal + deliveryFee - discountAmount

    const quote = await this.prisma.quote.create({
      data: {
        number: 'TEMP',
        customerId: data.customerId,
        ambassadorId,
        createdById: data.createdById,
        subtotal,
        deliveryFee,
        discountType: data.discountType ?? null,
        discountValue: data.discountValue ?? null,
        discountAmount,
        total,
        notes: data.notes ?? null,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        items: { create: itemsWithPrices },
      },
    })

    await this.prisma.quote.update({
      where: { id: quote.id },
      data: { number: `QT-${quote.id.slice(-8).toUpperCase()}` },
    })

    return this.getById(quote.id)
  }

  async getAll() {
    return this.prisma.quote.findMany({
      include: QUOTE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
  }

  async getMy(userId: string) {
    return this.prisma.quote.findMany({
      where: { createdById: userId },
      include: QUOTE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
  }

  async getById(id: string) {
    const q = await this.prisma.quote.findUnique({ where: { id }, include: QUOTE_INCLUDE })
    if (!q) throw new NotFoundError('Quote')
    return q
  }

  async update(
    id: string,
    data: {
      items?: Array<{ variantId: string; quantity: number }>
      discountType?: string | null
      discountValue?: number | null
      deliveryFee?: number
      notes?: string | null
      validUntil?: string | null
      ambassadorCode?: string | null
    },
  ) {
    const quote = await this.prisma.quote.findUnique({ where: { id }, include: { ambassador: true } })
    if (!quote) throw new NotFoundError('Quote')
    if (quote.status !== 'DRAFT') throw new AppError('Only DRAFT quotes can be edited', 400)

    let ambassadorId: string | null | undefined = undefined
    if (data.ambassadorCode !== undefined) {
      if (!data.ambassadorCode) {
        ambassadorId = null
      } else {
        const amb = await this.prisma.ambassador.findUnique({
          where: { code: data.ambassadorCode, status: 'ACTIVE' },
        })
        if (!amb) throw new AppError('Invalid ambassador code', 400)
        ambassadorId = amb.id
      }
    }

    const effectiveAmbId = ambassadorId !== undefined ? ambassadorId : quote.ambassadorId
    const tier = effectiveAmbId ? 'AMBASSADOR' : 'RETAIL'

    if (data.items) {
      const itemsWithPrices = await this.resolveItems(data.items, tier)
      await this.prisma.quoteItem.deleteMany({ where: { quoteId: id } })
      for (const item of itemsWithPrices) {
        await this.prisma.quoteItem.create({ data: { quoteId: id, ...item } })
      }
    }

    const currentItems = await this.prisma.quoteItem.findMany({ where: { quoteId: id } })
    const subtotal = currentItems.reduce((s, i) => s + Number(i.subtotal), 0)
    const deliveryFee = data.deliveryFee !== undefined ? data.deliveryFee : Number(quote.deliveryFee)
    const discountType = data.discountType !== undefined ? data.discountType : quote.discountType
    const discountValue = data.discountValue !== undefined ? data.discountValue : (quote.discountValue ? Number(quote.discountValue) : null)
    const discountAmount = calcDiscount(subtotal, discountType, discountValue)
    const total = subtotal + deliveryFee - discountAmount

    const updateData: Record<string, unknown> = { subtotal, deliveryFee, discountType, discountValue, discountAmount, total }
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.validUntil !== undefined) updateData.validUntil = data.validUntil ? new Date(data.validUntil) : null
    if (ambassadorId !== undefined) updateData.ambassadorId = ambassadorId

    await this.prisma.quote.update({ where: { id }, data: updateData })
    return this.getById(id)
  }

  async updateStatus(id: string, status: string) {
    const quote = await this.prisma.quote.findUnique({ where: { id } })
    if (!quote) throw new NotFoundError('Quote')

    const allowed: Record<string, string[]> = {
      DRAFT: ['SENT', 'DECLINED'],
      SENT:  ['ACCEPTED', 'DECLINED', 'EXPIRED'],
    }
    if (!allowed[quote.status]?.includes(status)) {
      throw new AppError(`Cannot transition from ${quote.status} to ${status}`, 400)
    }

    await this.prisma.quote.update({ where: { id }, data: { status: status as any } })
    return this.getById(id)
  }

  async convert(id: string) {
    const quote = await this.getById(id)
    if (!['SENT', 'ACCEPTED', 'DRAFT'].includes(quote.status)) {
      throw new AppError('Quote cannot be converted in its current status', 400)
    }

    const order = await this.prisma.order.create({
      data: {
        customerId: quote.customerId,
        ambassadorId: quote.ambassadorId ?? undefined,
        quoteId: id,
        subtotal: quote.subtotal,
        deliveryFee: quote.deliveryFee,
        discountType: quote.discountType ?? undefined,
        discountValue: quote.discountValue ? Number(quote.discountValue) : undefined,
        discountAmount: Number(quote.discountAmount),
        total: quote.total,
        notes: quote.notes ?? undefined,
        items: {
          create: quote.items.map((i: any) => ({
            variantId: i.variantId,
            quantity: i.quantity,
            unitPrice: Number(i.unitPrice),
            subtotal: Number(i.subtotal),
          })),
        },
        statusLogs: { create: { status: 'PENDING' } },
      },
    })

    await this.prisma.quote.update({ where: { id }, data: { status: 'ACCEPTED' } })
    return order
  }

  async remove(id: string) {
    const quote = await this.prisma.quote.findUnique({ where: { id } })
    if (!quote) throw new NotFoundError('Quote')
    if (quote.status !== 'DRAFT') throw new AppError('Only DRAFT quotes can be deleted', 400)
    await this.prisma.quote.delete({ where: { id } })
  }
}
