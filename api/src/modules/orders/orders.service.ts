import { PrismaClient, OrderStatus } from '@prisma/client'
import { AppError, NotFoundError, ForbiddenError } from '../../shared/errors'
import { sendOrderStatusEmail, sendOrderStatusWhatsApp } from '../../shared/services/notify.service'
import { syncOrderInvoice, cancelOrderInvoice, OdooInvoiceSyncResult } from '../../shared/services/odoo-invoice.service'
import { syncCommissionBill } from '../../shared/services/odoo-commission-bill.service'
import { syncOrderCogs } from '../../shared/services/odoo-cogs.service'

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
      include: {
        items: { include: { variant: { include: { product: true } } } },
        ambassador: true,
        customer: { select: { email: true, phone: true, firstName: true, lastName: true } },
      },
    })

    // Notify customer — fire and forget
    this.fireNotification(order, order.customer as any)

    return order
  }

  private fireNotification(orderWithCustomer: any, customer: { email?: string | null; phone?: string | null }) {
    if (customer?.email) {
      sendOrderStatusEmail(orderWithCustomer, customer.email).catch(() => {/* silent */})
    }
    if (customer?.phone) {
      sendOrderStatusWhatsApp(orderWithCustomer, customer.phone).catch(() => {/* silent */})
    }
  }

  async updateStatus(orderId: string, status: OrderStatus, note?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        ambassador: true,
        customer: { select: { email: true, phone: true, firstName: true, lastName: true } },
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

    const db = this.prisma as any

    // ── Stock deduction at CONFIRMED ──────────────────────────────────────────
    if (status === 'CONFIRMED') {
      const sellableItems = (order as any).items.filter(
        (item: any) =>
          item.variant?.product?.classification === 'SELLABLE' &&
          item.variant?.product?.stockItem != null,
      )
      for (const item of sellableItems) {
        const stockItem = item.variant.product.stockItem
        // item.quantity counts how many of *this variant* were ordered (e.g. "2 packs") —
        // unitsPerPack converts that into a count of individual stock units to deduct.
        const qty = Number(item.quantity) * Number(item.variant.unitsPerPack || 1)
        await db.stockMovement.create({
          data: {
            stockItemId: stockItem.id,
            type: 'ORDER_FULFILLMENT',
            quantity: -qty,
            reference: orderId,
            note: `Order confirmed — ${item.variant.product.name} × ${qty}`,
          },
        })
        await db.stockItem.update({
          where: { id: stockItem.id },
          data: { currentStock: { decrement: qty } },
        })
      }
    }

    // ── Reversal at CANCELLED — undo whatever CONFIRMED did, if it happened ────
    // Only reverses PENDING commissions and restocks against an actual prior deduction —
    // never touches an APPROVED/PAID commission (money already committed) or deletes the
    // original FinanceTransaction (an offsetting entry is booked instead, preserving the
    // audit trail).
    if (status === 'CANCELLED') {
      const priorMovements = await db.stockMovement.findMany({ where: { reference: orderId, type: 'ORDER_FULFILLMENT' } })
      for (const movement of priorMovements) {
        const qty = Math.abs(Number(movement.quantity))
        await db.stockMovement.create({
          data: {
            stockItemId: movement.stockItemId,
            type: 'ADJUSTMENT_IN',
            quantity: qty,
            reference: orderId,
            note: 'Order cancelled — stock restored',
          },
        })
        await db.stockItem.update({ where: { id: movement.stockItemId }, data: { currentStock: { increment: qty } } })
      }
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status,
        statusLogs: { create: { status, note } },
      },
    })

    if (status === 'CANCELLED') {
      const existingCommission = await this.prisma.commission.findUnique({ where: { orderId } })
      if (existingCommission && existingCommission.status === 'PENDING') {
        await this.prisma.commission.update({ where: { orderId }, data: { status: 'CANCELLED' } })
      }

      const existingTxn = await db.financeTransaction.findUnique({ where: { orderId } })
      if (existingTxn) {
        const orderRef = `#${orderId.slice(-8).toUpperCase()}`
        await db.financeTransaction.create({
          data: {
            type: 'INCOME',
            category: existingTxn.category,
            amount: -Number(existingTxn.amount),
            description: `Order cancelled — reversing sale for order ${orderRef}`,
            reference: orderId,
            accountId: existingTxn.accountId,
          },
        })
      }
    }

    // Auto-record income finance transaction when confirmed (idempotent — skips if already exists)
    if (status === 'CONFIRMED') {
      const existing = await db.financeTransaction.findUnique({ where: { orderId } })
      if (!existing) {
        const salesAccount = await db.financeAccount.findFirst({ where: { code: '4001' } })
        const orderRef = `#${orderId.slice(-8).toUpperCase()}`
        const custName = `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim()
        await db.financeTransaction.create({
          data: {
            type: 'INCOME',
            category: 'Product Sales',
            amount: Number(order.total),
            description: `Sale — Order ${orderRef}${custName ? ` (${custName})` : ''}`,
            reference: orderId,
            orderId,
            accountId: salesAccount?.id || undefined,
          },
        })
      }
    }

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

    // Notify customer of status change — fire and forget
    const notifyOrder = {
      ...updated,
      customer: order.customer,
      items: order.items,
      total: order.total,
      notes: order.notes,
    }
    this.fireNotification(notifyOrder, order.customer as any)

    // Create/refresh the draft Odoo customer invoice, or cancel it — synchronous for now
    // so the result is visible immediately. Never throws: Odoo failures are persisted on
    // the order (odooInvoiceStatus/odooInvoiceSyncError) but don't affect the
    // already-committed local status change, stock, finance or commission records.
    let odoo: OdooInvoiceSyncResult | undefined
    if (status === 'CONFIRMED') {
      odoo = await syncOrderInvoice(this.prisma, orderId)
    } else if (status === 'CANCELLED') {
      odoo = await cancelOrderInvoice(this.prisma, orderId)
    }

    // The commission cost lands in Odoo once the order is actually delivered — that's when
    // the sale is fulfilled, so it's matched to the sale rather than posted speculatively at
    // CONFIRMED (when the order could still fall through before delivery).
    let commissionOdoo: Awaited<ReturnType<typeof syncCommissionBill>> | undefined
    let cogsOdoo: Awaited<ReturnType<typeof syncOrderCogs>> | undefined
    if (status === 'DELIVERED') {
      commissionOdoo = await syncCommissionBill(this.prisma, orderId)
      cogsOdoo = await syncOrderCogs(this.prisma, orderId)
    }

    return { ...updated, ...(odoo ? { odoo } : {}), ...(commissionOdoo ? { commissionOdoo } : {}), ...(cogsOdoo ? { cogsOdoo } : {}) }
  }

  // Records a cash/EFT/manual-card payment against an order (there was previously no way
  // to do this at all for cash/EFT — only PayFast's webhook ever set paymentStatus). Pushes
  // to Odoo immediately if the invoice already exists and is posted; otherwise it's picked
  // up automatically the next time the order's Odoo sync runs (e.g. once Billy posts the
  // draft invoice, or via the retry endpoint).
  async recordPayment(orderId: string, data: { method: 'CASH' | 'EFT' | 'CARD'; reference?: string }) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order) throw new NotFoundError('Order')

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        paymentMethod: data.method,
        paymentStatus: 'PAID',
        paidAt: new Date(),
        paymentRef: data.reference || null,
      },
    })

    const odoo = await syncOrderInvoice(this.prisma, orderId)
    return { ...updated, odoo }
  }

  async getForCustomer(customerId: string) {
    return this.prisma.order.findMany({
      where: { customerId },
      include: {
        items: { include: { variant: { include: { product: true } } } },
        address: true,
        ambassador: { select: { code: true } },
        statusLogs: { orderBy: { createdAt: 'asc' } },
      },
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

  async updateItems(orderId: string, items: Array<{ variantId: string; quantity: number }>) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { ambassador: true },
    })
    if (!order) throw new NotFoundError('Order')

    const tier = order.ambassador ? 'AMBASSADOR' : 'RETAIL'

    const itemsWithPrices = await Promise.all(
      items.map(async (item) => {
        const variant = await this.prisma.productVariant.findUnique({
          where: { id: item.variantId },
          include: { prices: true },
        })
        if (!variant) throw new AppError(`Variant ${item.variantId} not found`, 400)
        const price =
          variant.prices.find((p) => p.tier === tier) ||
          variant.prices.find((p) => p.tier === 'RETAIL')
        if (!price) throw new AppError(`No price found for variant ${item.variantId}`, 400)
        const unitPrice = Number(price.price)
        return { variantId: item.variantId, quantity: item.quantity, unitPrice, subtotal: unitPrice * item.quantity }
      }),
    )

    const subtotal = itemsWithPrices.reduce((sum, i) => sum + i.subtotal, 0)
    const total = subtotal + Number(order.deliveryFee)

    await this.prisma.$transaction([
      this.prisma.orderItem.deleteMany({ where: { orderId } }),
      ...itemsWithPrices.map((item) => this.prisma.orderItem.create({ data: { orderId, ...item } })),
      this.prisma.order.update({ where: { id: orderId }, data: { subtotal, total } }),
    ])

    return this.getById(orderId)
  }

  async generateInvoice(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } })
    if (!order) throw new NotFoundError('Order')
    if (order.invoiceNumber) return this.getById(orderId) // already invoiced
    const invoiceNumber = `INV-${orderId.slice(-8).toUpperCase()}`
    await this.prisma.order.update({
      where: { id: orderId },
      data: { invoiceNumber, invoicedAt: new Date() },
    })
    return this.getById(orderId)
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
