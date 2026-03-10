import { FastifyPluginAsync } from 'fastify'
import { authenticate, authorize } from '../../shared/middleware/auth'

const packagingRoutes: FastifyPluginAsync = async (fastify) => {
  const db = fastify.prisma as any

  // ── GET /packaging ─── All packaging runs
  fastify.get('/', { preHandler: [authenticate, authorize('manage', 'product')] }, async () => {
    return db.packagingRun.findMany({
      include: {
        productionRun: {
          include: {
            recipe: {
              select: { id: true, name: true, outputProductId: true, yieldPerBatch: true },
            },
          },
        },
        items: { include: { stockItem: { select: { id: true, name: true, unit: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })
  })

  // ── GET /packaging/:id ─── Single run with items
  fastify.get('/:id', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req) => {
    const { id } = req.params as { id: string }
    const run = await db.packagingRun.findUnique({
      where: { id },
      include: {
        productionRun: {
          include: {
            recipe: {
              include: {
                outputProduct: { include: { stockItem: true } },
              },
            },
          },
        },
        items: { include: { stockItem: true } },
      },
    })
    if (!run) throw { statusCode: 404, message: 'Packaging run not found' }
    return run
  })

  // ── PATCH /packaging/:id ─── Update status / notes / add items
  fastify.patch('/:id', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req) => {
    const { id } = req.params as { id: string }
    const { status, notes, items } = req.body as any
    const data: any = {}
    if (status) data.status = status
    if (notes !== undefined) data.notes = notes

    // If items provided, replace all packaging material items
    if (Array.isArray(items)) {
      await db.packagingRunItem.deleteMany({ where: { packagingRunId: id } })
      if (items.length) {
        data.items = {
          create: items.map((i: any) => ({ stockItemId: i.stockItemId, quantity: i.quantity })),
        }
      }
    }

    return db.packagingRun.update({
      where: { id },
      data,
      include: {
        items: { include: { stockItem: { select: { id: true, name: true, unit: true } } } },
      },
    })
  })

  // ── POST /packaging/:id/complete ─── Complete run → deduct packaging stock + add finished goods
  fastify.post('/:id/complete', { preHandler: [authenticate, authorize('manage', 'product')] }, async (req, reply) => {
    const { id } = req.params as { id: string }

    const run = await db.packagingRun.findUnique({
      where: { id },
      include: {
        productionRun: {
          include: {
            recipe: {
              include: {
                outputProduct: { include: { stockItem: true } },
              },
            },
          },
        },
        items: true,
      },
    })
    if (!run) throw { statusCode: 404, message: 'Packaging run not found' }
    if (run.status === 'COMPLETED') throw { statusCode: 400, message: 'Packaging run already completed' }
    if (run.status === 'CANCELLED') throw { statusCode: 400, message: 'Packaging run is cancelled' }

    const recipe = run.productionRun.recipe
    const batchCount = run.batchCount

    // 1. Deduct packaging materials
    for (const item of run.items) {
      const qty = Number(item.quantity)
      await db.stockMovement.create({
        data: {
          stockItemId: item.stockItemId,
          type: 'PRODUCTION_USE',
          quantity: -qty,
          reference: id,
          note: `Packaging material used for packaging run ${id}`,
        },
      })
      await db.stockItem.update({
        where: { id: item.stockItemId },
        data: { currentStock: { decrement: qty } },
      })
    }

    // 2. Add finished goods to stock (if recipe has outputProduct and yieldPerBatch set)
    let unitsProduced = 0
    if (recipe.outputProduct && Number(recipe.yieldPerBatch) > 0) {
      unitsProduced = batchCount * Number(recipe.yieldPerBatch)
      let stockItem = recipe.outputProduct.stockItem

      // Create stockItem for output product if it doesn't exist yet
      if (!stockItem) {
        stockItem = await db.stockItem.create({
          data: {
            productId: recipe.outputProduct.id,
            name: recipe.outputProduct.name,
            unit: 'units',
            currentStock: 0,
          },
        })
      }

      await db.stockMovement.create({
        data: {
          stockItemId: stockItem.id,
          type: 'PRODUCTION_OUTPUT',
          quantity: unitsProduced,
          reference: id,
          note: `Finished goods from packaging run — ${recipe.name} × ${batchCount} batch(es)`,
        },
      })
      await db.stockItem.update({
        where: { id: stockItem.id },
        data: { currentStock: { increment: unitsProduced } },
      })
    }

    const updated = await db.packagingRun.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date() },
      include: {
        items: { include: { stockItem: { select: { id: true, name: true, unit: true } } } },
        productionRun: { include: { recipe: { select: { id: true, name: true } } } },
      },
    })

    return reply.code(200).send({ ...updated, unitsProduced })
  })
}

export default packagingRoutes
