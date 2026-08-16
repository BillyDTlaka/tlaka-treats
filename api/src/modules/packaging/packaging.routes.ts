import { FastifyPluginAsync } from 'fastify'
import { authenticate, authorize } from '../../shared/middleware/auth'
import { AppError, NotFoundError } from '../../shared/errors'
import { OrderService } from '../orders/orders.service'

const packagingRoutes: FastifyPluginAsync = async (fastify) => {
  const db = fastify.prisma as any
  const orderService = new OrderService(fastify.prisma)

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
    if (!run) throw new NotFoundError('Packaging run')
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
    const { unitsProduced: enteredUnitsProduced, unitsWasted } = (req.body || {}) as { unitsProduced?: number; unitsWasted?: number }

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
    if (!run) throw new NotFoundError('Packaging run')
    if (run.status === 'COMPLETED') throw new AppError('Packaging run already completed', 400)
    if (run.status === 'CANCELLED') throw new AppError('Packaging run is cancelled', 400)

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

    // 2. Add finished goods to stock (if recipe has outputProduct and yieldPerBatch set).
    // Actual output can be entered at completion — it doesn't always match the recipe's
    // expected yield exactly (breakage, oven variance) — defaulting to the computed
    // expectation when not provided keeps every existing/programmatic caller unaffected.
    let unitsProduced = 0
    if (recipe.outputProduct && Number(recipe.yieldPerBatch) > 0) {
      const expectedUnits = batchCount * Number(recipe.yieldPerBatch)
      unitsProduced = enteredUnitsProduced != null ? Number(enteredUnitsProduced) : expectedUnits
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

      if (unitsProduced > 0) {
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
    }

    const updated = await db.packagingRun.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        unitsProduced,
        unitsWasted: unitsWasted != null ? Number(unitsWasted) : 0,
      },
      include: {
        items: { include: { stockItem: { select: { id: true, name: true, unit: true } } } },
        productionRun: { include: { recipe: { select: { id: true, name: true } } } },
      },
    })

    // If this run was baking for a specific order, this may be the last piece it was
    // waiting on — check and auto-advance it to READY (no-op if other runs are still
    // pending, or this run wasn't linked to an order at all).
    let orderAdvanced = null
    if (run.productionRun.orderId) {
      orderAdvanced = await orderService.completeBakingForOrder(run.productionRun.orderId)
    }

    return reply.code(200).send({ ...updated, unitsProduced, ...(orderAdvanced ? { orderAdvanced } : {}) })
  })
}

export default packagingRoutes
