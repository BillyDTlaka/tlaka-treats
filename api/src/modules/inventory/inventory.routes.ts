import { FastifyPluginAsync } from 'fastify'
import { authenticate, authorize } from '../../shared/middleware/auth'

const inventoryRoutes: FastifyPluginAsync = async (fastify) => {
  const db = fastify.prisma as any

  // ── GET /inventory ─── All stock items with current levels
  fastify.get('/', { preHandler: [authenticate, authorize('manage', 'product')] }, async () => {
    return db.stockItem.findMany({
      include: {
        product: { select: { id: true, name: true, classification: true, supplier: { select: { id: true, name: true } } } },
        _count: { select: { movements: true, recipeIngredients: true } },
      },
      orderBy: { name: 'asc' },
    })
  })

  // ── GET /inventory/sellable ─── Sellable (finished-goods) products with stock levels
  fastify.get('/sellable', { preHandler: [authenticate, authorize('manage', 'product')] }, async () => {
    return db.product.findMany({
      where: { classification: 'SELLABLE', isActive: true },
      include: {
        category: { select: { id: true, name: true } },
        stockItem: true,
        variants: {
          where: { isActive: true },
          include: { prices: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    })
  })

  // ── GET /inventory/:id ─── Single item with movement history
  fastify.get('/:id', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req) => {
    const { id } = req.params as { id: string }
    const item = await db.stockItem.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, name: true, classification: true, supplier: { select: { id: true, name: true } } } },
        movements: { orderBy: { createdAt: 'desc' }, take: 30 },
        recipeIngredients: {
          include: { recipe: { select: { id: true, name: true } } },
        },
      },
    })
    if (!item) throw { statusCode: 404, message: 'Stock item not found' }
    return item
  })

  // ── POST /inventory ─── Create stock item (must reference a Product)
  fastify.post('/', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req, reply) => {
    const { productId, name, sku, unit, minStockLevel, costPerUnit, notes } = req.body as any
    if (!productId) return reply.code(400).send({ message: 'productId is required — a stock item must be backed by a product' })
    // Verify product exists and doesn't already have a stock item
    const product = await db.product.findUnique({ where: { id: productId }, include: { stockItem: true } })
    if (!product) return reply.code(404).send({ message: 'Product not found' })
    if (product.stockItem) return reply.code(409).send({ message: 'This product already has a stock item' })
    const item = await db.stockItem.create({
      data: {
        productId,
        name: name || product.name,
        sku: sku || undefined,
        unit,
        minStockLevel: minStockLevel || 0,
        costPerUnit: costPerUnit || 0,
        notes,
      },
      include: { product: { select: { id: true, name: true, supplier: { select: { id: true, name: true } } } } },
    })
    return reply.code(201).send(item)
  })

  // ── PATCH /inventory/:id ─── Update stock item
  fastify.patch('/:id', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req) => {
    const { id } = req.params as { id: string }
    const { name, sku, unit, minStockLevel, costPerUnit, notes, isActive } = req.body as any
    return db.stockItem.update({
      where: { id },
      data: { name, sku: sku || undefined, unit, minStockLevel, costPerUnit, notes, isActive },
    })
  })

  // ── POST /inventory/movement ─── Record a manual movement
  fastify.post('/movement', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req, reply) => {
    const { stockItemId, type, quantity, unitCost, reference, note } = req.body as any
    if (!stockItemId || !type || quantity == null) {
      return reply.code(400).send({ message: 'stockItemId, type, and quantity are required' })
    }
    const absQty = Math.abs(Number(quantity))
    // Positive types = stock in; negative types = stock out
    const POSITIVE_TYPES = ['PURCHASE', 'ADJUSTMENT_IN']
    const signedQty = POSITIVE_TYPES.includes(type) ? absQty : -absQty

    await db.stockMovement.create({
      data: { stockItemId, type, quantity: signedQty, unitCost: unitCost || undefined, reference: reference || undefined, note: note || undefined },
    })
    const updated = await db.stockItem.update({
      where: { id: stockItemId },
      data: { currentStock: { increment: signedQty } },
    })
    return reply.code(201).send(updated)
  })

  // ── POST /inventory/stocktake ─── Submit a full stock take (array of {stockItemId, countedQty})
  fastify.post('/stocktake', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req, reply) => {
    const { items, note } = req.body as any
    if (!Array.isArray(items) || items.length === 0) {
      return reply.code(400).send({ message: 'items array is required' })
    }
    const results: any[] = []
    for (const entry of items) {
      const { stockItemId, countedQty } = entry
      const stockItem = await db.stockItem.findUnique({ where: { id: stockItemId } })
      if (!stockItem) continue
      const variance = Number(countedQty) - Number(stockItem.currentStock)
      if (variance === 0) { results.push({ stockItemId, variance: 0, adjusted: false }); continue; }
      const movType = variance > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT'
      await db.stockMovement.create({
        data: { stockItemId, type: movType, quantity: variance, note: note || 'Stock take adjustment', reference: 'STOCK-TAKE' },
      })
      await db.stockItem.update({ where: { id: stockItemId }, data: { currentStock: Number(countedQty) } })
      results.push({ stockItemId, variance, adjusted: true })
    }
    return reply.code(200).send({ message: 'Stock take applied', results })
  })

  // ── GET /inventory/movements/recent ─── Last 50 movements across all items
  fastify.get('/movements/recent', { preHandler: [authenticate, authorize('manage', 'product')] }, async () => {
    return db.stockMovement.findMany({
      include: { stockItem: { select: { id: true, name: true, unit: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  })
}

export default inventoryRoutes
