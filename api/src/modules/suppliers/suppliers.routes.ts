import { FastifyPluginAsync } from 'fastify'
import { authenticate, authorize } from '../../shared/middleware/auth'

const supplierRoutes: FastifyPluginAsync = async (fastify) => {
  const db = fastify.prisma as any

  // ── GET /suppliers ─── List all suppliers
  fastify.get('/', { preHandler: [authenticate, authorize('manage', 'product')] }, async () => {
    return db.supplier.findMany({
      include: {
        _count: { select: { products: true, purchaseOrders: true } },
      },
      orderBy: { name: 'asc' },
    })
  })

  // ── GET /suppliers/:id ─── Supplier detail + products + PO history
  fastify.get('/:id', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req) => {
    const { id } = req.params as { id: string }
    const s = await db.supplier.findUnique({
      where: { id },
      include: {
        products: {
          select: { id: true, name: true, classification: true, stockItem: { select: { id: true, currentStock: true, unit: true, uom: { select: { abbreviation: true } } } } },
        },
        purchaseOrders: {
          include: { items: { include: { stockItem: { select: { id: true, name: true, unit: true, uom: { select: { id: true, abbreviation: true } } } } } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })
    if (!s) throw { statusCode: 404, message: 'Supplier not found' }
    return s
  })

  // ── POST /suppliers ─── Create supplier
  fastify.post('/', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req, reply) => {
    const data = req.body as any
    const supplier = await db.supplier.create({ data })
    return reply.code(201).send(supplier)
  })

  // ── PATCH /suppliers/:id ─── Update supplier
  fastify.patch('/:id', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req) => {
    const { id } = req.params as { id: string }
    const data = req.body as any
    return db.supplier.update({ where: { id }, data })
  })

  // ── GET /purchase-orders ─── All POs
  fastify.get('/purchase-orders', { preHandler: [authenticate, authorize('manage', 'product')] }, async () => {
    return db.purchaseOrder.findMany({
      include: {
        supplier: { select: { id: true, name: true } },
        items: { include: { stockItem: { select: { id: true, name: true, unit: true, uom: { select: { id: true, abbreviation: true } } } } } },
      },
      orderBy: { createdAt: 'desc' },
    })
  })

  // ── POST /purchase-orders ─── Create PO
  fastify.post('/purchase-orders', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req, reply) => {
    const { supplierId, expectedDate, notes, items } = req.body as any
    const itemsArr: any[] = items || []
    const total = itemsArr.reduce((s: number, i: any) => s + Number(i.unitCost) * Number(i.orderedQty), 0)
    const po = await db.purchaseOrder.create({
      data: {
        supplierId,
        expectedDate: expectedDate ? new Date(expectedDate) : undefined,
        notes,
        total,
        items: {
          create: itemsArr.map((i: any) => ({
            stockItemId: i.stockItemId,
            orderedQty:  i.orderedQty,
            receivedQty: 0,
            unitCost:    i.unitCost,
            total:       Number(i.unitCost) * Number(i.orderedQty),
          })),
        },
      },
      include: { items: true },
    })
    return reply.code(201).send(po)
  })

  // ── PATCH /purchase-orders/:id ─── Update PO status
  fastify.patch('/purchase-orders/:id', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req) => {
    const { id } = req.params as { id: string }
    const data = req.body as any
    return db.purchaseOrder.update({ where: { id }, data: { status: data.status, notes: data.notes, expectedDate: data.expectedDate ? new Date(data.expectedDate) : undefined } })
  })

  // ── POST /purchase-orders/:id/receive ─── Receive all PO items (mark received + create stock movements)
  fastify.post('/purchase-orders/:id/receive', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req) => {
    const { id } = req.params as { id: string }
    const po = await db.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    })
    if (!po) throw { statusCode: 404, message: 'Purchase order not found' }
    if (po.status === 'RECEIVED' || po.status === 'CANCELLED') throw { statusCode: 400, message: `Cannot receive a ${po.status} order` }

    // For each item, create a stock movement and update currentStock
    for (const item of po.items) {
      const qty = Number(item.orderedQty) - Number(item.receivedQty)
      if (qty <= 0) continue
      await db.stockMovement.create({
        data: {
          stockItemId: item.stockItemId,
          type: 'PURCHASE',
          quantity: qty,
          unitCost: item.unitCost,
          reference: id,
          purchaseOrderId: id,
          note: `Received via PO`,
        },
      })
      await db.stockItem.update({
        where: { id: item.stockItemId },
        data: {
          currentStock: { increment: qty },
          costPerUnit: item.unitCost,  // update to latest purchase price
        },
      })
      await db.purchaseOrderItem.update({
        where: { id: item.id },
        data: { receivedQty: item.orderedQty },
      })
    }

    return db.purchaseOrder.update({
      where: { id },
      data: { status: 'RECEIVED' },
      include: {
        supplier: true,
        items: { include: { stockItem: { select: { id: true, name: true, unit: true, uom: { select: { abbreviation: true } } } } } },
      },
    })
  })
}

export default supplierRoutes
