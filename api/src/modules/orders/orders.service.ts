import { PrismaClient, OrderStatus } from '@prisma/client'
import { AppError, NotFoundError, ForbiddenError } from '../../shared/errors'

export class OrderService {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    customerId: string
    ambassadorCode?: string
    addressId?: string
    items: Array<{ variantId: string; quantity: number }>
    notes?: string
  }) {
    // Resolve ambassador if code provided
    let ambassador = null
    if (data.ambassadorCode) {
      ambassador = await this.prisma.ambassador.findUnique({
        where: { code: data.ambassadorCode, status: 'ACTIVE' },
      })
      if (!ambassador) throw new AppError('Invalid ambassador code', 400)
    }

    // Calculate totals
    const itemsWithPrices = await Promise.all(
      data.items.map(async (item) => {
        const variant = await this.prisma.productVariant.findUnique({
          where: { id: item.variantId },
          include: {
            prices: {
              where: { tier: ambassador ? 'AMBASSADOR' : 'RETAIL' },
            },
          },
        })
        if (!variant || variant.prices.length === 0) {
          throw new AppError(`Variant ${item.variantId} not found or no price set`, 400)
        }
        const unitPrice = Number(variant.prices[0].price)
        return {
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice,
          subtotal: unitPrice * item.quantity,
        }
      })
    )

    const subtotal = itemsWithPrices.reduce((sum, i) => sum + i.subtotal, 0)
    const deliveryFee = 0 // implement delivery logic later
    const total = subtotal + deliveryFee

    const order = await this.prisma.order.create({
      data: {
        customerId: data.customerId,
        ambassadorId: ambassador?.id,
        addressId: data.addressId,
        subtotal,
        deliveryFee,
        total,
        notes: data.notes,
        items: { create: itemsWithPrices },
        statusLogs: { create: { status: 'PENDING' } },
      },
      include: { items: true, ambassador: true },
    })

    return order
  }

  async updateStatus(orderId: string, status: OrderStatus, note?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        ambassador: true,
        items: {
          include: {
            variant: {
              include: {
                product: { include: { stockItem: true } },
              },
            },
          },
        },
      },
    })
    if (!order) throw new NotFoundError('Order')

    // ── Smart stock routing ───────────────────────────────────────────────────
    // When advancing to BAKING, check if all sellable items already have
    // finished-goods stock. If yes, skip BAKING and go straight to READY,
    // deducting the stock as it is fulfilled.
    let actualStatus: OrderStatus = status
    let fulfilledFromStock = false

    if (status === 'BAKING') {
      const db = this.prisma as any

      // Collect SELLABLE items that have a stock item (finished-goods tracking)
      const trackedItems = (order as any).items.filter(
        (item: any) =>
          item.variant?.product?.classification === 'SELLABLE' &&
          item.variant?.product?.stockItem != null,
      )

      const allHaveStock =
        trackedItems.length > 0 &&
        trackedItems.every(
          (item: any) =>
            Number(item.variant.product.stockItem.currentStock) >= item.quantity,
        )

      if (allHaveStock) {
        actualStatus = 'READY' as OrderStatus
        fulfilledFromStock = true

        // Deduct finished-goods stock for each item
        for (const item of trackedItems) {
          const stockItem = item.variant.product.stockItem
          await db.stockMovement.create({
            data: {
              stockItemId: stockItem.id,
              type: 'ADJUSTMENT_OUT',
              quantity: -item.quantity,
              reference: `ORDER-${orderId.slice(-8).toUpperCase()}`,
              note: `Fulfilled for order — ${item.variant.product.name} × ${item.quantity}`,
            },
          })
          await db.stockItem.update({
            where: { id: stockItem.id },
            data: { currentStock: { increment: -item.quantity } },
          })
        }
      }
    }

    const statusNote = fulfilledFromStock
      ? `Fulfilled from finished-goods stock — baking step skipped${note ? '. ' + note : ''}`
      : note

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: actualStatus,
        statusLogs: { create: { status: actualStatus, note: statusNote } },
      },
    })

    // Auto-create commission when order is confirmed and has ambassador
    if (status === 'CONFIRMED' && order.ambassadorId && order.ambassador) {
      const existing = await this.prisma.commission.findUnique({ where: { orderId } })
      if (!existing) {
        const rate = Number(order.ambassador.commissionRate)
        await this.prisma.commission.create({
          data: {
            orderId,
            ambassadorId: order.ambassadorId,
            amount: Number(order.total) * rate,
            rate,
          },
        })
      }
    }

    return { ...updated, fulfilledFromStock, actualStatus }
  }

  async getForCustomer(customerId: string) {
    return this.prisma.order.findMany({
      where: { customerId },
      include: { items: { include: { variant: { include: { product: true } } } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getForAmbassador(ambassadorId: string) {
    return this.prisma.order.findMany({
      where: { ambassadorId },
      include: { customer: { select: { id: true, email: true, phone: true, firstName: true, lastName: true, status: true, createdAt: true, updatedAt: true } }, items: true, commission: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getAll() {
    return this.prisma.order.findMany({
      include: {
        customer: { select: { id: true, email: true, phone: true, firstName: true, lastName: true, status: true, createdAt: true, updatedAt: true } },
        ambassador: true,
        commission: true,
        items: { include: { variant: { include: { product: true } } } },
        statusLogs: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  private orderInclude = {
    customer: { select: { id: true, email: true, phone: true, firstName: true, lastName: true, status: true, createdAt: true, updatedAt: true } },
    ambassador: true,
    commission: true,
    items: { include: { variant: { include: { product: true } } } },
    statusLogs: { orderBy: { createdAt: 'asc' } as const },
  }

  async getById(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: this.orderInclude,
    })
    if (!order) throw new NotFoundError('Order')
    return order
  }

  async update(orderId: string, data: { notes?: string; deliveryFee?: number; ambassadorCode?: string | null }) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order) throw new NotFoundError('Order')

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

    const updateData: Record<string, unknown> = {}
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.deliveryFee !== undefined) {
      updateData.deliveryFee = data.deliveryFee
      updateData.total = Number(order.subtotal) + data.deliveryFee
    }
    if (ambassadorId !== undefined) updateData.ambassadorId = ambassadorId

    return this.prisma.order.update({
      where: { id: orderId },
      data: updateData,
      include: this.orderInclude,
    })
  }
}
